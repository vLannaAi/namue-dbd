import type { RpcRequest, RpcResponse } from "./rpc.ts";
import type {
  SearchPage as DwSearchPage,
  SearchResult as DwSearchResult,
  CompanyProfile as DwProfileDetail,
  Objective as DwObjective,
  Committee as DwCommittee,
  Partner as DwPartner,
  Nation as DwNation,
  CompanyFull as DwCompanyFull,
  SlotError,
} from "siam-portals";
import { PROVINCES } from "./provinces.ts";
import {
  STRINGS, STORAGE_KEY as LANG_STORAGE_KEY,
  loadLang, formatDate, statusLabel, type Lang,
} from "./i18n.ts";

// ── DOM helpers ─────────────────────────────────────────────────────────────
function $<T extends Element = HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing element ${sel}`);
  return el;
}

function send<T = unknown>(req: RpcRequest): Promise<RpcResponse<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(req, (r: RpcResponse<T> | undefined) => {
      if (chrome.runtime.lastError || !r) {
        resolve({
          ok: false,
          error: {
            code: "NAMUE_DISCONNECTED",
            message: chrome.runtime.lastError?.message ?? "no response from service worker",
          },
        });
        return;
      }
      resolve(r);
    });
  });
}

// ── Language state ──────────────────────────────────────────────────────────
let lang: Lang = loadLang();
function t(): typeof STRINGS["en"] { return STRINGS[lang]; }

async function persistLang(value: Lang): Promise<void> {
  try { await chrome.storage.local.set({ [LANG_STORAGE_KEY]: value }); } catch { /* ignore */ }
}
async function hydrateLang(): Promise<void> {
  try {
    const got = await chrome.storage.local.get(LANG_STORAGE_KEY);
    const stored = got[LANG_STORAGE_KEY];
    if (stored === "th" || stored === "en") lang = stored;
  } catch { /* keep default */ }
}

function applyStaticStrings(): void {
  const s = t();
  ($("#tagline") as HTMLSpanElement).textContent = s.tagline;
  ($("#connect") as HTMLButtonElement).textContent = s.connectButton;
  ($("#q") as HTMLInputElement).placeholder = s.searchPlaceholder;
  ($("#go") as HTMLButtonElement).setAttribute("aria-label", s.translateTitle);
  ($("#go") as HTMLButtonElement).title = s.translateTitle;
  ($("#filters-toggle") as HTMLButtonElement).setAttribute("aria-label", s.filtersTitle);
  ($("#filters-toggle") as HTMLButtonElement).title = s.filtersTitle;
  ($("#province") as HTMLInputElement).placeholder = s.provincePlaceholder;
  ($("#province") as HTMLInputElement).setAttribute("aria-label", s.province);
  ($("#lbl-active-only") as HTMLSpanElement).textContent = s.activeOnly;
  // #load-more-btn no longer exists — lazy load via scroll handles pagination.
  ($("#footer-data") as HTMLSpanElement).textContent = s.footerData;
  // Both lang-toggle instances (brand-row + filters panel) share the same
  // tooltip / aria-label so updates apply to all.
  document.querySelectorAll<HTMLButtonElement>(".lang-toggle").forEach((btn) => {
    btn.setAttribute("aria-label", s.switchTooltip);
    btn.title = s.switchTooltip;
  });
  ($("#detail-back") as HTMLButtonElement).setAttribute("aria-label", s.backToList);
  ($("#detail-back") as HTMLButtonElement).title = s.backToList;
  ($("#detail-prev") as HTMLButtonElement).setAttribute("aria-label", s.prevRecord);
  ($("#detail-prev") as HTMLButtonElement).title = s.prevRecord;
  ($("#detail-next") as HTMLButtonElement).setAttribute("aria-label", s.nextRecord);
  ($("#detail-next") as HTMLButtonElement).title = s.nextRecord;
  document.documentElement.lang = lang;
}

// ── State ───────────────────────────────────────────────────────────────────
interface SearchState {
  query: string;
  pvCode: string;
  activeOnly: boolean;
  nextPage: number;
  totalItems: number;
  totalPages: number;
}
let connected = false;
let state: SearchState | null = null;
// Full list of result objects, accumulated across Load More. Used for prev/next.
let currentResults: DwSearchResult[] = [];
let currentDetailIndex = -1;
let lastDetail: {
  profile: DwProfileDetail;
  objectives: DwObjective[];
  committees: DwCommittee[];
  partners: DwPartner[];
  nations: DwNation[];
} | null = null;

// company.full slots are `T | SlotError`; fall back to a default on error/absent.
function unwrapSlot<T>(slot: T | SlotError | undefined, fallback: T): T {
  if (slot && typeof slot === "object" && "error" in slot) return fallback;
  return (slot ?? fallback) as T;
}

// Monotonic token guarding detail fetches: company.full is slow, so a later
// open (or a new search) must invalidate an earlier in-flight request whose
// response could otherwise land late and overwrite the panel with stale data.
let detailToken = 0;

// ── Body class helpers ──────────────────────────────────────────────────────
function setBodyClass(cls: string, on: boolean): void {
  document.body.classList.toggle(cls, on);
}

function setConnected(isConnected: boolean): void {
  connected = isConnected;
  setBodyClass("connected", isConnected);
  if (!isConnected) {
    // Close everything that depends on a session.
    setBodyClass("detail-mode", false);
    setBodyClass("results-mode", false);
    $("#filters").classList.remove("open");
    $("#filters-toggle").classList.remove("active");
    ($("#load-more") as HTMLDivElement).classList.remove("visible");
  }
  const target = isConnected ? ($("#q") as HTMLInputElement) : ($("#connect") as HTMLButtonElement);
  requestAnimationFrame(() => { target.focus(); });
}

// ── Tagline slot doubles as the transient status display ────────────────────
// When the popup is idle, the tagline reads "Thai/English business names".
// When an action is in flight (or has errored), the same span shows the
// status text with a tonal color. No separate "x found" row exists; the
// count lives inside the search button (see setCountInButton below).
function showTagline(): void {
  const el = $("#tagline") as HTMLSpanElement;
  el.textContent = t().tagline;
  el.className = "tagline";
}

function showStatus(text: string, tone: "ok" | "warn" | "err"): void {
  const el = $("#tagline") as HTMLSpanElement;
  el.textContent = text;
  el.className = `tagline ${tone}`;
}

// Search-button face: lens icon ↔ result count. Capped at 99 — anything
// larger displays as "99" (no "+" — DBD's totals are noisy at that scale
// anyway, the cap is a UI promise, not a precise measure).
function setCountInButton(total: number | null): void {
  const btn = $("#go") as HTMLButtonElement;
  const slot = $("#btn-count") as HTMLSpanElement;
  if (total === null) {
    btn.classList.remove("has-count");
    slot.textContent = "";
  } else {
    btn.classList.add("has-count");
    slot.textContent = String(Math.min(total, 99));
  }
}

// ── Province datalist ───────────────────────────────────────────────────────
function populateProvinces(): void {
  const list = $("#province-options") as HTMLDataListElement;
  list.innerHTML = "";
  for (const p of PROVINCES) {
    const opt = document.createElement("option");
    // Show only one language to match the active mode. No mixed labels.
    opt.value = lang === "th" ? `${p.nameTh} (${p.nameEn})` : `${p.nameEn}`;
    list.append(opt);
  }
}

function resolvePvCode(typed: string): string {
  const v = typed.trim();
  if (!v) return "";
  const lower = v.toLowerCase();
  for (const p of PROVINCES) {
    if (p.nameTh === v || p.nameEn.toLowerCase() === lower) return p.pvCode;
    if (`${p.nameTh} (${p.nameEn})` === v) return p.pvCode;
  }
  for (const p of PROVINCES) {
    if (p.nameTh.includes(v) || p.nameEn.toLowerCase().includes(lower)) return p.pvCode;
  }
  return "";
}

// ── Filters toggle ──────────────────────────────────────────────────────────
$("#filters-toggle").addEventListener("click", () => {
  const open = $("#filters").classList.toggle("open");
  $("#filters-toggle").classList.toggle("active", open);
  // body.filters-open drives the CSS that extends the pink column
  // down through the filter rows and flips the chevron upside-down.
  setBodyClass("filters-open", open);
});

// ── Row helpers ─────────────────────────────────────────────────────────────
function rowPrimaryName(hit: DwSearchResult): string {
  if (lang === "th") return hit.name;
  return hit.nameEn ?? hit.name;
}

function provinceName(code: string): string {
  const p = PROVINCES.find((x) => x.pvCode === code);
  if (!p) return "";
  return lang === "th" ? p.nameTh : p.nameEn;
}

/**
 * Extract a 2-digit registration year from the juristic ID. DBD encodes
 * the BE year-of-century at positions 6-7 (1-indexed) — for example,
 * "0505566003040" → "66" = BE 2566 = CE 2023, "0505567009858" → "67" =
 * BE 2567 = CE 2024. Returns BE in Thai mode, CE in English mode, both
 * as 2-digit strings. Empty string if the ID is malformed.
 */
function extractRegYear(juristicId: string): string {
  if (juristicId.length < 7) return "";
  const be2 = juristicId.slice(5, 7);
  if (!/^\d{2}$/.test(be2)) return "";
  if (lang === "th") return be2;
  const beYear = 2500 + Number(be2);
  const ceYear = beYear - 543;
  return String(ceYear % 100).padStart(2, "0");
}

function renderRows(page: DwSearchPage, append: boolean): void {
  const out = $("#result") as HTMLDivElement;
  if (!append) {
    out.innerHTML = "";
    currentResults = [];
  }
  for (const hit of page.contents) {
    const index = currentResults.length;
    currentResults.push(hit);

    const row = document.createElement("div");
    row.className = "row";
    row.dataset["index"] = String(index);
    row.tabIndex = 0;
    row.setAttribute("role", "button");

    // Col 1: row number, centered.
    const num = document.createElement("div");
    num.className = "row-num";
    num.textContent = String(index + 1);

    // Col 2: company name + meta line (id · province + status if non-op).
    const body = document.createElement("div");
    body.className = "row-body";
    const primary = document.createElement("div");
    primary.className = "row-primary";
    primary.textContent = rowPrimaryName(hit);

    const meta = document.createElement("div");
    meta.className = "row-meta";
    const idSpan = document.createElement("span");
    idSpan.className = "row-id";
    idSpan.textContent = hit.juristicId;
    meta.append(idSpan);

    const provText = provinceName(hit.provinceCode);
    if (provText) {
      const sep = document.createElement("span");
      sep.className = "sep";
      sep.textContent = "·";
      const prov = document.createElement("span");
      prov.className = "row-province";
      prov.textContent = provText;
      meta.append(sep, prov);
    }

    // Status badge only for non-operating companies (code !== "1").
    // Warm-tinted text + small "alert circle" SVG glyph signals "look here".
    if (hit.status.code !== "1") {
      const badge = document.createElement("span");
      badge.className = "row-status-badge";
      badge.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16h.01"/></svg>`;
      const label = document.createElement("span");
      label.textContent = statusLabel(hit.status.code, hit.status.description, lang);
      badge.append(label);
      meta.append(badge);
    }

    // Inverted: meta (id · province + status badge) on top, name below.
    body.append(meta, primary);

    // Col 3: apostrophed 2-digit registration year ('24 = 2024 in EN,
    // '67 = BE 2567 in TH), centered to align with the lens column.
    const year = document.createElement("div");
    year.className = "row-year";
    const yy = extractRegYear(hit.juristicId);
    year.textContent = yy ? `'${yy}` : "";

    row.append(num, body, year);

    const openThis = () => void openDetailByIndex(index);
    row.addEventListener("click", openThis);
    row.addEventListener("keydown", (e) => {
      const k = (e as KeyboardEvent).key;
      if (k === "Enter" || k === " ") { e.preventDefault(); openThis(); }
    });
    out.append(row);
  }
  out.classList.toggle("has-content", currentResults.length > 0);
}

