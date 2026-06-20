// Bilingual UI strings for the Namue popup. UI chrome only — DBD payload
// (company names, addresses) is rendered as-returned, with TH/EN primacy
// flipped based on the active language.
//
// Add a key here and the typecheck enforces it exists in both languages.

export type Lang = "th" | "en";

export const STORAGE_KEY = "namue.lang.v1";

interface Strings {
  // Brand
  tagline: string;
  // Connection
  checking: string;
  openingDbd: string;
  notConnected: string;
  connectButton: string;
  connectFailed: (msg: string) => string;
  // Search row
  searchPlaceholder: string;
  translateTitle: string;
  filtersTitle: string;
  // Filters
  province: string;
  provincePlaceholder: string;
  status: string;
  activeOnly: string;
  // Results
  searching: string;
  loadingPage: (n: number) => string;
  resultsLine: (total: number, page: number, totalPages: number) => string;
  shownOfTotal: (shown: number, total: number) => string;
  notConnectedClickConnect: string;
  noEnName: string;
  // Detail navigation
  recordPosition: (n: number, m: number) => string;
  backToList: string;
  prevRecord: string;
  nextRecord: string;
  // Language toggle tooltip
  switchTooltip: string;
  // Counter labels
  counterUnit: string;           // "found" / "รายการ"
  searchingShort: string;        // "searching" / "กำลังค้นหา"
  loadingDetailShort: string;    // "loading" / "กำลังโหลด"
  loadingMoreShort: string;      // "loading more" / "กำลังโหลดเพิ่ม"
  // Detail body
  operatingSince: (date: string) => string;
  dissolvedOn: (dissolutionDate: string, registrationDate: string) => string;
  sectionDirectors: (n: number) => string;
  noDirectors: string;
  // Detail header actions
  copyTooltip: string;
  shareTooltip: string;
  // Copy / share feedback
  copied: string;
  // Detail page
  loadingDetail: string;
  backToResults: string;
  sectionStatus: string;
  sectionDates: string;
  sectionAddress: string;
  sectionObjectives: (n: number) => string;
  sectionNationality: (n: number) => string;
  sectionShareholders: (n: number) => string;
  noResults: string;
  registered: string;
  dissolved: string;
  unknown: string;
  noAddress: string;
  // Errors
  errorPrefix: (msg: string) => string;
  loadMore: string;
  // Footer
  footerData: string;
  // Language toggle
  switchTo: string;
}

