# Implementation Spec — Offline License Activation + Embedded-Secret Hardening

> Hand-off spec for an implementing agent (Opus 4.7 / Copilot). Self-contained. Two parts:
> **Part A** adds offline (no-internet) activation to Bridge + Viewer. **Part B** hardens the
> embedded secret. Do Part A and Part B together (Part B rotates the secret, so both apps + the
> website must be rebuilt in lockstep). A reviewer will check the result afterward.

---

## 0. Background you need

**Apps** (Electron, this repo `C:\xampp\htdocs\dcm`):
- **Viewer** — `main.js` (main process), `preload.js`, renderer in `www/` (React/Vite).
- **Bridge** — `bridge/main.js`, `bridge/preload.js`, renderer in `bridge/ui/` (React/Vite).
- **Website** — PHP at `website/` (served at `mehrgrewal.com/mediview/`). DB accessor is the global
  `db()` (a PDO) defined in `website/api/config/db.php`; controllers use `db()->prepare(...)`.

**Existing offline-voucher system (REUSE — do not reinvent):**
- Codec: `voucherShort.js` (Viewer), `bridge/src/license/offlineRecharge.js` (Bridge),
  `website/bridge-voucher.php` (generator). All three are **byte-identical** HMAC-SHA256 + Crockford
  base32. Exports used: `shortRequestCode(secret, fingerprint, counter)`,
  `makeShortVoucher(secret, requestCode, prints, days)`, `verifyShortVoucher(secret, requestCode, code)`.
- `shortRequestCode` already binds to the machine fingerprint. `verifyShortVoucher` verifies **fully
  offline**. Voucher payload = `prints` (u16, ≤65535) + `days` (u16, clamped ≤4095) + 3-byte MAC.
- The licence file already has offline fields: `offlineQuotaCredit`, `offlineQuotaTotal`,
  `offlineExpiresAt`, plus a single-use **counter** (file + Windows registry, `getVoucherCounter` /
  `setVoucherCounter`) that rotates the request code after each redeem.

**Key realisation:** an offline *activation* is just "a voucher that **creates a licence** instead of
only topping up trial prints." Same code format, same crypto, same machine-binding. Today's gap: on a
machine with **no licence**, redeem only bumps the trial counter — it never creates a licence, so the
app never leaves trial mode. Part A closes that and makes validate/quota honour a **baked-in offline
term** without any network call.

**Confirmed product decisions:**
- **Machine-bound, 2 codes.** PC shows a 7-char Request code; provider returns an Unlock code that only
  works on that PC.
- **Provider-generated.** Unlock codes are minted on the password-gated `bridge-voucher.php` (you/dealer),
  not self-service.

---

# PART A — Offline Activation

## A1. Viewer main process — `main.js`

### A1.1 `redeemViewerVoucher` — accept a licence key and create a licence on activation
Find `function redeemViewerVoucher(code) {`. Change the signature to `(code, licenseKey)` and replace the
**no-licence branch** so a code carrying a term (`res.days > 0`) creates a server-less licence. Full target:

