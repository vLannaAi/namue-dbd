import { refresh } from "./session.ts";
import { SessionError } from "./errors.ts";

const DBD_URL = "https://datawarehouse.dbd.go.th/";

/**
 * Open DBD in a new tab so the user's browser runs the Imperva JS challenge
 * and sets visid_incap_* / incap_ses_* cookies on .dbd.go.th. Once those
 * cookies exist, the extension's own fetch to /api/refresh succeeds first-party
 * (host_permissions makes the extension a first-party citizen of that origin).
 *
 * Polls refresh() until success or timeout. Closes the tab on success.
 */
export async function bootstrapSession(timeoutMs = 25_000): Promise<void> {
  const tab = await chrome.tabs.create({ url: DBD_URL, active: true });
  const tabId = tab.id;
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown = null;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    try {
      await refresh();
      if (tabId !== undefined) {
        try { await chrome.tabs.remove(tabId); } catch { /* tab already closed */ }
      }
      return;
    } catch (e) {
      lastErr = e;
    }
  }

  if (tabId !== undefined) {
    try { await chrome.tabs.remove(tabId); } catch { /* ignore */ }
  }
  throw new SessionError(
    `Bootstrap timed out after ${timeoutMs}ms — Imperva did not accept the session`,
    { cause: lastErr },
  );
}
