# Detail-view shareholders + nationality, search loader, not-found message

**Date:** 2026-06-20
**Status:** Approved (minimal scope) — ready to implement
**Repo:** `namue-dbd` (popup only; no RPC contract change, no siam change)

## Goal

Three popup-only enhancements, requested after the siam cutover smoke:

1. **Shareholders + nationality** in the company detail view (both: a nationality
   breakdown and the individual shareholder list).
2. **Loader** shown while a search is in flight.
3. **Not-found message** when a search returns zero results.

Objectives already render and keep their current English-mode filter — **no change**.

## Data source (decided)

Nationality (`nations`) and shareholders (`partners`) exist only in the
`company.full` payload; there is no standalone `nations` verb in siam. The
minimal in-contract path is to switch the detail fetch from `company.detail`
(3 endpoints) to **`company.full`** (12 endpoints, run in parallel via
`Promise.allSettled`, each slot fail-soft as `{ error }`). This is an
already-exposed RPC verb — **no new RPC surface, no version-contract change**.

`company.full` is a superset of `company.detail` (it returns
profile/objectives/committees too), so the existing render is unchanged; we add
two sections and read two more slots.

## Changes (all in `src/popup.ts`, `src/popup.html`, `src/i18n.ts`)

### Detail data — `openDetailByIndex`
- Send `{ type: "company.full", typeCode, juristicId }` instead of `company.detail`.
- Each slot is `T | SlotError`. Coerce with a helper:
  `slot(v, fallback) = (v && typeof v === "object" && "error" in v) ? fallback : v`.
- `profile` slot erroring → show the existing error status and return (can't render).
- `objectives`/`committees`/`partners`/`nations` errored or absent → `[]`.
- Pass `partners` + `nations` through to `renderDetailPanel`.

### Detail render — `renderDetailPanel`
- Extend signature + `lastDetail` type with `partners: Partner[]`, `nations: Nation[]`.
- **Nationality** section: one line per `Nation` — `nameEn`/`nameTh` · `proportionPercent`%.
  Hidden when empty.
- **Shareholders** section: one line per `Partner` — name (lang-aware `fullName` /
  `firstNameE`+`lastNameE`) · nationality (`ntCode`) · `proportionPercent`%.
  Hidden when empty.
- Both reuse the existing `.ds-section` / `<ul>` markup. Copy/share text
  (`profileAsText`) unchanged (minimal) — it reads a subset of `lastDetail`.
- Language-toggle restore (`renderDetailPanel(savedDetail…)`) passes the two new fields.

### Search loader — `runFirstPage`
- Toggle a `body.searching` class around the `send()`; a centered spinner
  (reusing the existing `lazy-spin` keyframe) shows in the results area.
- Cleared on success and on error.

### Not-found — `runFirstPage`
- When `r.ok && meta.totalItems === 0`, render a `.no-results` message in `#result`
  (new i18n `noResults`) instead of leaving the list silently empty.

### i18n (`src/i18n.ts`)
- New strings: `sectionNationality(n)`, `sectionShareholders(n)`, `noResults` (EN + TH).

## Non-goals
- No new RPC verbs; no siam change; no version-contract change.
- No financials/history UI (other `company.full` slots stay unused).
- No change to objectives behavior.

## Cleanup (pre-release, tracked separately)
- Remove the temporary `[namue]` SW logs + `__namue` debug hook.
- Commit the 0.2.1 siam fixes (Content-Type + content-encoding) and bump the
  submodule pointer.