function clearResults(): void {
  ($("#result") as HTMLDivElement).innerHTML = "";
  ($("#result") as HTMLDivElement).classList.remove("has-content");
  currentResults = [];
  currentDetailIndex = -1;
  lastDetail = null;
  setCountInButton(null);
}

// ── Detail view ─────────────────────────────────────────────────────────────
/**
 * Title-case an English string. DBD returns the structured location fields
 * in ALL CAPS ("HANG DONG", "CHIANG MAI") — converting to proper case makes
 * the rendered address read like an address, not an acronym soup.
 * Leaves numbers, punctuation, and short connector words intact.
 */
function titleCaseEn(s: string): string {
  if (!s) return s;
  return s.toLowerCase().replace(/(?:^|[\s\-/])\p{L}/gu, (c) => c.toUpperCase());
}

function formatAddress(p: DwProfileDetail): string {
  const wantTh = lang === "th";
  // Free-text street/house line: trust DBD's casing in TH; in EN it's mixed
  // but typically already properly cased (e.g. "128/27 Koolpunt Ville…").
  const street = wantTh ? p.addressTh : (p.addressEn ?? p.addressTh);
  // Structured admin segments: DBD ships English names in ALL CAPS. Convert
  // to title case so the address reads like prose. Thai segments unchanged.
  const subd = p.subdistrict
    ? (wantTh ? p.subdistrict.nameTh : titleCaseEn(p.subdistrict.nameEn))
    : "";
  const dist = p.district
    ? (wantTh ? p.district.nameTh : titleCaseEn(p.district.nameEn))
    : "";
  const prov = p.province
    ? (wantTh ? p.province.nameTh : titleCaseEn(p.province.nameEn))
    : "";
  return [street, subd, dist, prov, p.zipCode].filter(Boolean).join(", ");
}

