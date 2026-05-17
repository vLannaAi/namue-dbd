# Contributing to namue · DBD

Thanks for considering a contribution. This extension exists for a narrow
purpose — resolve the registered Thai/English form of Thai companies and
directors via DBD DataWarehouse+, in the user's own browser, with nothing
sent to a third party. Contributions that preserve that focus are very
welcome.

## Ways to participate

- **Open a [Discussion](https://github.com/vLannaAi/namue-dbd/discussions)**
  to share an idea, ask a question, or propose a scope change before
  writing code.
- **File an [Issue](https://github.com/vLannaAi/namue-dbd/issues)** for
  a reproducible bug, a missing field from DBD, or a concrete improvement.
- **Send a Pull Request** for documentation fixes, small bugfixes, or
  features that have been discussed and agreed.
- **Report a security issue privately** — see [SECURITY.md](./SECURITY.md).

## Scope — what belongs here

The extension is a thin first-party DBD client. A change belongs in this
repo if it:

- Improves correctness of DBD parsing or session handling.
- Hardens the RPC surface exposed via `chrome.runtime.onMessageExternal`.
- Improves accessibility, i18n (Thai/English only), or popup UX.
- Adds tests, types, or developer ergonomics.

A change does **not** belong here if it:

- Adds a backend, analytics, telemetry, or error reporting to any
  third party.
- Performs machine translation, romanization, or any AI inference on
  names. DBD's registered names are authoritative; if a slot is empty
  upstream it stays `null`.
- Talks to any origin other than `datawarehouse.dbd.go.th`.
- Adds writes/uploads to DBD. The extension is read-only, in perpetuity.
- Caches search or profile results beyond the DBD session token itself
  (caching is the consuming application's responsibility).

If you're unsure whether a feature fits, open a Discussion first — it's
cheaper than writing a PR that has to be declined.

## Development workflow

```bash
npm install
npm run icons        # one-time; regenerates icon set
npm run typecheck    # tsc --noEmit
npm test             # ~60 tests via node:test + tsx
npm run build        # esbuild → dist/
```

Load the unpacked extension from `dist/` via `chrome://extensions` →
**Developer mode** → **Load unpacked**.

Run a single test file:

```bash
node --import tsx --test test/crypto.test.ts
```

## Pull request expectations

- **Surgical diffs.** Touch only what the change requires; don't
  reformat or refactor adjacent code.
- **Types stay strict.** The repo runs with `exactOptionalPropertyTypes`
  and `noUncheckedIndexedAccess`. `tsc --noEmit` must pass.
- **Tests stay green.** `npm test` must pass. Add tests for new logic;
  prefer pure-logic modules with injected fakes (the `chrome.*` APIs
  are not mocked).
- **No new runtime origins.** Any addition to
  `manifest.json#externally_connectable.matches` or to
  `host_permissions` needs Discussion first — these are reviewer-
  sensitive in the Chrome Web Store.
- **No secrets, no fixtures with session cookies.** Never commit
  anything captured from a live DBD session that includes
  `incap_ses_*` cookies or a JWT.
- **No comments that restate the code.** Only document the *why* when
  it's non-obvious (a hidden constraint, a subtle invariant, a
  workaround for a specific bug).
- **No machine-generated attribution.** Commits are authored by the
  human contributor only. Don't add `Co-Authored-By: <AI>` trailers.

## Commit style

Conventional-commit prefixes (`feat:`, `fix:`, `chore:`, `docs:`,
`refactor:`, `test:`) are encouraged but not required. Keep the subject
under ~72 characters; explain the *why* in the body if it isn't obvious
from the diff.

## Reporting bugs

Useful bug reports include:

- Chrome version and OS.
- Extension version (from `chrome://extensions`).
- A reproducible search query or juristic ID — **omit personal
  information**; DBD data is public, but please redact anything that
  isn't strictly needed to reproduce.
- The exact error code (one of the `NAMUE_*` codes documented in the
  README) and what action triggered it.
- Whether the issue reproduces in a fresh Chrome profile.

## Code of Conduct

Participation in this project is governed by the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## License

By contributing, you agree that your contributions will be licensed
under the [MIT License](./LICENSE), the same license that covers the
rest of the repository.
