import { ParseError } from "../errors.ts";
import type { DwProfileDetail, DwObjective, DwLocationPart } from "./types.ts";

type Obj = Record<string, unknown>;

function requireObj(v: unknown, ctx: string): Obj {
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    throw new ParseError(`Expected object at ${ctx}`);
  }
  return v as Obj;
}

function str(obj: Obj, key: string): string {
  const v = obj[key];
  if (typeof v !== "string") throw new ParseError(`Expected string at .${key}`);
  return v;
}

function strOrNull(obj: Obj, key: string): string | null {
  const v = obj[key];
  if (v === null || v === undefined) return null;
  return typeof v === "string" ? v : null;
}

/**
 * DBD's profile endpoint returns dates as either:
 *   - a 3-tuple [year, month, day] of numbers, OR
 *   - a "YYYYMMDD" string.
 *
 * Returns ISO 8601 "YYYY-MM-DD" or null if not present / unparseable.
 */
function parseDate(obj: Obj, key: string): string | null {
  const v = obj[key];
  if (v === null || v === undefined) return null;
  if (Array.isArray(v) && v.length >= 3) {
    const [y, m, d] = v as [unknown, unknown, unknown];
    if (typeof y === "number" && typeof m === "number" && typeof d === "number") {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    return null;
  }
  if (typeof v === "string" && /^\d{8}$/.test(v)) {
    return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  }
  return null;
}

function parseLocationPart(v: unknown, codeKey: string, thKey: string, enKey: string): DwLocationPart | null {
  if (v === null || v === undefined || typeof v !== "object" || Array.isArray(v)) return null;
  const o = v as Obj;
  const code = strOrNull(o, codeKey);
  const nameTh = strOrNull(o, thKey);
  const nameEn = strOrNull(o, enKey);
  if (code === null && nameTh === null && nameEn === null) return null;
  return { code: code ?? "", nameTh: nameTh ?? "", nameEn: nameEn ?? "" };
}

export function parseProfileDetail(raw: unknown): DwProfileDetail {
  const o = requireObj(raw, "DwProfileDetail");
  const statusObj = (o["jpStatus"] !== null && typeof o["jpStatus"] === "object" && !Array.isArray(o["jpStatus"]))
    ? o["jpStatus"] as Obj
    : ({} as Obj);
  return {
    juristicId: str(o, "jpNo"),
    typeCode: str(o, "jpTypeCode"),
    name: str(o, "jpName"),
    nameEn: strOrNull(o, "jpNameE"),
    status: {
      code: strOrNull(statusObj, "jpStatCode") ?? strOrNull(o, "jpStatCode") ?? "",
      descTh: strOrNull(statusObj, "jpStatDesc") ?? "",
      descEn: strOrNull(statusObj, "jpStatDescE"),
    },
    registrationDate: parseDate(o, "regDate"),
    dissolutionDate: parseDate(o, "closeDate"),
    addressTh: strOrNull(o, "address"),
    addressEn: strOrNull(o, "addressE"),
    province: parseLocationPart(o["locationProvince"], "pvCode", "pvDesc", "pvDescE"),
    district: parseLocationPart(o["locationAmpur"], "ampurCode", "ampurDesc", "ampurDescE"),
    subdistrict: parseLocationPart(o["locationTumbon"], "tumbonCode", "tumbonDesc", "tumbonDescE"),
    zipCode: strOrNull(o, "zipCode"),
  };
}

export function parseDescriptions(raw: unknown): DwObjective[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const o = (item !== null && typeof item === "object" && !Array.isArray(item)) ? item as Obj : {};
    return {
      code: strOrNull(o, "objectiveCode") ?? strOrNull(o, "tsicCode") ?? strOrNull(o, "isicCode"),
      description: strOrNull(o, "description") ?? strOrNull(o, "objectiveDesc") ?? strOrNull(o, "desc") ?? "",
    };
  });
}
