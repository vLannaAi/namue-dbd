import { createDbd, createPreAuthTransport, type DbdSession } from "siam-portals";
import { getSession } from "../session.ts";

/**
 * Build a siam-portals DBD api bound to namue's session.
 *
 * The DbdSession getters resolve the CURRENT token on every call, so a token
 * that rotates mid-flight (getSession refreshes on expiry) is picked up without
 * rebuilding the api. `globalThis.fetch.bind(globalThis)` avoids the "Illegal
 * invocation" throw when fetch is called with a non-global receiver.
 */
export function getDbd() {
  const session: DbdSession = {
    idToken: async () => (await getSession()).idToken,
    encKey: async () => (await getSession()).encKey,
  };
  return createDbd({
    transport: createPreAuthTransport({ fetch: globalThis.fetch.bind(globalThis) }),
    session,
  });
}
