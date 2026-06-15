# One Clickz Viewer Security Audit

Date: 2026-06-13

Scope: viewer app only (`main.js`, `preload.js`, `www/`, and the website license endpoint used by the viewer).

## Fixed

- Update installer RCE path hardened: HTTPS only, `mehrgrewal.com` host allowlist, checked-release URL match, redirect host validation, redirect depth cap, and download timeout/error cleanup.
- Generic renderer IPC removed from `preload.js`; renderer call sites now use explicit named bridge methods.
- Production DevTools disabled via dev-only menu entries and `devtools-opened` close enforcement.
- Electron windows now use centralized navigation/window-open guards plus CSP and `X-Content-Type-Options`.
- Local Electron DICOM file server now requires a per-session token and enforces allowed roots for file reads and scans.
- PHP DICOM file/scan endpoints now enforce localhost/same-origin CORS, allowed roots, DICOM-like file filtering, and chunked Range streaming.
- Orthanc default credentials removed from generated config; a random per-install password is saved under app data and reused by Electron/PHP config.
- Auto-login credentials now use Electron `safeStorage` with one-time migration from old plaintext `credentials.json`.
- Report, print, and fetal template HTML injection points are sanitized through DOMPurify.
- Website license API can issue 90-day Ed25519 signed offline lease tokens when `LICENSE_LEASE_PRIVATE_KEY_B64` is configured.
- Viewer validates signed lease tokens when `ONECLICKZ_LICENSE_PUBLIC_KEY` is configured, applies a 90-day offline window, warns near lapse, and uses a file plus HKCU high-water timestamp against clock rollback.
- Source-code default quota admin PIN removed from the website license API and viewer quota modal.
- Root Electron dependency upgraded to `electron@^42.4.0`; packaging dependency chain audit is clean.

## Residual / Needs Deployment Confirmation

- Signed lease enforcement requires deployment keys:
  - Server: `LICENSE_LEASE_PRIVATE_KEY_B64` must be a base64 libsodium Ed25519 secret key.
  - Viewer build/runtime: `ONECLICKZ_LICENSE_PUBLIC_KEY` must be the matching base64 Ed25519 public key.
- Instant server revocation still cannot reach a never-online PC; the maximum latency remains the configured offline window.
- `www npm audit` still reports advisories in Cornerstone/VTK imaging dependencies and `@originjs/vite-plugin-commonjs`. The Vite 8 audit-fix path broke the dev client in this checkout, so the functional Vite 7 toolchain is retained.
- The custom network DICOM SCP raw socket parser was not fuzzed in this pass.
- Real-console/device verification was not performed.

## Verification Run

- `npm audit` at repo root: clean.
- `npm run build` in `www`: passed.
- `npm test` in `www`: 27 tests passed.
- `node --check main.js`: passed.
- `node --check preload.js`: passed.
- `php -l` passed for touched PHP endpoints/controllers.
- Browser smoke check: `http://127.0.0.1:5173` rendered the viewer patient list UI.
