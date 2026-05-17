import { NetworkError, ServerError, TimeoutError } from "../errors.ts";
import type { DwSession } from "./auth.ts";
import { decrypt, type DwEnvelope } from "./crypto.ts";
import { buildSearchBody, parseSearchPage } from "./search.ts";
import { parseCommittees } from "./committees.ts";
import { parseProfileDetail, parseDescriptions } from "./profile.ts";
import type { DwSearchPage, SearchOptions, DwCommittee, DwProfileDetail, DwObjective } from "./types.ts";

const BASE_URL = "https://datawarehouse.dbd.go.th";

export interface NamueDwClientOptions {
  session: DwSession;
  fetch?: typeof fetch;
  timeoutMs?: number;
  _decryptForTest?: (envelope: DwEnvelope, url: string, session: DwSession) => Promise<unknown>;
}

export class NamueDwClient {
  private readonly _session: DwSession;
  private readonly _fetch: typeof fetch;
  private readonly _timeoutMs: number;
  private readonly _decrypt: (envelope: DwEnvelope, url: string, session: DwSession) => Promise<unknown>;

  constructor(opts: NamueDwClientOptions) {
    this._session = opts.session;
    // Bind to globalThis — calling `this._fetch(...)` would otherwise pass the
    // NamueDwClient instance as the receiver, and fetch throws "Illegal
    // invocation" if `this` isn't the global (Window / WorkerGlobalScope).
    const f = opts.fetch ?? globalThis.fetch;
    this._fetch = f.bind(globalThis);
    this._timeoutMs = opts.timeoutMs ?? 30_000;
    this._decrypt = opts._decryptForTest ?? decrypt;
  }

  async searchByName(keyword: string, opts?: SearchOptions): Promise<DwSearchPage> {
    const body = buildSearchBody(keyword, opts);
    const raw = await this._request("POST", "/api/v1/company-profiles/infos", body);
    return parseSearchPage(raw);
  }

  async getProfileDetail(typeCode: string, juristicId: string): Promise<DwProfileDetail> {
    const path = `/api/v1/company-profiles/info/${encodeURIComponent(typeCode)}/${encodeURIComponent(juristicId)}`;
    const raw = await this._request("GET", path);
    return parseProfileDetail(raw);
  }

  async getDescriptions(typeCode: string, juristicId: string): Promise<DwObjective[]> {
    const path = `/api/v1/company-profiles/descriptions/${encodeURIComponent(typeCode)}/${encodeURIComponent(juristicId)}`;
    const raw = await this._request("GET", path);
    return parseDescriptions(raw);
  }

  async getCommittees(typeCode: string, juristicId: string): Promise<DwCommittee[]> {
    const path = `/api/v1/company-profiles/committees/${encodeURIComponent(typeCode)}/${encodeURIComponent(juristicId)}`;
    const raw = await this._request("GET", path);
    return parseCommittees(raw);
  }

  // ── Raw-JSON endpoints ──────────────────────────────────────────────────
  // These pass through DBD's decrypted response unmodified. Bilingual fields
  // ship as-is — TH and EN both present in every record. The consumer
  // parses or transforms (geocoding, currency formatting, etc.).

  async getCommitteeSigns(typeCode: string, juristicId: string): Promise<unknown> {
    return this._request("GET", `/api/v1/company-profiles/committee-signs/${encodeURIComponent(typeCode)}/${encodeURIComponent(juristicId)}`);
  }
  async getPartners(typeCode: string, juristicId: string): Promise<unknown> {
    return this._request("GET", `/api/v1/company-profiles/partners/${encodeURIComponent(typeCode)}/${encodeURIComponent(juristicId)}`);
  }
  async getNameHistory(typeCode: string, juristicId: string): Promise<unknown> {
    return this._request("GET", `/api/v1/company-profiles/names/${encodeURIComponent(typeCode)}/${encodeURIComponent(juristicId)}`);
  }
  async getCapitalHistory(typeCode: string, juristicId: string): Promise<unknown> {
    return this._request("GET", `/api/v1/company-profiles/capitals/${encodeURIComponent(typeCode)}/${encodeURIComponent(juristicId)}`);
  }
  async getNations(typeCode: string, juristicId: string): Promise<unknown> {
    return this._request("GET", `/api/v1/company-profiles/nations/${encodeURIComponent(typeCode)}/${encodeURIComponent(juristicId)}`);
  }
  async getMergers(typeCode: string, juristicId: string): Promise<unknown> {
    return this._request("GET", `/api/v1/company-profiles/mergers/${encodeURIComponent(typeCode)}/${encodeURIComponent(juristicId)}`);
  }
  async getLiquidators(typeCode: string, juristicId: string): Promise<unknown> {
    return this._request("GET", `/api/v1/company-profiles/liquidators/${encodeURIComponent(typeCode)}/${encodeURIComponent(juristicId)}`);
  }
  /**
   * Balance-sheet + income-statement aggregates. DBD always returns the
   * canonical 5-year window in a single call; the fiscalYear query is
   * required by the API but ignored for filtering. We pin to the current
   * Buddhist year so the URL is well-formed.
   */
  async getBalanceSheets(typeCode: string, juristicId: string): Promise<unknown> {
    const beYear = new Date().getFullYear() + 543;
    return this._request("GET", `/api/v1/fin/balancesheet/year/${encodeURIComponent(typeCode)}/${encodeURIComponent(juristicId)}?fiscalYear=${beYear}`);
  }
  async getFinancialSubmissions(typeCode: string, juristicId: string): Promise<unknown> {
    const beYear = new Date().getFullYear() + 543;
    return this._request("GET", `/api/v1/fin/submit/${encodeURIComponent(typeCode)}/${encodeURIComponent(juristicId)}?fiscalYear=${beYear}`);
  }

  private async _request(method: "GET" | "POST", path: string, body?: unknown): Promise<unknown> {
    const url = `${BASE_URL}${path}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this._timeoutMs);
    let res: Response;
    try {
      const headers: Record<string, string> = {
        "Accept": "application/json, text/plain, */*",
        "Authorization": `Bearer ${this._session.idToken}`,
      };
      const init: RequestInit = {
        method,
        headers,
        credentials: "include",
        signal: ctrl.signal,
      };
      if (body !== undefined) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(body);
      }
      res = await this._fetch(url, init);
    } catch (err) {
      if (ctrl.signal.aborted) {
        throw new TimeoutError(`${method} ${path} timed out after ${this._timeoutMs}ms`, { cause: err });
      }
      throw new NetworkError(`Network error on ${method} ${path}: ${(err as Error).message}`, { cause: err });
    } finally {
      clearTimeout(timer);
    }

    if (res.status >= 500) {
      throw new ServerError(`Server error ${res.status} on ${method} ${path}`, { status: res.status });
    }
    if (!res.ok) {
      throw new ServerError(`Unexpected ${res.status} on ${method} ${path}`, { status: res.status });
    }

    // Race against a manual timeout — AbortSignal doesn't always interrupt an
    // in-progress res.json() over HTTPS, so we belt-and-braces with Promise.race.
    let bodyTimer: ReturnType<typeof setTimeout> | undefined;
    const envelope = await Promise.race([
      res.json().finally(() => { if (bodyTimer !== undefined) clearTimeout(bodyTimer); }),
      new Promise<never>((_, reject) => {
        bodyTimer = setTimeout(
          () => reject(new TimeoutError(`Body read for ${method} ${path} stalled after ${this._timeoutMs}ms`)),
          this._timeoutMs,
        );
      }),
    ]) as DwEnvelope;
    return this._decrypt(envelope, url, this._session);
  }
}
