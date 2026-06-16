# One Clickz Bridge Security Audit

Date: 2026-06-14

Scope: bridge app only (`bridge/main.js`, `bridge/preload.js`, `bridge/src`, and `bridge/ui`).

## Fixed

- Central recharge no longer uses a renderer-side admin PIN field.
- Offline recharge now uses Ed25519 signed vouchers:
  - bridge shows a device/license-bound request code,
  - admin signs it outside the app,
  - bridge verifies with a public key only,
  - used voucher IDs are recorded to block replay.
- Offline recharge credit is stored separately from server quota so online quota polling does not erase a local offline top-up.
- Offline credit is consumed before server quota on successful prints.
- Renderer preload no longer exposes direct central quota decrement or server PIN mutation methods.
- Production config windows disable DevTools and block DevTools keyboard shortcuts.
- Config windows deny `window.open` and unexpected navigation.
- Hidden print windows disable DevTools and deny `window.open` / navigation.
- The hardcoded renderer password gate for adding slots and legacy per-slot quota was removed instead of presenting it as security.

## Residual Risk

- No desktop client can be made uncrackable. The monetary control now depends on voucher signatures, not hidden client secrets.
- The private offline recharge key must stay outside the packaged bridge and should be backed up securely.
- Local offline top-ups are local to that bridge install; they do not update the website/server balance until a future server reconciliation flow is added.
- Legacy per-slot quota remains a local operational control, not a secure billing control.
- Real modality/printer verification was not performed in this environment.

## Verification

- `npm test` in `bridge`: passed.
- `npm run build:ui` in `bridge`: passed.
- Offline voucher generator smoke: request signed with the external private key and verified by the bridge public key.
- PrintWorker smoke dumps confirmed mapped/default paper sizes and branding in generated HTML/PDF.
