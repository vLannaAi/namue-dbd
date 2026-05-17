import { DecryptionError } from "../errors.ts";
import type { DwSession } from "./auth.ts";

export interface DwEnvelope {
  kid: number;
  salt: string;
  iv: string;
  ct: string;
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function gunzip(compressed: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  // pipeThrough wires the reader before any byte is written, so this never
  // deadlocks. The naive getWriter/write/close pattern hangs on payloads larger
  // than the writer's internal buffer.
  const stream = new Response(compressed).body!.pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function decrypt(envelope: DwEnvelope, requestUrl: string, session: DwSession): Promise<unknown> {
  try {
    const pathname = new URL(requestUrl).pathname;
    const info = new TextEncoder().encode(`bdw|v${envelope.kid}|${pathname}`) as Uint8Array<ArrayBuffer>;
    const salt = fromBase64Url(envelope.salt);
    const iv = fromBase64Url(envelope.iv);
    const ct = fromBase64Url(envelope.ct);

    const baseKey = await crypto.subtle.importKey(
      "raw",
      session.encKey as Uint8Array<ArrayBuffer>,
      { name: "HKDF" },
      false,
      ["deriveKey"],
    );
    const derivedKey = await crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt, info },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );
    const compressed = new Uint8Array(await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: info },
      derivedKey,
      ct,
    ));
    const plaintext = await gunzip(compressed);
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch (err) {
    if (err instanceof DecryptionError) throw err;
    throw new DecryptionError(`Decryption failed for ${requestUrl}: ${(err as Error).message}`, { cause: err });
  }
}
