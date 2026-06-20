# Cut namue's DBD data layer over to siam-portals

**Date:** 2026-06-19
**Status:** Completed 2026-06-20 — shipped in commit `623c068` (data layer cut to
siam-portals), submodule pinned at `vendor/siam-portals` `v0.1.0-pre.1.6-35-g1c7203e`
(package version `0.1.0-pre.3`). Released in namue `0.3.0` (alongside the
detail-view shareholders/nationality feature).

The post-cutover real-Chrome smoke surfaced two cutover regressions vs the deleted
`src/dw/` client, both fixed upstream in siam (with tests):
1. **Missing `Content-Type: application/json`** on the search POST → DBD `415`.
   siam's `decode()` now mirrors the old client's request headers.
2. **Double gzip-decompression** — browser `fetch` auto-decompresses but leaves
   `content-encoding: gzip` visible, so siam re-gunzipped the decoded body and the
   read threw `TypeError: Failed to fetch` on every `200`. siam's `PreAuthTransport`
   now strips `content-encoding`. (Bug #2 was masked by #1: `decode()` throws on
   non-2xx before reaching the gunzip line.)
**Repos:** `namue-dbd` (consumer, this repo) + `siam-portals` (provider, now vendored
as a git submodule at `vendor/siam-portals`)

## Context

`namue-dbd` owns a full DBD DataWarehouse data layer in `src/dw/`: an HTTP
client, AES-GCM + gzip crypto, and parsers for search / profile / committees /
9 raw endpoints. `siam-portals` now reproduces that data layer with proven
byte-for-byte parser parity (deepEqual against namue's own parser output on real
captured DW data, all 12 endpoints, tag `v0.1.0-pre.1.5`).

The goal is to delete namue's `src/dw/` **data** files and call siam-portals for
all DBD data. namue keeps everything that is definitionally browser/auth: session
refresh, the Imperva bootstrap, the RPC contract, and the popup shell.

## Alignment direction (decided)

**siam-portals adjusts to match namue-dbd's behaviour** — not the reverse. siam
becomes a true drop-in; namue then runs its tests against siam, and only when
green do we delete `src/dw/`. The hardening benefits every siam consumer
(aksorn, niwat), and namue's glue shrinks to a session adapter + verb dispatch
rather than a re-implemented HTTP layer.

Sequence: **siam ships the aligned tag → namue pins it → namue wires + proves
the differential → namue suite + manual smoke pass → delete `src/dw/`.**

## Goals

- All DBD data flows `namue → siam-portals → datawarehouse.dbd.go.th`.
- Delete `src/dw/{client,crypto,search,profile,committees,types}.ts` and their tests.
- Preserve the published v0.2.0 RPC contract and behaviour **exactly**: response
  shapes, error codes, timeout protection, and the `401/403 → clearSession →
  re-bootstrap` session-recovery loop.

## Non-goals

- No change to `src/dw/auth.ts`, `src/session.ts`, `src/bootstrap.ts`,
  `src/rpc.ts`, `src/errors.ts`, `rules/dw-origin.json`, `manifest.json`, or the
  message bridge.
- No new backend, analytics, caching, translation, or origins (per CLAUDE.md).
- `opendata.ckan` keeps namue's own allowlisted public fetch — unchanged.

## Locked decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Alignment direction | siam adjusts to namue |
| 2 | Transport | namue uses siam's `createPreAuthTransport` (after siam fixes) |
| 3 | Dependency wiring | git submodule pinned to the new aligned tag |
| 4 | Validation gate | automated fixture differential (committed, temporary) + manual real-Chrome smoke |
| 5 | Who fixes siam | the **siam-portals session** owns its repo: it implements R1–R4 from `siam-portals/docs/superpowers/specs/2026-06-19-namue-alignment-requirements.md` and cuts the aligned tag. This namue session waits for that tag, then does the cutover (Part B). |
| 6 | Error codes | namue maps `SIAM_*` → `NAMUE_*` in a thin glue; siam stays namespace-neutral |
| 7 | typeCode threading | already wired in namue (`popup.ts` passes `hit.typeCode` into `company.detail`; `rpc.ts` validates it on every data verb); siam makes `typeCode` required |

---

## Part A — siam-portals adjustments

### A1. Request timeout — `src/transport/preauth.ts` (REQUIRED)

Add `timeoutMs` to `PreAuthDeps` (default `30_000`). Mirror namue `client.ts`
`_request`:

