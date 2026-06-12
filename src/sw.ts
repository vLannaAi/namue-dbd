import { validateRequest, CAPABILITIES, type RpcRequest, type RpcResponse } from "./rpc.ts";
import { getSession, clearSession } from "./session.ts";
import { bootstrapSession } from "./bootstrap.ts";
import { NamueDwClient } from "./dw/client.ts";
import { NamueError, SessionError, ServerError } from "./errors.ts";

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
        const session = await getSession();
        const client = new NamueDwClient({ session });
        const [profile, objectives, committees] = await Promise.all([
          client.getProfileDetail(req.typeCode, req.juristicId),
          client.getDescriptions(req.typeCode, req.juristicId),
          client.getCommittees(req.typeCode, req.juristicId),
        ]);
        return { ok: true, data: { profile, objectives, committees } };
      }

      case "company.full": {
        // Everything DBD exposes for this juristic ID, in one shot. Nine
        // parallel encrypted GETs. Promise.allSettled so a dead endpoint
        // doesn't take the whole response down — failed slots come back
        // as { error: "..." } and the consumer decides what to do.
        const session = await getSession();
        const client = new NamueDwClient({ session });
        const t = req.typeCode, id = req.juristicId;
        const tasks = {
          profile:               client.getProfileDetail(t, id),
          objectives:            client.getDescriptions(t, id),
          committees:            client.getCommittees(t, id),
          committeeSigns:        client.getCommitteeSigns(t, id),
          partners:              client.getPartners(t, id),
          nameHistory:           client.getNameHistory(t, id),
          capitalHistory:        client.getCapitalHistory(t, id),
          nations:               client.getNations(t, id),
          mergers:               client.getMergers(t, id),
          liquidators:           client.getLiquidators(t, id),
          balanceSheets:         client.getBalanceSheets(t, id),
          financialSubmissions:  client.getFinancialSubmissions(t, id),
        };
        const keys = Object.keys(tasks) as (keyof typeof tasks)[];
        const settled = await Promise.allSettled(keys.map((k) => tasks[k]));
        const data: Record<string, unknown> = {};
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i]!;
          const s = settled[i]!;
          data[k] = s.status === "fulfilled" ? s.value : { error: String(s.reason?.message ?? s.reason) };
        }
        return { ok: true, data };
      }

      case "translate": {
        const session = await getSession();
        const client = new NamueDwClient({ session });
        if (req.scope === "company") {
          // exactOptionalPropertyTypes — only assign defined fields.
          const opts: import("./dw/types.ts").SearchOptions = {};
          if (req.page !== undefined) opts.page = req.page;
          if (req.pvCodeList !== undefined) opts.pvCodeList = req.pvCodeList;
          if (req.jpStatusList !== undefined) opts.jpStatusList = req.jpStatusList;
          const page = await client.searchByName(req.query, opts);
          return { ok: true, data: page };
        }
        const committees = await client.getCommittees(req.typeCode, req.juristicId);
        return { ok: true, data: { committees } };
      }
    }
  } catch (err) {
    // On 401/403 the session is dead — clear it so the next call rebootstraps.
    if (err instanceof SessionError) await clearSession();
    if (err instanceof ServerError && (err.status === 401 || err.status === 403)) {
      await clearSession();
    }
    const code = err instanceof NamueError ? err.code : "NAMUE_UNKNOWN";
    return { ok: false, error: { code, message: (err as Error).message } };
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