function googleMapsUrl(p: DwProfileDetail): string {
  const query = formatAddress(p);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function committeeName(c: DwCommittee): string {
  if (lang === "th") return c.fullName;
  const parts = [c.titleNameE, c.firstNameE, c.middleNameE, c.lastNameE].filter(Boolean);
  if (parts.length === 0) return c.fullName; // fallback to TH if no English on file
  return parts.join(" ");
}

function showToast(msg: string): void {
  const el = $("#toast") as HTMLDivElement;
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1300);
}

type DetailEntry = "list" | "next" | "prev";

function renderDetailPanel(
  profile: DwProfileDetail,
  objectives: DwObjective[],
  committees: DwCommittee[],
  partners: DwPartner[],
  nations: DwNation[],
  entryDirection: DetailEntry = "list",
): void {
  lastDetail = { profile, objectives, committees, partners, nations };
  const s = t();

  // Reset + set the animation class so the keyframe restarts on every
  // navigation. Forcing a reflow with offsetWidth ensures the browser
  // re-triggers the animation when the class flips back to the same
  // value (e.g. consecutive next clicks).
  const panel = $("#detail") as HTMLDivElement;
  panel.classList.remove("from-list", "from-next", "from-prev", "leaving");
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  void panel.offsetWidth;
  panel.classList.add(`from-${entryDirection}`);

  // ── 3-row header ────────────────────────────────────────────────────
  // Row 1: prev arrow | tax-id · province | copy
  // Row 2: index       | name             | back
  // Row 3: next arrow  | (empty)          | share
  //
  // Pull province from the same PROVINCES table the list rows use so the
  // first-line meta reads *identically* in both views — same name source,
  // same casing, same styling. Falls back to title-cased DBD data if the
  // code isn't in our table (older or merged provinces).
  const provText = profile.province
    ? (provinceName(profile.province.code) ||
       (lang === "th" ? profile.province.nameTh : titleCaseEn(profile.province.nameEn)))
    : "";
  const meta = $("#detail-meta") as HTMLDivElement;
  meta.innerHTML = "";
  const idSpan = document.createElement("span");
  idSpan.className = "id";
  idSpan.textContent = profile.juristicId;
  meta.append(idSpan);
  if (provText) {
    const sep = document.createElement("span");
    sep.className = "sep";
    sep.textContent = "·";
    const prov = document.createElement("span");
    prov.textContent = provText;
    meta.append(sep, prov);
  }

  const indexLabel = currentDetailIndex >= 0 ? String(currentDetailIndex + 1) : "";
  ($("#detail-index") as HTMLSpanElement).textContent = indexLabel;
  ($("#detail-name") as HTMLDivElement).textContent = lang === "th" ? profile.name : (profile.nameEn ?? profile.name);

  // (Detail's row-3 middle slot is intentionally empty — the full
  // registration date is rendered as the "Operating since …" sentence
  // in the body below, so a separate 2-digit year here is redundant.)
  ($("#detail-year") as HTMLDivElement).textContent = "";

  ($("#detail-prev") as HTMLButtonElement).disabled = currentDetailIndex <= 0;
  ($("#detail-next") as HTMLButtonElement).disabled = currentDetailIndex < 0 || currentDetailIndex >= currentResults.length - 1;
  ($("#detail-prev") as HTMLButtonElement).title = s.prevRecord;
  ($("#detail-next") as HTMLButtonElement).title = s.nextRecord;
  ($("#detail-back") as HTMLButtonElement).title = s.backToList;
  ($("#detail-copy") as HTMLButtonElement).title = s.copyTooltip;
  ($("#detail-share") as HTMLButtonElement).title = s.shareTooltip;

  // ── Body ─────────────────────────────────────────────────────────────
  const body = $("#detail-body") as HTMLDivElement;
  body.innerHTML = "";

  // Operating since / Dissolved on — single sentence, no label.
  if (profile.registrationDate) {
    const sentence = document.createElement("p");
    sentence.className = "ds-line";
    const reg = formatDate(profile.registrationDate, lang) ?? profile.registrationDate;
    if (profile.dissolutionDate) {
      const diss = formatDate(profile.dissolutionDate, lang) ?? profile.dissolutionDate;
      sentence.textContent = s.dissolvedOn(diss, reg);
    } else {
      sentence.textContent = s.operatingSince(reg);
    }
    body.append(sentence);
  }

  // Address — clickable link to Google Maps
  const addrText = formatAddress(profile);
  if (addrText) {
    const sec = document.createElement("div");
    sec.className = "ds-section";
    const h = document.createElement("h4");
    h.textContent = s.sectionAddress;
    sec.append(h);
    const p = document.createElement("p");
    const a = document.createElement("a");
    a.href = googleMapsUrl(profile);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = addrText;
    p.append(a);
    sec.append(p);
    body.append(sec);
  }

  // Objectives — same Thai-only-in-EN filter as before.
  const showObjective = (text: string): boolean => {
    if (lang === "th") return true;
    return /[A-Za-z]/.test(text) && !/[฀-๿]/.test(text);
  };
  const visibleObj = objectives.filter((o) => showObjective(o.description));
  if (visibleObj.length > 0) {
    const sec = document.createElement("div");
    sec.className = "ds-section";
    const h = document.createElement("h4");
    h.textContent = s.sectionObjectives(visibleObj.length);
    sec.append(h);
    const ul = document.createElement("ul");
    for (const o of visibleObj) {
      const li = document.createElement("li");
      if (o.code) {
        const cs = document.createElement("span");
        cs.className = "obj-code";
        cs.textContent = o.code;
        li.append(cs);
      }
      li.append(document.createTextNode(o.description));
      ul.append(li);
    }
    sec.append(ul);
    body.append(sec);
  }

  // Directors
  if (committees.length > 0) {
    const sec = document.createElement("div");
    sec.className = "ds-section";
    const h = document.createElement("h4");
    h.textContent = s.sectionDirectors(committees.length);
    sec.append(h);
    const ul = document.createElement("ul");
    for (const c of committees) {
      const li = document.createElement("li");
      li.textContent = committeeName(c);
      ul.append(li);
    }
    sec.append(ul);
    body.append(sec);
  }

  // Shareholder nationality breakdown (company.full `nations` slot).
  if (nations.length > 0) {
    const sec = document.createElement("div");
    sec.className = "ds-section";
    const h = document.createElement("h4");
    h.textContent = s.sectionNationality(nations.length);
    sec.append(h);
    const ul = document.createElement("ul");
    for (const n of nations) {
      const li = document.createElement("li");
      const name = (lang === "th" ? n.nameTh : n.nameEn) ?? n.nameEn ?? n.nameTh ?? n.nationCode;
      li.textContent = n.proportionPercent != null ? `${name} · ${n.proportionPercent}%` : name;
      ul.append(li);
    }
    sec.append(ul);
    body.append(sec);
  }

  // Individual shareholders / partners (company.full `partners` slot).
  if (partners.length > 0) {
    const sec = document.createElement("div");
    sec.className = "ds-section";
    const h = document.createElement("h4");
    h.textContent = s.sectionShareholders(partners.length);
    sec.append(h);
    const ul = document.createElement("ul");
    for (const p of partners) {
      const li = document.createElement("li");
      const enName = [p.firstNameE, p.lastNameE].filter(Boolean).join(" ").trim();
      const name = lang === "th" ? p.fullName : (enName || p.fullName);
      const parts = [name];
      if (p.ntCode) parts.push(p.ntCode);
      if (p.proportionPercent != null) parts.push(`${p.proportionPercent}%`);
      li.textContent = parts.join(" · ");
      ul.append(li);
    }
    sec.append(ul);
    body.append(sec);
  }

  setBodyClass("detail-mode", true);
  if (state) setCountInButton(state.totalItems);
  showTagline();
  (body as HTMLDivElement).scrollTop = 0;
}