- `AbortController` + manual `setTimeout`/`clearTimeout` in `finally`.
  **Not** `AbortSignal.timeout()` — it is unref'd and will not keep a timer
  alive (namue's documented landmine).
- Race the body read (`res.arrayBuffer()`) against a manual timeout via
  `Promise.race` — `AbortSignal` does not interrupt an in-progress HTTPS body
  read (namue's other documented landmine).
- On abort → `TimeoutError`; on other fetch failure → `NetworkError`.

**Acceptance:** a transport whose `fetch` never resolves rejects with
`TimeoutError` within `timeoutMs`; a transport whose body read stalls rejects
with `TimeoutError`.

### A2. Redirect policy — `src/transport/preauth.ts` (REQUIRED)

Change `redirect:"error"` → `redirect:"follow"`, or expose a `redirect` option
defaulting to `"follow"`. namue's client follows redirects; `"error"` would
throw on a same-origin session-expiry hop (the brief's redirect caveat).

**Acceptance:** preauth issues fetch with `redirect:"follow"` by default.

### A3. HTTP status checking — `src/connectors/dbd/api.ts` `decode()` (REQUIRED)

After `transport.request()`, **before** gunzip/JSON.parse, inspect `res.status`:

- `status >= 500` → `ServerError(..., { status })`
- any other `!ok` (401/403/404/...) → `ServerError(..., { status })`

Recommended placement is `decode()` (transport-agnostic), so fixture/direct
transports inherit correct DBD status semantics too.

Why it is load-bearing:

- A dead session returns 403; only a status-bearing `ServerError` lets namue's
  `sw.ts` detect it and `clearSession()` → re-bootstrap.
- `companyFull` uses `Promise.allSettled`; a 404 on an absent slot (e.g.
  liquidators on an active company) must **reject** → `{ error }`. Without the
  status check, `decode()` would JSON-parse the 404 HTML body and the slot's
  `{ error }` message would differ from namue's, breaking parity.

**Acceptance:** `decode()` on a 403/404/500 response rejects with
`ServerError` carrying that `status`, without attempting to decode the body;
`companyFull` turns a 404 slot into `{ error }`.

### A4. typeCode honesty — `src/connectors/dbd/endpoints.ts` (RECOMMENDED)

Drop the `typeCodeFromId` placeholder (leading-digit guess — a pre.1 fixture
artifact). Make `typeCode` **required** on `companyDetail` / `companyFull` /
`committees` (or throw if omitted). namue always passes the real `jpTypeCode`,
so this only removes a latent footgun (a silent wrong-typeCode URL in
production).

**Acceptance:** omitting `typeCode` is a type error and/or throws; passing the
real code is unchanged.

### A5. Error namespace — no siam change

siam keeps `SIAM_*` codes. namue maps them (Part B5). No `errorPrefix` option.

### A6. Out of scope for siam

- `opendata.ckan` stays namue's own fetch (covers `package_show` **and**
  `datastore_search`; siam's `opendataCkan` only does `datastore_search`).
- `session.ensure` / `session.status` stay namue's (`getSession` /
  `bootstrapSession`); siam's stubs are unused.

After A1–A4, siam cuts a new tag (e.g. `v0.1.0-pre.1.6`).

---

## Part B — namue cutover

### B1. Dependency wiring

- Add siam-portals as a git submodule at `vendor/siam-portals`, pinned to the
  aligned tag.
- Add `"siam-portals": "file:./vendor/siam-portals"` to `package.json` so npm
  symlinks it into `node_modules/siam-portals` and the package `exports` map
  governs imports: `import { createDbd, createPreAuthTransport, type DbdSession }
  from "siam-portals"`.
- CI `actions/checkout` gains `with: submodules: recursive`.

### B2. Session adapter + dbd factory — `src/dw/dbd.ts` (new, kept)

```ts
import { createDbd, createPreAuthTransport, type DbdSession } from "siam-portals";
import { getSession } from "../session.ts";

export function getDbd() {
  const session: DbdSession = {
    idToken: async () => (await getSession()).idToken,
    encKey:  async () => (await getSession()).encKey,
  };
  return createDbd({
    transport: createPreAuthTransport({ fetch: globalThis.fetch.bind(globalThis) }),
    session,
  });
}
```

Getters are refresh-aware: each call resolves the current token via
`getSession()` (in-memory cached; refreshes on expiry). `.bind(globalThis)`
avoids "Illegal invocation".

### B3. Verb dispatch — `src/sw.ts` (edit)

Repoint the four data verbs; shapes are identical to today. Keep a fail-fast
`await getSession()` at the top of each data verb (matches today's structure,
surfaces a dead session before dispatching 12 requests):

- `company.detail` → `dbd.companyDetail(req.juristicId, req.typeCode)` → `{ profile, objectives, committees }`
- `company.full` → `dbd.companyFull(req.juristicId, req.typeCode)` → 12-slot object (siam's slot keys already match namue's exactly)
- `translate` / `company` → `dbd.search(req.query, opts)` → `{ meta, contents }` (build `opts` with conditional assignment for `exactOptionalPropertyTypes`)
- `translate` / `director` → `dbd.committees(req.juristicId, req.typeCode)` → `{ committees }`

Keep `opendata.ckan`, `session.status`, `session.ensure`, `capabilities`
verbatim.

### B4. Type re-pointing

Delete `src/dw/types.ts` and repoint consumers (`sw.ts`, `popup.ts`) to siam's
DTOs (field shapes are verbatim):

| namue type | siam type |
|---|---|
| `DwProfileDetail` | `CompanyProfile` |
| `DwSearchResult` | `SearchResult` |
| `DwSearchPage` | `SearchPage` |
| `DwCommittee` | `Committee` |
| `DwObjective` | `Objective` |
| `SearchOptions` | `SearchOptions` |

Fallback if the churn is large: a ~10-line `src/dw/types.ts` that only
re-exports/aliases siam types (`export type { CompanyProfile as DwProfileDetail,
... } from "siam-portals"`).

### B5. Error normalization + session recovery — `src/sw.ts` catch

**Critical:** siam's `ServerError`/`SessionError` are `SiamError` instances —
**not** namue's classes — so the current `err instanceof ServerError` /
`instanceof SessionError` checks would silently stop firing `clearSession()` for
siam-origin errors. The catch must switch from `instanceof` to **code + status**.
The data path now throws siam errors; the kept auth/session path
(`getSession`/`refreshSession` in `auth.ts`) still throws namue errors — so the
catch sees a mix and must handle both uniformly.

- `normalizeError`: derive `code` = `(err.code ?? "NAMUE_UNKNOWN").replace(/^SIAM_/, "NAMUE_")`
  (covers both namespaces); read `status` off `err.status` when present. This
  preserves the surfaced RPC `error.code` contract (`NAMUE_NETWORK`,
  `NAMUE_SERVER`, `NAMUE_DECRYPTION`, ...).
- Session recovery keyed off the normalized values, not `instanceof`:
  `clearSession()` when `code === "NAMUE_SESSION"`, or
  `code === "NAMUE_SERVER" && (status === 401 || status === 403)`.

Both error classes expose `.code`; both `ServerError` variants expose `.status`,
so this is uniform across namue- and siam-origin errors.

### B6. Deletion set (only after the gate passes)

Delete: `src/dw/{client,crypto,search,profile,committees,types}.ts` and
`test/{client,crypto,search,profile,committees}.test.ts`.

Keep: `src/dw/auth.ts`, `src/dw/dbd.ts` (new), `src/session.ts`,
`src/bootstrap.ts`, `src/rpc.ts`, `src/errors.ts`, `rules/dw-origin.json`,
manifest, popup. Pre-deletion: grep for stale imports of the deleted modules.

---

## Validation gate

### V1. Automated fixture differential (committed, temporary)

`test/cutover-differential.test.ts` drives **both** paths over the **same**
decrypted payloads (crypto bypassed on both — proven separately):

- **old:** `new NamueDwClient({ session, fetch: fakeFetch, _decryptForTest: () => plaintextForUrl })`
- **new:** siam `dbd` built with a fake transport returning the plaintext JSON
  bytes and **no session** (so `decode()` skips auth/decrypt and just
  JSON-parses → parsers run).

Source payloads: namue's existing test fixtures (self-contained, no secrets).
`assert.deepEqual(old, new)` for `company.detail`, `company.full`,
`translate.company` (search), `translate.director` (committees). Zero diff =
parity.

### V2. Manual real-Chrome smoke

Per CLAUDE.md ("Real-Chrome smoke test is the only verification that matters for
the bootstrap flow"): load unpacked `dist/`, exercise an **active**, a
**dissolved**, and a **financials-bearing** company through search → detail →
full. Confirm identical rendering to the pre-cutover build.

### V3. Order

V1 green + suite green + V2 confirmed → delete `src/dw/` data files + their
tests → remove `test/cutover-differential.test.ts` → `npm run typecheck`,
`npm test`, `npm run build` all green.

---

## Risks & spikes

### S1. esbuild/tsc resolution of siam's `.js`-suffixed specifiers (GATING)

siam's source imports use `.js` specifiers between `.ts` files
(`./connectors/dbd/api.js`). Before any cutover code, prove that
`import { createDbd } from "siam-portals"`:

- **bundles** via esbuild (`npm run build`), and
- **typechecks** via tsc (`npm run typecheck`),

resolving siam's internal `.js`→`.ts`. If esbuild won't: fallbacks are
`resolveExtensions`/a tiny resolve plugin, a relative-path import, or requesting
siam ship built JS alongside source. This spike gates everything else.

### S2. content-encoding / double-gunzip

siam `decode()` conditionally gunzips on the `content-encoding` header; in the
browser, fetch auto-decompresses and strips the header, so the manual branch
does not run (already proven by siam's parity tests). Confirm in the real-Chrome
smoke that profile/search payloads decode correctly.

---

## Acceptance summary

- siam A1–A3 (REQUIRED) shipped + tagged; A4 done.
- namue builds + typechecks against the submodule (S1 resolved).
- V1 differential: zero diff across all four verbs.
- namue unit suite green; V2 smoke confirmed.
- `src/dw/` data files deleted; differential test removed; typecheck/test/build green.
- RPC contract, error codes, timeout, and session-recovery behaviour unchanged.
