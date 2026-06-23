# Offline Bridge Voucher Recharge — Design

**Date:** 2026-06-17
**Scope:** Bridge app only (`bridge/`), plus a generator page on the website.

## Context / problem
Bridge machines run with **no internet**, so the normal online license/quota flow and long
license keys are impractical. Operators need a way to **add print credits** and **extend the
license** by exchanging a short code with the vendor over the phone:
1. Operator reads a short **Request code** from the Bridge.
2. Vendor enters it on a website page, picks prints + days, gets a **Voucher code**.
3. Operator types the voucher into the Bridge; it applies the grant **offline**.

## Security model
Short codes can't carry a signature, so this uses a **shared-secret HMAC** (HMAC-SHA256), with a
256-bit secret embedded in the Bridge (to verify) and set in the website server env (to sign).
Honest trade-off: a determined reverse-engineer who extracts the embedded secret could forge
vouchers. This defeats all casual cracking (file edits, copying, clock rollback) and is the only
viable way to get short, phone-friendly codes for offline machines.

## Codes
- **Request code (device → vendor), 7 chars:** `base32Crockford(HMAC(SECRET, fingerprint + '|' + counter))[:7]`.
  `counter` is persisted in a tamper-resistant store (file **and** HKCU registry) and **increments
  on every successful redemption**, rotating the request code so vouchers are single-use.
- **Voucher code (vendor → device), 12 chars (grouped `XXXX-XXXX-XXXX`):** encodes
  `prints (uint16)` + `days (uint12)` + `MAC (32 bits)`, base32Crockford. The Bridge recomputes
  `HMAC(SECRET, requestCode + '|' + prints + '|' + days)`, compares the 32-bit MAC; on match it
  applies the grant. (~1 in 4 billion guess resistance.)
- Crockford base32 alphabet (no I/L/O/U) to avoid transcription errors.

## Redemption (offline, local)
On valid voucher: `quotaRemaining += prints`; `expiresAt += days`; persist to the local Bridge
license cache + tamper store; `counter++`. No server contact. The existing license/quota
protections still apply.

## Components
- **`bridge/main.js`**: `VOUCHER_SECRET` (embedded const + env override); a counter store
  (file + registry); `getVoucherRequestCode()`; `redeemVoucher(code)` (verify + apply); two IPC
  handlers. Reuses the existing bridge fingerprint + `.license` read/write.
- **`bridge/preload.js`**: expose `getVoucherRequestCode()` and `redeemVoucher(code)`.
- **`bridge/ui`**: new **Recharge** tab (beside Slots/Branding/License/About) — shows prints left,
  days left, the Request code (Copy), a Voucher input, Redeem + result. Top bar always shows
  `N prints left · D days left`.
- **`website/bridge-voucher.php`** (→ https://mehrgrewal.com/mediview/bridge-voucher.php): form
  (request code, prints, days) → returns the 12-char voucher. Secret from `BRIDGE_VOUCHER_SECRET`
  server env. Vendor-only (basic gate).

## Verification
- Unit round-trip: a voucher minted by the PHP logic verifies in the Node logic and applies the
  exact prints/days; tampered code rejected; replay (old request code) rejected after counter bump.
- Bridge UI build passes; Recharge tab redeems a test voucher and prints/days update + top bar
  reflects it.