export const STRINGS: Record<Lang, Strings> = {
  en: {
    tagline: "Thai/English business names",
    checking: "checking…",
    openingDbd: "opening DBD…",
    notConnected: "not connected — click Connect to open DBD",
    connectButton: "Connect to DBD",
    connectFailed: (msg) => `connect failed — ${msg}`,
    searchPlaceholder: "company name, or 13-digit tax ID",
    translateTitle: "Translate",
    filtersTitle: "Toggle filters",
    province: "Province",
    provincePlaceholder: "All Provinces",
    status: "Status",
    activeOnly: "Active companies only",
    searching: "searching…",
    loadingPage: (n) => `loading page ${n}…`,
    resultsLine: (total, page, totalPages) =>
      `${total} result${total === 1 ? "" : "s"} · page ${page} of ${totalPages}`,
    shownOfTotal: (shown, total) => `${shown} of ${total} shown`,
    notConnectedClickConnect: "not connected — click Connect first",
    noEnName: "(no English form on file)",
    loadingDetail: "loading detail…",
    backToResults: "← back to results",
    sectionStatus: "Status",
    sectionDates: "Dates",
    sectionAddress: "Address",
    sectionObjectives: (n) => `Objectives (${n})`,
    sectionNationality: (n) => `Shareholder nationality (${n})`,
    sectionShareholders: (n) => `Shareholders (${n})`,
    noResults: "no companies found",
    registered: "Registered",
    dissolved: "Dissolved",
    unknown: "(unknown)",
    noAddress: "(no address on file)",
    errorPrefix: (msg) => `error — ${msg}`,
    loadMore: "Load more",
    footerData: "data: DBD DataWarehouse+ ·",
    switchTo: "TH",
    recordPosition: (n, m) => `Record ${n} of ${m}`,
    backToList: "← back to list",
    prevRecord: "previous record",
    nextRecord: "next record",
    switchTooltip: "Switch to Thai",
    counterUnit: "found",
    searchingShort: "searching",
    loadingDetailShort: "loading",
    loadingMoreShort: "loading more",
    operatingSince: (d) => `Operating since ${d}.`,
    dissolvedOn: (d, r) => `Dissolved on ${d} (registered ${r}).`,
    sectionDirectors: (n) => `Directors (${n})`,
    noDirectors: "(no directors on file)",
    copyTooltip: "Copy tax ID",
    shareTooltip: "Share / copy profile",
    copied: "copied",
  },
  th: {
    tagline: "ชื่อธุรกิจไทย/อังกฤษ",
    checking: "กำลังตรวจสอบ…",
    openingDbd: "กำลังเปิด DBD…",
    notConnected: "ยังไม่ได้เชื่อมต่อ — คลิก Connect เพื่อเปิด DBD",
    connectButton: "เชื่อมต่อ DBD",
    connectFailed: (msg) => `เชื่อมต่อล้มเหลว — ${msg}`,
    searchPlaceholder: "ชื่อบริษัท หรือเลขทะเบียน 13 หลัก",
    translateTitle: "ค้นหา",
    filtersTitle: "ตัวกรอง",
    province: "จังหวัด",
    provincePlaceholder: "ทุกจังหวัด",
    status: "สถานะ",
    activeOnly: "เฉพาะที่ยังดำเนินกิจการ",
    searching: "กำลังค้นหา…",
    loadingPage: (n) => `กำลังโหลดหน้า ${n}…`,
    resultsLine: (total, page, totalPages) =>
      `${total} รายการ · หน้า ${page} จาก ${totalPages}`,
    shownOfTotal: (shown, total) => `แสดง ${shown} จาก ${total}`,
    notConnectedClickConnect: "ยังไม่ได้เชื่อมต่อ — คลิก Connect ก่อน",
    noEnName: "(ไม่มีชื่อภาษาอังกฤษในระบบ)",
    loadingDetail: "กำลังโหลดรายละเอียด…",
    backToResults: "← กลับสู่ผลการค้นหา",
    sectionStatus: "สถานะ",
    sectionDates: "วันที่",
    sectionAddress: "ที่อยู่",
    sectionObjectives: (n) => `วัตถุประสงค์ (${n})`,
    sectionNationality: (n) => `สัญชาติผู้ถือหุ้น (${n})`,
    sectionShareholders: (n) => `ผู้ถือหุ้น (${n})`,
    noResults: "ไม่พบบริษัท",
    registered: "จดทะเบียน",
    dissolved: "เลิกกิจการ",
    unknown: "(ไม่ทราบ)",
    noAddress: "(ไม่มีที่อยู่ในระบบ)",
    errorPrefix: (msg) => `ข้อผิดพลาด — ${msg}`,
    loadMore: "โหลดเพิ่ม",
    footerData: "ข้อมูล: DBD DataWarehouse+ ·",
    switchTo: "EN",
    recordPosition: (n, m) => `รายการ ${n} จาก ${m}`,
    backToList: "← กลับสู่รายการ",
    prevRecord: "รายการก่อนหน้า",
    nextRecord: "รายการถัดไป",
    switchTooltip: "เปลี่ยนเป็นภาษาอังกฤษ",
    counterUnit: "รายการ",
    searchingShort: "กำลังค้นหา",
    loadingDetailShort: "กำลังโหลด",
    loadingMoreShort: "กำลังโหลดเพิ่ม",
    operatingSince: (d) => `ดำเนินกิจการตั้งแต่ ${d}`,
    dissolvedOn: (d, r) => `เลิกกิจการเมื่อ ${d} (จดทะเบียน ${r})`,
    sectionDirectors: (n) => `กรรมการ (${n})`,
    noDirectors: "(ไม่มีรายชื่อกรรมการในระบบ)",
    copyTooltip: "คัดลอกเลขทะเบียน",
    shareTooltip: "แชร์/คัดลอกโปรไฟล์",
    copied: "คัดลอกแล้ว",
  },
};

/**
 * Map DBD's status code → label in the active language. The search-list
 * endpoint only returns the Thai description; without this mapping the
 * EN-mode UI would leak Thai characters into the meta line. Codes follow
 * DBD's jpStatCode convention.
 */
const STATUS_LABELS: Record<string, { en: string; th: string }> = {
  "1": { en: "Operating", th: "ยังดำเนินกิจการอยู่" },
  "2": { en: "Suspended", th: "หยุดดำเนินกิจการ" },
  "3": { en: "Dissolution", th: "เลิกกิจการ" },
  "4": { en: "Liquidation", th: "ชำระบัญชี" },
  "5": { en: "Defunct", th: "ร้าง" },
  "6": { en: "Bankruptcy", th: "ล้มละลาย" },
  "7": { en: "Cancelled", th: "ถูกเพิกถอน" },
  "8": { en: "Bankruptcy proceedings", th: "พิทักษ์ทรัพย์" },
  "9": { en: "Other", th: "อื่นๆ" },
};

export function statusLabel(code: string, descTh: string, lang: Lang): string {
  const entry = STATUS_LABELS[code];
  if (entry) return entry[lang];
  // Unknown code — fall back to whatever DBD gave us if in TH mode, else
  // a generic label. Better than leaking Thai into the EN UI.
  return lang === "th" ? descTh : "Other";
}

export function loadLang(): Lang {
  // Synchronous fallback only — chrome.storage.local is async, callers should
  // hydrate the persisted value before first render. This is the boot default.
  const navLang = (globalThis.navigator?.language ?? "").toLowerCase();
  return navLang.startsWith("th") ? "th" : "en";
}

/**
 * Convert a Gregorian ISO date "YYYY-MM-DD" to a Buddhist Era date string
 * "YYYY-MM-DD" with year + 543. Used in Thai mode so 2024 reads as 2567
 * (the year Thai users actually see on official documents).
 */
export function toBuddhistDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return isoDate;
  const y = Number(m[1]) + 543;
  return `${y}-${m[2]}-${m[3]}`;
}

export function formatDate(isoDate: string | null, lang: Lang): string | null {
  if (!isoDate) return null;
  return lang === "th" ? toBuddhistDate(isoDate) : isoDate;
}
