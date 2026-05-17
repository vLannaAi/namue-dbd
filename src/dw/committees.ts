import type { DwCommittee } from "./types.ts";

type Obj = Record<string, unknown>;

function strOrNull(obj: Obj, key: string): string | null {
  const v = obj[key];
  if (v === null || v === undefined) return null;
  return typeof v === "string" ? v : null;
}

function numOrNull(obj: Obj, key: string): number | null {
  const v = obj[key];
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Strip trailing slashes/whitespace — DW occasionally suffixes lastName with "/".
function cleanNameStr(s: string): string {
  return s.replace(/[\s/]+$/, "").trim();
}

function buildFullName(
  titleName: string | null,
  firstName: string,
  middleName: string | null,
  lastName: string,
): string {
  const parts = [titleName, firstName, middleName || undefined, lastName].filter(Boolean);
  return parts.join(" ");
}

export function parseCommittees(raw: unknown): DwCommittee[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const o = (item !== null && typeof item === "object" && !Array.isArray(item)) ? item as Obj : {};
    const firstName  = cleanNameStr(strOrNull(o, "firstName") ?? "");
    const lastName   = cleanNameStr(strOrNull(o, "lastName") ?? "");
    const middleName = strOrNull(o, "middleName") ? cleanNameStr(strOrNull(o, "middleName")!) || null : null;
    const titleName  = strOrNull(o, "titleName") || null;
    const firstNameE = strOrNull(o, "firstNameE") ? cleanNameStr(strOrNull(o, "firstNameE")!) || null : null;
    const lastNameE  = strOrNull(o, "lastNameE") ? cleanNameStr(strOrNull(o, "lastNameE")!) || null : null;
    return {
      cmtTypeCode: strOrNull(o, "cmtTypeCode"),
      cmtSeq: numOrNull(o, "cmtSeq"),
      firstName,
      firstNameE,
      middleName,
      middleNameE: strOrNull(o, "middleNameE") ? cleanNameStr(strOrNull(o, "middleNameE")!) || null : null,
      lastName,
      lastNameE,
      titleName,
      titleNameE: strOrNull(o, "titleNameE") || null,
      titleCode: strOrNull(o, "titleCode"),
      ntCode: strOrNull(o, "ntCode"),
      fullName: buildFullName(titleName, firstName, middleName, lastName),
    };
  });
}
