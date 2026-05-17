import { ValidationError } from "./errors.ts";

export const PROTOCOL_VERSION = 1;

export const CAPABILITIES = Object.freeze({
  protocolVersion: PROTOCOL_VERSION,
  services: Object.freeze([
    "translate.company",
    "translate.director",
    "company.detail",
    "company.full",
    "session.status",
    "session.ensure",
  ] as const),
});

export type RpcRequest =
  | { type: "capabilities" }
  | { type: "session.status" }
  | { type: "session.ensure" }
  | {
      type: "translate";
      scope: "company";
      query: string;
      page?: number;
      pvCodeList?: string[];
      jpStatusList?: string[];
    }
  | { type: "translate"; scope: "director"; juristicId: string; typeCode: string }
  | { type: "company.detail"; juristicId: string; typeCode: string }
  | { type: "company.full"; juristicId: string; typeCode: string };

export type RpcResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

function asObj(v: unknown): Record<string, unknown> {
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    throw new ValidationError("Expected request object");
  }
  return v as Record<string, unknown>;
}

function asString(v: unknown, field: string): string {
  if (typeof v !== "string" || v.length === 0) {
    throw new ValidationError(`Expected non-empty string at .${field}`);
  }
  return v;
}

export function validateRequest(raw: unknown): RpcRequest {
  const o = asObj(raw);
  const type = o["type"];
  switch (type) {
    case "capabilities":
      return { type: "capabilities" };
    case "session.status":
      return { type: "session.status" };
    case "session.ensure":
      return { type: "session.ensure" };
    case "company.detail":
      return {
        type: "company.detail",
        juristicId: asString(o["juristicId"], "juristicId"),
        typeCode: asString(o["typeCode"], "typeCode"),
      };
    case "company.full":
      return {
        type: "company.full",
        juristicId: asString(o["juristicId"], "juristicId"),
        typeCode: asString(o["typeCode"], "typeCode"),
      };
    case "translate": {
      const scope = o["scope"];
      if (scope === "company") {
        const req: RpcRequest = { type: "translate", scope: "company", query: asString(o["query"], "query") };
        if (typeof o["page"] === "number") {
          (req as { page?: number }).page = o["page"];
        }
        const pv = o["pvCodeList"];
        if (Array.isArray(pv) && pv.every((x) => typeof x === "string") && pv.length > 0) {
          (req as { pvCodeList?: string[] }).pvCodeList = pv as string[];
        }
        const st = o["jpStatusList"];
        if (Array.isArray(st) && st.every((x) => typeof x === "string") && st.length > 0) {
          (req as { jpStatusList?: string[] }).jpStatusList = st as string[];
        }
        return req;
      }
      if (scope === "director") {
        return {
          type: "translate",
          scope: "director",
          juristicId: asString(o["juristicId"], "juristicId"),
          typeCode: asString(o["typeCode"], "typeCode"),
        };
      }
      throw new ValidationError(`Unknown scope: ${String(scope)}`);
    }
    default:
      throw new ValidationError(`Unknown type: ${String(type)}`);
  }
}