```js
function redeemViewerVoucher(code, licenseKey) {
    const counter = getVoucherCounter();
    const requestCode = vShortRequestCode(VIEWER_VOUCHER_SECRET, getFingerprint(), counter);
    const res = vVerifyVoucher(VIEWER_VOUCHER_SECRET, requestCode, code);
    if (!res.ok) return { ok: false, reason: res.reason };

    const lic = getLicenseData();
    const activating = !lic && res.days > 0;   // no server licence + a term => OFFLINE ACTIVATION

    if (lic) {
        // ---- existing recharge-on-licensed logic, unchanged ----
        if (res.prints > 0) {
            lic.quotaEnabled = true;
            lic.offlineQuotaCredit = Math.max(0, parseInt(lic.offlineQuotaCredit || 0, 10)) + res.prints;
            lic.offlineQuotaTotal  = Math.max(0, parseInt(lic.offlineQuotaTotal  || 0, 10)) + res.prints;
        }
        if (res.days > 0) {
            const base = Math.max(Date.now(),
                lic.offlineExpiresAt ? new Date(lic.offlineExpiresAt).getTime() : 0,
                lic.expiresAt        ? new Date(lic.expiresAt).getTime()        : 0);
            lic.offlineExpiresAt = new Date(base + res.days * 86400000).toISOString();
        }
        saveLicenseData(lic);
    } else if (activating) {
        // Create a local, server-less licence so the machine leaves trial. validateLicense() and
        // get-license-quota resolve it purely from offlineExpiresAt + offlineQuotaCredit (no network),
        // so a permanently-offline PC runs on the baked-in term + quota.
        saveLicenseData({
            licenseKey: (licenseKey && String(licenseKey).trim().toUpperCase()) || 'OFFLINE',
            fingerprint: getFingerprint(),
            plan: 'offline',
            offlineActivated: true,
            quotaEnabled: true,
            offlineQuotaCredit: res.prints,
            offlineQuotaTotal:  res.prints,
            offlineExpiresAt: new Date(Date.now() + res.days * 86400000).toISOString(),
            activatedAt:   new Date().toISOString(),
            lastValidated: new Date().toISOString(),
        });
    } else if (res.prints > 0) {
        const t = getTrialInfo();
        saveTrialInfo({ installDate: t.installDate, printsRemaining: t.printsRemaining + res.prints });
    }

    setVoucherCounter(counter + 1);   // rotate request code -> single-use
    broadcastQuotaChanged();
    const st = viewerVoucherStatus();
    return { ok: true, activated: activating, addedPrints: res.prints, addedDays: res.days,
             prints: st.prints, daysLeft: st.daysLeft };
}
```

### A1.2 `validateLicense` — offline-activated branch (skip network, honour baked-in term)
Find `async function validateLicense() {` and the line `if (!lic) return { valid: false, reason: 'no_license' };`.
Immediately **after** that line, insert:

```js
    // Offline-activated licences are server-less: authority is the baked-in term (offlineExpiresAt)
    // written at redeem time. Resolve locally and skip the network — otherwise every poll would hang
    // through the apiRequest retry budget on a permanently-offline machine.
    if (lic.offlineActivated) {
        const expMs = lic.offlineExpiresAt ? new Date(lic.offlineExpiresAt).getTime() : 0;
        const valid = expMs > Date.now();
        return { valid, expired: !valid, plan: lic.plan || 'offline',
                 expiresAt: lic.offlineExpiresAt || null, offline: true,
                 reason: valid ? undefined : 'expired' };
    }
```

### A1.3 `get-license-quota` IPC — offline-activated guard (no network)
Find `ipcMain.handle('get-license-quota', async () => {`. After the two lines computing
`offlineCredit` and `offlineTotal` (just before the `try {`), insert:

```js
    // Offline-activated licence: serve purely from the local grant. No server exists to ask, and the
    // apiRequest retry budget would otherwise hang the header refresh on a permanently-offline machine.
    if (lic.offlineActivated) {
        const expMs = lic.offlineExpiresAt ? new Date(lic.offlineExpiresAt).getTime() : 0;
        const valid = expMs > Date.now();
        return { enabled: true, remaining: valid ? offlineCredit : 0, total: offlineTotal,
                 valid, offline: true, offlineCredit, reason: valid ? undefined : 'expired' };
    }
```
(`decrement-license-quota` already debits `offlineQuotaCredit`, so no change there.)

### A1.4 New IPC `activate-offline`
Find `ipcMain.handle('redeem-voucher', (_e, { code } = {}) => redeemViewerVoucher(code));` and add below it:

```js
ipcMain.handle('activate-offline', (_e, { licenseKey, code } = {}) => redeemViewerVoucher(code, licenseKey));
```

## A2. Viewer preload — `preload.js`
In the `electronAPI` object (near `voucherStatus` / `redeemVoucher`), add:

```js
    activateOffline: ({ licenseKey, code }) => ipcRenderer.invoke('activate-offline', { licenseKey, code }),
```

## A3. Viewer UI — `www/src/components/shared/LicenseGate.tsx`
In `LicenseActivationPage` (the full-screen activation page) add a collapsible **"No internet? Activate
offline"** panel below the existing online activation button. Behaviour:
- On expand, call `(window as any).electronAPI.voucherStatus()` → show `requestCode` as text **and** a QR
  (`import { QRCodeSVG } from 'qrcode.react'` — already a dependency, used in
  `www/src/components/config/RechargeTab.tsx`).