// Helper: extract 2-digit year-of-century from an ISO date string.
function extractYearFromIso(iso: string): string {
  const m = iso.match(/^(\d{4})-/);
  if (!m) return "";
  const year = Number(m[1]);
  if (lang === "th") return String((year + 543) % 100).padStart(2, "0");
  return String(year % 100).padStart(2, "0");
}

async function openDetailByIndex(index: number, direction: DetailEntry = "list"): Promise<void> {
  if (index < 0 || index >= currentResults.length) return;
  const hit = currentResults[index]!;
  currentDetailIndex = index;
  const token = ++detailToken;
  setBodyClass("searching", true);
  showStatus(t().loadingDetailShort + "…", "warn");
  const r = await send<DwCompanyFull>({
    type: "company.full", typeCode: hit.typeCode, juristicId: hit.juristicId,
  });
  // A newer open (or a new search) superseded this request — drop the stale
  // response so it can't overwrite the panel. The newer call owns the spinner.
  if (token !== detailToken) return;
  setBodyClass("searching", false);
  if (!r.ok) {
    showStatus(t().errorPrefix(r.error.message), "err");
    if (r.error.code === "NAMUE_SERVER" || r.error.code === "NAMUE_SESSION") setConnected(false);
    return;
  }
  const profile = r.data.profile;
  if (profile && typeof profile === "object" && "error" in profile) {
    showStatus(t().errorPrefix((profile as SlotError).error), "err");
    return;
  }
  renderDetailPanel(
    profile as DwProfileDetail,
    unwrapSlot(r.data.objectives, []),
    unwrapSlot(r.data.committees, []),
    unwrapSlot(r.data.partners, []),
    unwrapSlot(r.data.nations, []),
    direction,
  );
}

