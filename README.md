# namue · DBD

> Bilingual Thai/English lookup for registered Thai companies, powered by DBD DataWarehouse+.

A Chrome MV3 extension that resolves the official Thai or English form of
any company in Thailand's national business registry. Built as a thin
first-party DBD client: queries go directly from the user's browser to DBD,
responses are decrypted locally, and nothing is sent to a backend.

- **Website**: <https://namue.com>
- **Chrome Web Store**: pending review (link will be added on approval)
- **Privacy notice**: <https://www.namue.com/privacy.html>
- **Operated by**: [Lanna AI](https://lanna.ai)

## What it does

- Type a company name (Thai or English) or a 13-digit tax ID.
- Get the bilingual match: registered name, juristic ID, province, year.
- Open a record for the full registration: directors, address (with a
  Google Maps link), registration date, business objectives.
- Switch the interface between English and Thai at any time.
- Expose a typed RPC so other applications can use the extension as a
  bilingual-name oracle (see [RPC API](#rpc-api) below).

## What it does NOT do

- **No backend**. We do not operate a server that sees your queries.
- **No analytics**, no telemetry, no error reporting to third parties.
- **No machine translation** — every result is the registered name DBD
  returns. If the upstream record has only one language, the other slot
  is `null`. Names are never machine-romanized.
- **No caching** of search results beyond the DBD session itself —
  consuming applications own their own cache.
- **No persistence** beyond the current DBD session token (JWT) and your
  UI language preference, both kept in `chrome.storage.local`.
- **No origin other than `datawarehouse.dbd.go.th`** is touched at runtime.

## Install (developer mode)

```bash
npm install
npm run icons   # one-time, regenerates the placeholder icon set
npm run build
```

Then in Chrome:

1. Open `chrome://extensions`.
2. Toggle **Developer mode** on.
3. Click **Load unpacked**, pick `dist/`.
4. Note the extension ID — your application will use it to call the
   extension via `chrome.runtime.sendMessage(EXT_ID, …)`.

The first call to `session.ensure` opens a DBD tab briefly so the user's
own browser clears DBD's WAF challenge (~1 second, invisible). The tab
closes automatically once authentication succeeds.

## RPC API

The extension listens on two channels:

- `chrome.runtime.onMessage` — from the extension's own popup.
- `chrome.runtime.onMessageExternal` — from origins listed in
  `manifest.json#externally_connectable.matches`.

### Requests

```ts
type RpcRequest =
  | { type: "capabilities" }
  | { type: "session.status" }
  | { type: "session.ensure" }
  | { type: "translate"; scope: "company"; query: string; page?: number }
  | { type: "translate"; scope: "director"; juristicId: string; typeCode: string };
```

| `type`                   | Returns                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| `capabilities`           | `{ protocolVersion, services: string[] }`                            |
| `session.status`         | `{ connected: boolean }` — non-side-effecting probe, never opens tab |
| `session.ensure`         | `{ connected: true }` — opens DBD tab if needed to mint cookies      |
| `translate` / `company`  | `DwSearchPage` with `contents[].name`, `contents[].nameEn`           |
| `translate` / `director` | `{ committees: DwCommittee[] }` with `firstName/firstNameE` etc.     |

### Responses

```ts
type RpcResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
```

Error codes (all prefixed `NAMUE_`):
`NETWORK`, `TIMEOUT`, `SERVER`, `DECRYPTION`, `PARSE`, `SESSION`,
`VALIDATION`, `DISCONNECTED`, `UNKNOWN`.

`DISCONNECTED` is popup-side only — emitted when `chrome.runtime.lastError`
fires or the service worker reply is `undefined`. Callers should treat it
like `SESSION` (re-bootstrap then retry).

### Calling from an application

```ts
const EXT_ID = "abcdef…"; // the extension ID, after install

const caps = await chrome.runtime.sendMessage(EXT_ID, { type: "capabilities" });
// { ok: true, data: { protocolVersion: 1, services: ["translate.company", …] } }

await chrome.runtime.sendMessage(EXT_ID, { type: "session.ensure" });

const r = await chrome.runtime.sendMessage(EXT_ID, {
  type: "translate", scope: "company", query: "ลานนา",
});
if (r.ok) for (const hit of r.data.contents) console.log(hit.name, "→", hit.nameEn);
```

### Allowed origins

By default the extension accepts external messages from:

- `*.namue.com`
- `*.lanna.ai`
- `*.xyz.it`
- `localhost` and `127.0.0.1` (for local development)

Add or remove patterns by editing `externally_connectable.matches` in
`manifest.json` and rebuilding.

A live RPC demo page lives in `test-page/index.html`; open it from a
local web server (e.g. `python3 -m http.server`) after installing the
unpacked extension.

## Local development

```bash
npm test         # node:test via tsx — pure-logic modules with injected fakes
npm run typecheck # tsc --noEmit
npm run build    # esbuild → dist/
```

The `chrome.*` APIs are not mocked in tests; service-worker behaviour is
verified by loading the unpacked build in Chrome.

## Architecture

Single responsibility: query DBD on behalf of the user. The extension:

- Holds the DBD session token (`chrome.storage.local`, isolated per Chrome
  profile by the platform).
- Mints and refreshes the JWT silently from the service worker.
- Decrypts AES-GCM + gzip envelopes locally via Web Crypto and
  `DecompressionStream`.
- Returns plain JSON to the caller.

Scope expansion is intentionally restrained: a feature only belongs in
the extension if it requires first-party browser context for a new
origin behind a WAF. Anything that can run from a backend (AI, maps,
TTS, …) belongs in the calling application, not here.

## Privacy

The extension does not collect, transmit, or store user queries beyond
what is strictly necessary to fulfill an in-progress translation against
DBD. The extension talks only to `datawarehouse.dbd.go.th` and to origins
the user has opted into via `externally_connectable`.

Full privacy notice: <https://www.namue.com/privacy.html>.

## Contributing

Contributions are welcome — bug reports, ideas, and PRs alike. Before
writing code, please read [CONTRIBUTING.md](./CONTRIBUTING.md) for the
scope rules (no backend, no telemetry, no AI translation), and skim the
[Code of Conduct](./CODE_OF_CONDUCT.md).

- **Discussions**: <https://github.com/vLannaAi/namue-dbd/discussions> —
  for ideas, questions, and scope conversations before opening an issue.
- **Issues**: <https://github.com/vLannaAi/namue-dbd/issues> — for
  reproducible bugs and concrete feature requests.
- **Security**: report privately via
  [SECURITY.md](./SECURITY.md). Do not file a public issue with a
  working exploit or a live session token.

## License

MIT — see [LICENSE](./LICENSE). Operated by [Lanna AI](https://lanna.ai).

The bundled brand font (`Momo Trust Display`) is licensed under the SIL
Open Font License 1.1; see [`font/Momo_Trust_Display/OFL.txt`](./font/Momo_Trust_Display/OFL.txt).