- Two inputs: **Licence key** (`MV-XXXX-XXXX-XXXX-XXXX`, same regex as online) and **Unlock code**.
- Submit → `await electronAPI.activateOffline({ licenseKey, code })`. On `r.ok` → `fetchStatus()` (unlocks).
  On failure map `r.reason` through a REASONS object (copy the one in `RechargeTab.tsx`:
  `bad_format`, `invalid_code`, `empty_voucher`).
- Reuse the page's existing dark styling. Keep the online path as the default/primary.

Optional but nice: add the same offline panel to `TrialBanner` (so a trial user with no internet can
activate). Not required for acceptance.

## A4. Bridge main process — `bridge/main.js`

### A4.1 `redeemShortVoucher` — accept a licence key; create a licence on activation
Find `function redeemShortVoucher(code) {`. Change signature to `(code, licenseKey)` and create the
offline licence **before** the credit/expiry helpers run, so `addOfflineRechargeCredit` /
`applyOfflineExpiry` then operate on it exactly like a recharge:

```js
function redeemShortVoucher(code, licenseKey) {
  const counter = getVoucherCounter();
  const requestCode = shortRequestCode(VOUCHER_SECRET, getFingerprint(), counter);
  const res = verifyShortVoucher(VOUCHER_SECRET, requestCode, code);
  if (!res.ok) return { ok: false, reason: res.reason };

  // OFFLINE ACTIVATION: no server licence + the code carries a term => create a local, server-less
  // licence so the machine leaves trial. The credit/expiry helpers below then treat it like a recharge.
  const activating = !getLicenseData() && res.days > 0;
  if (activating) {
    saveLicenseData({
      licenseKey: (licenseKey && String(licenseKey).trim().toUpperCase()) || 'OFFLINE',
      fingerprint: getFingerprint(),
      plan: 'offline',
      offlineActivated: true,
      quotaEnabled: true,
      offlineQuotaCredit: 0,
      offlineQuotaTotal: 0,
      activatedAt:   new Date().toISOString(),
      lastValidated: new Date().toISOString(),
    });
  }

  let quota = { enabled: !!getLicenseData()?.quotaEnabled };
  if (res.prints > 0) quota = addOfflineRechargeCredit(res.prints);

  let expiresAt = effectiveExpiresAt();
  if (res.days > 0) {
    const base = Math.max(Date.now(), expiresAt ? new Date(expiresAt).getTime() : 0);
    expiresAt = applyOfflineExpiry(new Date(base + res.days * 86400000).toISOString());
  }

  setVoucherCounter(counter + 1);   // rotate request code -> single-use
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)) : null;
  return { ok: true, activated: activating, enabled: quota.enabled, remaining: quota.remaining,
           total: quota.total, addedPrints: res.prints, addedDays: res.days, expiresAt, daysLeft };
}
```
(`getLicenseStatus()` already reports an offline-activated licence correctly — it returns
`type:'licensed'` with `effectiveExpiresAt` → `daysLeft`/`expired`. No change needed.)

### A4.2 `validateBridgeLicense` — offline-activated branch
Find `async function validateBridgeLicense() {` and `if (!lic) return { valid: false, reason: 'no_license' };`.
Insert immediately after:

```js
  if (lic.offlineActivated) {
    const expMs = lic.offlineExpiresAt ? new Date(lic.offlineExpiresAt).getTime() : 0;
    const valid = expMs > Date.now();
    return { valid, expired: !valid, plan: lic.plan || 'offline',
             expiresAt: effectiveExpiresAt(lic), offline: true, reason: valid ? undefined : 'expired' };
  }
```

### A4.3 `getCentralQuota` — offline-activated guard (no network)
Find `async function getCentralQuota() {`. After the two lines computing `offlineCredit` and
`offlineTotal` (just before the `try {`), insert:

```js
  if (lic.offlineActivated) {
    const expMs = lic.offlineExpiresAt ? new Date(lic.offlineExpiresAt).getTime() : 0;
    const valid = expMs > Date.now();
    return { enabled: true, remaining: valid ? offlineCredit : 0, total: offlineTotal,
             valid, offline: true, offlineCredit, reason: valid ? undefined : 'expired' };
  }
```