function closeDetail(): void {
  // Animate the panel out before flipping detail-mode off — the .leaving
  // class plays detail-zoom-out (~180ms). animationend triggers cleanup;
  // a setTimeout fallback guards against animation being cancelled (e.g.
  // popup blurred mid-transition).
  const panel = $("#detail") as HTMLDivElement;
  panel.classList.remove("from-list", "from-next", "from-prev");
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  void panel.offsetWidth;
  panel.classList.add("leaving");

  const finish = (): void => {
    panel.classList.remove("leaving");
    setBodyClass("detail-mode", false);
    currentDetailIndex = -1;
    lastDetail = null;
    if (state) setCountInButton(state.totalItems);
    else setCountInButton(null);
    showTagline();
  };
  let done = false;
  const wrap = (): void => { if (!done) { done = true; finish(); } };
  panel.addEventListener("animationend", wrap, { once: true });
  setTimeout(wrap, 220);  // fallback if animationend never fires
}

// ── Search actions ──────────────────────────────────────────────────────────
async function checkStatus(): Promise<void> {
  const r = await send<{ connected: boolean }>({ type: "session.status" });
  setConnected(r.ok && r.data.connected);
  showTagline();
}

async function connect(): Promise<void> {
  showStatus(t().openingDbd, "warn");
  setBodyClass("connected", false);
  const r = await send<{ connected: boolean }>({ type: "session.ensure" });
  if (r.ok) { setConnected(true); showTagline(); }
  else { setConnected(false); showStatus(t().connectFailed(r.error.message), "err"); }
}

