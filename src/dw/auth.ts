import { NetworkError, ServerError, TimeoutError } from "../errors.ts";

export interface DwSession {
  idToken: string;
  encKey: Uint8Array<ArrayBuffer>;
  expiresAt: number;
}

interface JwtPayload {
  encKey: string;
  exp: number;
}

const BASE_URL = "https://datawarehouse.dbd.go.th";

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function parseJwt(token: string): JwtPayload {
  const part = token.split(".")[1] ?? "";
  const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return JSON.parse(atob(padded)) as JwtPayload;
}

export const parseJwtForTest = parseJwt;
export const fromBase64UrlForTest = fromBase64Url;

export async function refreshSession(timeoutMs: number = 30_000): Promise<DwSession> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/refresh`, {
      method: "POST",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Origin": BASE_URL,
        "Referer": `${BASE_URL}/`,
      },
      credentials: "include",
      signal: ctrl.signal,
    });
  } catch (err) {
    if (ctrl.signal.aborted) {
      throw new TimeoutError(`POST /api/refresh timed out after ${timeoutMs}ms`, { cause: err });
    }
    throw new NetworkError(`Network error on POST /api/refresh: ${(err as Error).message}`, { cause: err });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new ServerError(`Unexpected ${res.status} on POST /api/refresh`, { status: res.status });
  }
  // Race body read against a manual timeout — AbortSignal doesn't always
  // interrupt in-progress res.json() over HTTPS. /api/refresh is tiny but
  // we keep the pattern consistent with the rest of the client.
  let bodyTimer: ReturnType<typeof setTimeout> | undefined;
  const body = await Promise.race([
    res.json().finally(() => { if (bodyTimer !== undefined) clearTimeout(bodyTimer); }),
    new Promise<never>((_, reject) => {
      bodyTimer = setTimeout(
        () => reject(new TimeoutError(`Body read for /api/refresh stalled after ${timeoutMs}ms`)),
        timeoutMs,
      );
    }),
  ]) as { idToken: string };
  const payload = parseJwt(body.idToken);
  return { idToken: body.idToken, encKey: fromBase64Url(payload.encKey), expiresAt: payload.exp * 1000 };
}
