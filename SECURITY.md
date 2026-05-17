# Security Policy

## Reporting a vulnerability

Please report security issues **privately**. Do not open a public issue,
discussion, or pull request that contains a working exploit, a leaked
session token, or steps that would let someone abuse a live DBD session.

Two private channels are available:

1. **GitHub Security Advisories** — preferred. Open a draft advisory at
   <https://github.com/vLannaAi/namue-dbd/security/advisories/new>.
   This keeps the report private until a fix is ready.
2. **Email** — `security@namue.com`. Encrypted email is welcome but not
   required; PGP key fingerprint can be requested by replying to the
   initial acknowledgement.

Please include:

- A description of the issue and its impact.
- Steps to reproduce against a current build of `main`, or the commit
  SHA where you first observed the behaviour.
- The extension version (`chrome://extensions` → Details).
- Chrome version and OS.
- Any proof-of-concept code, redacted of personal data and live session
  tokens.

We aim to acknowledge within **3 business days** and to provide a fix
or mitigation timeline within **14 days** for confirmed vulnerabilities.
Coordinated disclosure with the reporter is the default; please give us
a reasonable window before public disclosure.

## Scope

**In scope:**

- The extension source in this repository (popup, service worker,
  content scripts, build pipeline).
- The RPC surface exposed via `chrome.runtime.onMessageExternal` to
  the origins listed in `manifest.json#externally_connectable.matches`.
- Handling of the DBD session token in `chrome.storage.local`.
- Decryption of DBD's AES-GCM + gzip envelopes.
- Any cross-origin or privilege-escalation issue specific to this
  extension's bundle.

**Out of scope:**

- Vulnerabilities in DBD DataWarehouse+ itself
  (`datawarehouse.dbd.go.th`). Report those to the operator of that
  service (the Department of Business Development, Thailand).
- Vulnerabilities in Chrome, Chromium, or the Chrome Web Store
  platform. Report those to Google.
- The contents of any registered company's public record. This data is
  published by DBD and is not under our control.
- Social-engineering, phishing, or physical-access scenarios that do
  not exploit a flaw in this extension's code.

## What this extension does not collect

For the avoidance of doubt:

- **No backend.** We do not operate a server that sees user queries.
- **No analytics, no telemetry, no error reporting** to any third party.
- **No persistent storage** beyond the DBD session token (a JWT) and
  the user's UI language preference, both held in `chrome.storage.local`,
  isolated per Chrome profile.

If you discover a behaviour that contradicts the above, treat it as a
high-severity finding and report it via the private channels.

## Safe-harbour

We will not pursue or support legal action against researchers who:

- Make a good-faith effort to comply with this policy.
- Report findings promptly and privately.
- Do not exfiltrate user data, degrade service for other users, or
  attempt to access accounts or data that are not their own.
- Give us a reasonable disclosure window.

Thank you for helping keep namue safe for its users.
