import { ParseError } from "../errors.ts";
import type { SearchOptions, DwSearchPage } from "./types.ts";

interface SearchBody {
  keyword: string;
  type: string;
  sortBy: string;
  currentPage: number;
  pvCodeList?: string[];
  jpStatusList?: string[];
}

/**
 * DBD's /infos endpoint matches against an indexed form with all
 * non-alphanumeric characters (spaces, punctuation, hyphens) stripped, but
 * does NOT strip the same characters from the submitted keyword. So a query
 * of "LANNA AI" looks for the literal substring "LANNA AI" in an index that
 * stores "LANNAAICOLTD..." and finds nothing. Stripping non-alphanumeric on
 * our side matches the server's normalization. Verified empirically against
 * "lanna ai" (0 hits) vs "lannaai" (4 hits) and the Thai equivalents.
 *
 * \p{L} = any Unicode letter (covers Latin + Thai), \p{N} = any Unicode digit.
 */
export function normalizeKeyword(keyword: string): string {
  return keyword.replace(/[^\p{L}\p{N}]/gu, "").toUpperCase();
}

export function buildSearchBody(keyword: string, opts?: SearchOptions): SearchBody {
  const body: SearchBody = {
    keyword: normalizeKeyword(keyword),
    type: opts?.type ?? "",
    sortBy: opts?.sortBy ?? "jpName",
    currentPage: opts?.page ?? 1,
  };
  if (opts?.pvCodeList && opts.pvCodeList.length > 0) body.pvCodeList = opts.pvCodeList;
  if (opts?.jpStatusList && opts.jpStatusList.length > 0) body.jpStatusList = opts.jpStatusList;
  return body;
}

function requireObj(raw: unknown, ctx: string): Record<string, unknown> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ParseError(`Expected object at ${ctx}, got ${typeof raw}`);
  }
  return raw as Record<string, unknown>;
}

function str(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== "string") throw new ParseError(`Expected string at .${key}`);
  return v;
}

function strOrNull(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  if (v === null || v === undefined) return null;
  return typeof v === "string" ? v : null;
}

export function parseSearchPage(raw: unknown): DwSearchPage {
  const obj = requireObj(raw, "DwSearchPage");
  const meta = requireObj(obj["meta"], "DwSearchPage.meta");
  const contentsRaw = obj["contents"];
  if (!Array.isArray(contentsRaw)) throw new ParseError("Expected array at DwSearchPage.contents");
  return {
    meta: {
      currentPage: Number(meta["currentPage"]),
      totalItems: Number(meta["totalItems"]),
      totalPages: Number(meta["totalPages"]),
      itemsPerPage: Number(meta["itemsPerPage"]),
    },
    contents: contentsRaw.map((item, i) => {
      const r = requireObj(item, `contents[${i}]`);
      const statusObj = requireObj(r["jpStatus"], `contents[${i}].jpStatus`);
      return {
        juristicId: str(r, "jpNo"),
        typeCode: str(r, "jpTypeCode"),
        name: str(r, "jpName"),
        nameEn: strOrNull(r, "jpNameE"),
        status: { code: str(statusObj, "jpStatCode"), description: str(statusObj, "jpStatDesc") },
        provinceCode: str(r, "pvCode"),
      };
    }),
  };
}