function buildSearchRequest(s: SearchState): RpcRequest {
  const req: RpcRequest = { type: "translate", scope: "company", query: s.query, page: s.nextPage };
  if (s.pvCode) (req as { pvCodeList?: string[] }).pvCodeList = [s.pvCode];
  if (s.activeOnly) (req as { jpStatusList?: string[] }).jpStatusList = ["1"];
  return req;
}

async function runFirstPage(): Promise<void> {
  const q = ($("#q") as HTMLInputElement).value.trim();
  if (!q) return;
  if (!connected) { setConnected(false); return; }

  const pvCode = resolvePvCode(($("#province") as HTMLInputElement).value);
  const activeOnly = ($("#active-only") as HTMLInputElement).checked;
  state = { query: q, pvCode, activeOnly, nextPage: 1, totalItems: 0, totalPages: 0 };
  clearResults();
  detailToken++;                       // invalidate any in-flight detail open
  setBodyClass("detail-mode", false);  // a new search returns to the list view
  // Sticky: once the user starts searching, the brand row and footer
  // make way for results and stay hidden for the rest of the session.
  setBodyClass("results-mode", true);
  setBodyClass("searching", true);
  showStatus(t().searchingShort + "…", "warn");

  const r = await send<DwSearchPage>(buildSearchRequest(state));
  setBodyClass("searching", false);
  if (!r.ok) {
    showStatus(t().errorPrefix(r.error.message), "err");
    if (r.error.code === "NAMUE_SERVER" || r.error.code === "NAMUE_SESSION") setConnected(false);
    return;
  }
  state.totalItems = r.data.meta.totalItems;
  state.totalPages = r.data.meta.totalPages;
  state.nextPage = r.data.meta.currentPage + 1;
  if (state.totalItems === 0) {
    const msg = document.createElement("div");
    msg.className = "no-results";
    msg.textContent = t().noResults;
    ($("#result") as HTMLDivElement).append(msg);
    setCountInButton(0); showTagline();
    return;
  }
  renderRows(r.data, false);
  setCountInButton(state.totalItems); showTagline();
}