### A4.4 New IPC `bridge:activate-offline`
Find `ipcMain.handle('bridge:redeem-voucher', ...)` and add below it:

```js
  ipcMain.handle('bridge:activate-offline', async (_e, { licenseKey, code } = {}) => {
    const result = redeemShortVoucher(code, licenseKey);
    if (result.ok && configWindow && !configWindow.isDestroyed()) {
      configWindow.webContents.send('bridge:quota-changed', {
        enabled: result.enabled, remaining: result.remaining, total: result.total,
      });
    }
    return result;
  });
```

## A5. Bridge preload — `bridge/preload.js`
In the `bridgeAPI` object (near `voucherStatus` / `redeemVoucher`), add:

```js
  activateOffline: ({ licenseKey, code }) => ipcRenderer.invoke('bridge:activate-offline', { licenseKey, code }),
```

## A6. Bridge UI — `bridge/ui/src/pages/LicensePage.tsx`
In the **Activation** card, add a collapsible **"No internet? Activate offline"** panel:
- On expand, `await api.voucherStatus()` → show `requestCode` + `<QRCodeSVG value={requestCode} size={92}/>`
  (`import { QRCodeSVG } from 'qrcode.react'` — already used in `bridge/ui/src/pages/RechargePage.tsx`).
- Inputs: Licence key (existing regex) + Unlock code.
- Submit → `await api.activateOffline({ licenseKey, code })`; on `ok` → `fetchStatus()`. Map `reason` via
  the REASONS object from `RechargePage.tsx`.
- Reuse `RechargePage.tsx` markup/styling for the request-code box + QR to stay visually consistent.

## A7. Website generator — `website/bridge-voucher.php`
Keep the password gate, codec, and QR photo-decode. Add:

1. **Licence-key lookup + auto-fill.** Add a `<input name="license_key">` field. On submit, if non-empty,
   look the key up and pre-fill prints/days (still overridable). Require the DB accessor at the top:
   ```php
   require_once __DIR__ . '/api/config/db.php';   // defines global db() : PDO  (same as controllers)
   ```
   Lookup (column names confirmed in `licenses`): 
   ```php
   $lk = strtoupper(trim($_POST['license_key'] ?? ''));
   if ($lk !== '') {
       $st = db()->prepare("SELECT key_code, quota_remaining, quota_total, term_days, plan, status
                              FROM licenses WHERE key_code = ? LIMIT 1");
       $st->execute([$lk]);
       $row = $st->fetch(PDO::FETCH_ASSOC);
       if (!$row) throw new \InvalidArgumentException('Licence key not found.');
       // Auto-fill (only if the operator left the fields at 0):
       if ((int)($_POST['prints'] ?? 0) === 0) $prints = (int)$row['quota_remaining'];
       if ((int)($_POST['days']   ?? 0) === 0) $days   = (int)($row['term_days'] ?? 0);
   }
   ```
2. **One-key-one-machine enforcement (server-side, recommended).** Because YOU mint the code and minting
   needs the key, mark the key consumed so it can't mint a second activation for a different PC:
   - Create a small table once (lazy, same `SHOW COLUMNS`/`CREATE TABLE IF NOT EXISTS` style the
     controllers use):
     ```sql
     CREATE TABLE IF NOT EXISTS offline_activations (
       id INT AUTO_INCREMENT PRIMARY KEY,
       key_code VARCHAR(32) NOT NULL,
       request_code VARCHAR(16) NOT NULL,
       prints INT NOT NULL, days INT NOT NULL,
       created_at DATETIME NOT NULL,
       UNIQUE KEY uniq_key (key_code)        -- one offline activation per key
     );
     ```
   - On generate with a licence key: `INSERT` here; if it violates `uniq_key`, the key was already used
     offline → show "This key has already been activated offline on another machine. Contact support to
     reset." To support legitimate reinstalls, add a checkbox **"Force re-issue (reinstall)"** that does
     `REPLACE`/`DELETE+INSERT` instead. Also set the server's own view so dashboards match:
     `UPDATE licenses SET status='active', expires_at = COALESCE(expires_at, UTC_TIMESTAMP() + INTERVAL term_days DAY) WHERE key_code = ?`.
   - This is the real binding control: the app's fingerprint check stops a code working on the wrong PC,
     and this stops a second code ever being minted for the same key.
