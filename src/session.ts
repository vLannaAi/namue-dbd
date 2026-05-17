import { refreshSession, type DwSession } from "./dw/auth.ts";

const STORAGE_KEY = "namue.session.v1";

interface StoredSession {
  idToken: string;
  encKeyB64: string;
  expiresAt: number;
}

let inMemory: DwSession | null = null;
let refreshInFlight: Promise<DwSession> | null = null;

function toB64(bytes: Uint8Array<ArrayBuffer>): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function loadStored(): Promise<DwSession | null> {
  const got = await chrome.storage.local.get(STORAGE_KEY);
  const raw = got[STORAGE_KEY];
  if (!raw) return null;
  const s = raw as StoredSession;
  return { idToken: s.idToken, encKey: fromB64(s.encKeyB64), expiresAt: s.expiresAt };
}

async function saveStored(s: DwSession): Promise<void> {
  const v: StoredSession = {
    idToken: s.idToken,
    encKeyB64: toB64(s.encKey),
    expiresAt: s.expiresAt,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: v });
}

/**
 * Returns a session usable for >=60s. Refreshes if expiring or missing.
 * Throws if refresh fails — caller decides whether to bootstrap cookies.
 */
export async function getSession(): Promise<DwSession> {
  if (inMemory && inMemory.expiresAt >= Date.now() + 60_000) return inMemory;
  if (!inMemory) {
    const stored = await loadStored();
    if (stored && stored.expiresAt >= Date.now() + 60_000) {
      inMemory = stored;
      return inMemory;
    }
  }
  return refresh();
}

export async function refresh(): Promise<DwSession> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const s = await refreshSession();
      inMemory = s;
      await saveStored(s);
      return s;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export async function clearSession(): Promise<void> {
  inMemory = null;
  await chrome.storage.local.remove(STORAGE_KEY);
}