let lazyLoading = false;
async function loadMore(): Promise<void> {
  if (lazyLoading || !state) return;
  if (currentResults.length >= state.totalItems) return;
  lazyLoading = true;
  setBodyClass("lazy-loading", true);
  const r = await send<DwSearchPage>(buildSearchRequest(state));
  setBodyClass("lazy-loading", false);
  lazyLoading = false;
  if (!r.ok) { showStatus(t().errorPrefix(r.error.message), "err"); return; }
  state.nextPage = r.data.meta.currentPage + 1;
  renderRows(r.data, true);
  setCountInButton(state.totalItems);
  showTagline();
}

// ── Language toggle ─────────────────────────────────────────────────────────
async function toggleLang(): Promise<void> {
  // Snapshot BEFORE renderRows mutates currentResults — without this, the
  // detail re-render below would read empty arrays.
  const savedResults = [...currentResults];
  const savedDetail = lastDetail;
  const savedIndex = currentDetailIndex;

  lang = lang === "en" ? "th" : "en";
  await persistLang(lang);
  applyStaticStrings();
  populateProvinces();

  if (savedResults.length > 0) {
    // Re-render rows from cached data — no network round-trip. renderRows
    // resets currentResults itself when called with append=false.
    renderRows(
      { meta: { currentPage: 0, totalItems: 0, totalPages: 0, itemsPerPage: 0 }, contents: savedResults },
      false,
    );
    if (state) setCountInButton(state.totalItems);
    showTagline();
  }
  if (savedDetail) {
    currentDetailIndex = savedIndex;
    renderDetailPanel(
      savedDetail.profile,
      savedDetail.objectives,
      savedDetail.committees,
      savedDetail.partners,
      savedDetail.nations,
    );
  }
}