3. **(Optional) App selector (Bridge | Viewer).** Both apps currently share the **same** secret value, so
   a selector is cosmetic today. Add a `<select name="app">` only if you intend to give the two apps
   different secrets later; map it to the matching secret in `voucher_secret()`. Leave a TODO otherwise.

---

# PART B — Hide the embedded secret

## B0. Read this first (honest limitation)
The Unlock code is verified **on the offline PC**, so the PC must hold the secret to check it. Any secret
shipped in a client app **can be extracted by a determined attacker** (debugger / memory dump). This is a
hard limit, not a bug. The only design where the secret is *never* on the device is **asymmetric** (B-Tier 4):
the app holds only a public key and could not forge anything — but its codes are ~100 chars, not
hand-typeable, which the "short code" product decision rules out. So the realistic goal here is **raise the
bar a lot**, from *"trivially greppable plaintext string"* (today) to *"needs runtime reverse-engineering"*.

> **Current state = worst case.** `const VOUCHER_SECRET = process.env.X || 'ih0OFd16…'` is a plaintext
> literal in `main.js`. The shipped `.asar` is **not encryption** — `npx @electron/asar extract app.asar out`
> (or even `strings`) reveals it instantly. The exact value is also in our chat/plan files. **Treat the
> current secret as fully compromised.**

## B1. Rotate the secret (REQUIRED — do first)
Generate a fresh 32-byte secret and use it everywhere the old one appears, in lockstep:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
Update **all three** so the codec stays byte-identical: Viewer (`main.js` `VIEWER_VOUCHER_SECRET`), Bridge
(`bridge/main.js` `VOUCHER_SECRET`), Website (`bridge-voucher.php` `VOUCHER_SECRET_DEFAULT` /
`BRIDGE_VOUCHER_SECRET` env). Old vouchers stop working — fine for a fresh rollout. Set the real value via
the server env var `BRIDGE_VOUCHER_SECRET` on the website (do **not** commit it).

## B2. Tier 1 — remove the plaintext literal; derive at runtime (REQUIRED)
Replace the single literal with a reconstruction so the secret is **not a contiguous string** in the bundle.
Create `secureSecret.js` (Viewer root, next to `voucherShort.js`) and a copy under `bridge/src/license/`:

```js
// secureSecret.js — assembles the voucher secret at runtime so it is not a
// greppable literal in the packaged .asar. NOT real protection against a
// debugger; it defeats `strings`/asar-extract grep. Keep the pieces ugly.
module.exports = function secret() {
  // 32 bytes split into 4 chunks, XOR-masked. Regenerate with the build script.
  const a = Buffer.from('....', 'base64');     // chunk0 XOR mask0
  const b = Buffer.from('....', 'base64');     // chunk1 XOR mask1
  const m = Buffer.from('....', 'base64');     // masks
  const out = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) out[i] = (i < 16 ? a[i] : b[i - 16]) ^ m[i];
  return out.toString('base64');               // same base64 the codec already expects
};
```
Then in both apps: `const VIEWER_VOUCHER_SECRET = process.env.ONECLICKZ_VOUCHER_SECRET || require('./secureSecret')();`
(Bridge: `require('./src/license/secureSecret')()`). Provide a tiny build helper that takes the rotated
secret and prints the masked chunks, so the literal never appears even in source history going forward.
**Keep `process.env` override first** so production can still inject via env at launch.

