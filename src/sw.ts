import { validateRequest, CAPABILITIES, type RpcRequest, type RpcResponse } from "./rpc.ts";
import { getSession, clearSession } from "./session.ts";
import { bootstrapSession } from "./bootstrap.ts";
import { getDbd } from "./dw/dbd.ts";
import type { SearchOptions } from "siam-portals";
import { NamueError, ServerError } from "./errors.ts";

async function handle(req: RpcRequest): Promise<RpcResponse> {
  try {
    switch (req.type) {
      case "capabilities":
        return { ok: true, data: CAPABILITIES };

      case "opendata.ckan": {
        // Public open-data proxy: the portal sends no CORS headers, so
        // pages can't fetch it directly. Strictly allowlisted — only
        // the two read-only CKAN actions on DBD's own portal; no DW
        // session, no cookies.
        const url = new URL(req.url);
        const allowed =
          url.protocol === "https:" &&
          url.hostname === "opendata.dbd.go.th" &&
          /^\/api\/3\/action\/(package_show|datastore_search)$/.test(url.pathname);
        if (!allowed) {
          return { ok: false, error: { code: "NAMUE_VALIDATION", message: "URL not allowed for opendata.ckan" } };
        }
        const res = await fetch(url.toString(), { credentials: "omit" });
        if (!res.ok) {
          throw new ServerError(`CKAN returned HTTP ${res.status}`, { status: res.status });
        }
        return { ok: true, data: await res.json() };
      }

      case "session.status": {
        // Non-side-effecting check: does the SW already have a usable session?
        // Never opens a tab. Use this from a popup that doesn't want to
        // bootstrap on every open.
        try {
          await getSession();
          return { ok: true, data: { connected: true } };
        } catch {
          return { ok: true, data: { connected: false } };
        }
      }

      case "session.ensure": {
        try {
          await getSession();
          return { ok: true, data: { connected: true } };
        } catch {
          // Likely: no Imperva cookies yet, or stored session expired and
          // /api/refresh now 403s. Either way, the bootstrap flow opens a
          // DBD tab so the user's browser runs Imperva's JS challenge.
          await bootstrapSession();
          return { ok: true, data: { connected: true } };
        }
      }

      case "company.detail": {
        // Fail fast on a dead session before dispatching; getDbd's getters
        // resolve the current token lazily per request thereafter.
        await getSession();
        const data = await getDbd().companyDetail(req.juristicId, req.typeCode);
        return { ok: true, data };
      }

      case "company.full": {
        // Everything DBD exposes for this juristic ID, in one shot. Twelve
        // parallel encrypted GETs via Promise.allSettled inside siam — a dead
        // endpoint doesn't take the whole response down; failed slots come
        // back as { error: "..." } and the consumer decides what to do.
        await getSession();
        const data = await getDbd().companyFull(req.juristicId, req.typeCode);
        return { ok: true, data };
      }

      case "translate": {
        await getSession();
        const dbd = getDbd();
        if (req.scope === "company") {
          // exactOptionalPropertyTypes — only assign defined fields.
          const opts: SearchOptions = {};
          if (req.page !== undefined) opts.page = req.page;
          if (req.pvCodeList !== undefined) opts.pvCodeList = req.pvCodeList;
          if (req.jpStatusList !== undefined) opts.jpStatusList = req.jpStatusList;
          const page = await dbd.search(req.query, opts);
          return { ok: true, data: page };
        }
        const committees = await dbd.committees(req.juristicId, req.typeCode);
        return { ok: true, data: { committees } };
      }
    }
  } catch (err) {
    // The data path now throws siam errors (SIAM_*); the kept auth/session
    // path still throws namue errors (NAMUE_*). Key recovery off normalized
    // code + status rather than `instanceof`, which doesn't cross the
    // namue/siam class boundary. Surface NAMUE_* codes either way so the RPC
    // error-code contract is preserved.
    const e = err as { code?: unknown; status?: unknown; message?: unknown };
    const code = (typeof e.code === "string" ? e.code : "NAMUE_UNKNOWN").replace(/^SIAM_/, "NAMUE_");
    const status = typeof e.status === "number" ? e.status : null;
    // On a dead session (explicit session error, or 401/403) clear it so the
    // next call rebootstraps.
    if (code === "NAMUE_SESSION" || (code === "NAMUE_SERVER" && (status === 401 || status === 403))) {
      await clearSession();
    }
    return { ok: false, error: { code, message: String(e.message ?? err) } };
  }
}

function dispatch(raw: unknown, sendResponse: (r: RpcResponse) => void): boolean {
  try {
    const req = validateRequest(raw);
    handle(req).then(sendResponse).catch((e) => {
      sendResponse({ ok: false, error: { code: "NAMUE_UNKNOWN", message: String(e) } });
    });
    return true; // keep async channel open
  } catch (e) {
    const code = e instanceof NamueError ? e.code : "NAMUE_VALIDATION";
    sendResponse({ ok: false, error: { code, message: (e as Error).message } });
    return false;
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => dispatch(msg, sendResponse));
chrome.runtime.onMessageExternal.addListener((msg, _sender, sendResponse) => dispatch(msg, sendResponse));

chrome.runtime.onInstalled.addListener(() => {
  console.log("Namue installed");
});