// ── Wiring ──────────────────────────────────────────────────────────────────
$("#go").addEventListener("click", () => { void runFirstPage(); });
$("#connect").addEventListener("click", () => { void connect(); });
// Wire ALL lang toggles — brand-row (visible at startup) + filters-panel
// (always reachable via chevron). Both point at the same toggleLang.
document.querySelectorAll(".lang-toggle").forEach((btn) => {
  btn.addEventListener("click", () => { void toggleLang(); });
});
// As soon as the user edits the query, the search button reverts from
// its count-pill face back to the lens icon.
$("#q").addEventListener("input", () => { setCountInButton(null); });
$("#detail-back").addEventListener("click", () => closeDetail());
$("#detail-prev").addEventListener("click", () => { void openDetailByIndex(currentDetailIndex - 1, "prev"); });
$("#detail-next").addEventListener("click", () => { void openDetailByIndex(currentDetailIndex + 1, "next"); });

// Lazy-load: when the user scrolls near the bottom of the result list,
// fire loadMore. The `lazyLoading` flag prevents concurrent requests.
$("#result").addEventListener("scroll", () => {
  const el = $("#result") as HTMLDivElement;
  if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) {
    void loadMore();
  }
});

// ── Copy and share — clipboard actions on the detail header ────────────
async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    showToast(t().copied);
  } catch {
    showToast("clipboard blocked");
  }
}

function profileAsText(d: { profile: DwProfileDetail; objectives: DwObjective[]; committees: DwCommittee[] }): string {
  const p = d.profile;
  const lines: string[] = [];
  const name = lang === "th" ? p.name : (p.nameEn ?? p.name);
  lines.push(name);
  lines.push(p.juristicId);
  if (p.province) lines.push(lang === "th" ? p.province.nameTh : p.province.nameEn);
  const addr = formatAddress(p);
  if (addr) lines.push(addr);
  if (p.registrationDate) {
    const reg = formatDate(p.registrationDate, lang) ?? p.registrationDate;
    if (p.dissolutionDate) {
      const diss = formatDate(p.dissolutionDate, lang) ?? p.dissolutionDate;
      lines.push(t().dissolvedOn(diss, reg));
    } else {
      lines.push(t().operatingSince(reg));
    }
  }
  if (d.committees.length > 0) {
    lines.push("");
    lines.push(t().sectionDirectors(d.committees.length));
    for (const c of d.committees) lines.push(`  · ${committeeName(c)}`);
  }
  return lines.join("\n");
}

$("#detail-copy").addEventListener("click", () => {
  if (!lastDetail) return;
  void copyText(lastDetail.profile.juristicId);
});

$("#detail-share").addEventListener("click", () => {
  if (!lastDetail) return;
  void copyText(profileAsText(lastDetail));
});
$("#q").addEventListener("keydown", (e) => {
  if ((e as KeyboardEvent).key === "Enter") void runFirstPage();
});
document.addEventListener("keydown", (e) => {
  if (!document.body.classList.contains("detail-mode")) return;
  const k = (e as KeyboardEvent).key;
  if (k === "ArrowLeft" || k === "ArrowUp") {
    e.preventDefault();
    void openDetailByIndex(currentDetailIndex - 1, "prev");
  } else if (k === "ArrowRight" || k === "ArrowDown") {
    e.preventDefault();
    void openDetailByIndex(currentDetailIndex + 1, "next");
  } else if (k === "Escape") {
    e.preventDefault();
    closeDetail();
  }
});

async function init(): Promise<void> {
  await hydrateLang();
  applyStaticStrings();
  populateProvinces();
  await checkStatus();
}

void init();