## B3. Tier 2 — compile the secret module to V8 bytecode (OPTIONAL, advanced)
Use `bytenode` to ship `secureSecret.jsc` (V8 bytecode) instead of readable JS, so the reconstruction logic
isn't plain JS either. Gotchas to honour:
- Must be compiled against **this app's Electron V8** (run the compile with the same Electron, e.g. via an
  `electron` script), or the `.jsc` won't load. Add a smoke test that `require('./secureSecret.jsc')()`
  returns 32 bytes at app start; if it throws, fall back to Tier-1 JS (don't brick the app).
- Keep it behind a build flag. If it causes startup issues in packaging, Tier 1 alone is acceptable.

## B4. Tiers 3–4 (note only — implement only if asked)
- **Tier 3 — native addon.** Put the secret + HMAC in a compiled N-API (`.node`) module so the secret never
  appears in JS or crosses the JS boundary; an attacker must disassemble the binary. Strongest practical
  symmetric option; high build cost (node-gyp / prebuilds). Mention as the escalation path.
- **Tier 4 — asymmetric (truly only-you).** App embeds only an Ed25519 **public** key; you sign with the
  private key server-side. Mathematically unforgeable, but codes become ~100 chars (QR/clipboard, not
  typeable). Only adopt if you drop the short-code requirement.

## B5. Orthogonal hardening (cheap, do them)
- Production build must **not** carry a usable plaintext fallback — keep the `process.env` path for the real
  value; the `secureSecret()` reconstruction is the shipped fallback.
- Ensure DevTools is disabled in production builds (verify it still is).
- Keep server-side validation authoritative whenever a machine *is* online (already the case).

---

## Verification (run after implementing A + B)

1. **Crypto parity (must be byte-identical):** with the **rotated** secret, pick a request code `R` and
   `prints=200, days=365`. In Node: `makeShortVoucher(secret, "R...", 200, 365)`. In PHP
   (`bridge-voucher.php` make_voucher path): same inputs. The two codes must match exactly.
2. **Offline activate (Viewer):** block `mehrgrewal.com` (Windows Firewall outbound rule, or a hosts entry
   `0.0.0.0 mehrgrewal.com`) to simulate no internet. Fresh trial state → open the offline panel → read the
   Request code → mint an Unlock code for it (with a real key) → redeem. Expect: leaves trial, header shows
   the granted prints + days-left, and **the UI does NOT hang** (no 50s freeze from the retry budget).
3. **Machine-binding:** mint an Unlock code for PC-A's request code; enter it on PC-B (different
   fingerprint) → rejected (`invalid_code`).
4. **Single-use:** re-enter the same Unlock code on PC-A after success → rejected (counter rotated).
5. **One-key-one-machine (server):** try to mint a second Unlock code for the **same licence key** (different
   request code) without "Force re-issue" → blocked by `offline_activations.uniq_key`.
6. **Term expiry:** mint with `days=1`, set the PC clock forward 2 days → `LicenseGate` (Viewer) /
   `LicensePage` (Bridge) shows expired, printing blocked.
7. **Bridge parity:** repeat 2–4 in Bridge via `LicensePage` (request code also visible on `RechargePage`).
8. **Secret is no longer greppable:** build the app, `npx @electron/asar extract` the packaged asar, and
   confirm the rotated base64 secret does **not** appear via `grep`/`strings`. (Tier 1 ⇒ absent as a literal;
   Tier 2 ⇒ logic also not readable JS.)
9. **Builds clean:** `cd www && npm run build`; `cd bridge/ui && npm run build` (tsc clean);
   `node --check main.js`; `node --check bridge/main.js`.

## Acceptance checklist
- [ ] Offline PC (no internet) activates from trial → licensed via Request+Unlock codes, no network hang.
- [ ] Unlock code is machine-bound and single-use.
- [ ] Same licence key cannot mint a second offline activation (server `offline_activations`), except via Force re-issue.
- [ ] Offline term + prints are honoured locally; expiry blocks printing.
- [ ] Secret rotated; old secret no longer used anywhere.
- [ ] Rotated secret is not a plaintext literal in the packaged app (asar-extract grep clean).
- [ ] Both renderers build clean; both `main.js` pass `node --check`.

## Files touched (summary)
- `main.js` — redeem(create-licence) · validateLicense guard · get-license-quota guard · `activate-offline` IPC · secret require
- `preload.js` — expose `activateOffline`
- `www/src/components/shared/LicenseGate.tsx` — offline activation panel
- `bridge/main.js` — same main-process changes (mirror) · secret require
- `bridge/preload.js` — expose `activateOffline`
- `bridge/ui/src/pages/LicensePage.tsx` — offline activation panel
- `website/bridge-voucher.php` — licence-key lookup/auto-fill · `offline_activations` binding · (optional app selector)
- `secureSecret.js` (+ `bridge/src/license/secureSecret.js`) — NEW, runtime secret assembly
- Codecs `voucherShort.js` / `offlineRecharge.js` — unchanged (only the secret source changes)
```
