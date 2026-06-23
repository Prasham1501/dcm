<?php
/**
 * One Clickz Bridge — Offline Voucher Generator (short codes)
 * URL: https://mehrgrewal.com/mediview/bridge-voucher.php
 *
 * The operator on an offline Bridge reads you a short REQUEST code (7 chars) from
 * the Recharge tab. Enter it here with the prints to add and/or days to extend;
 * this returns a 12-char VOUCHER code they type back in.
 *
 * The HMAC + Crockford-base32 here MUST stay byte-for-byte identical to
 * bridge/src/license/offlineRecharge.js (shortRequestCode / makeShortVoucher).
 *
 * Config (api/.env or server env):
 *   BRIDGE_VOUCHER_SECRET    – 256-bit secret, SAME value embedded in the Bridge.
 *   BRIDGE_VOUCHER_PASSWORD  – password for this page (default kept for continuity).
 */
declare(strict_types=1);
session_start();

// ── Load .env ─────────────────────────────────────────────────────────────────
$envFile = __DIR__ . '/api/.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (str_starts_with(trim($line), '#') || !str_contains($line, '=')) continue;
        [$k, $v] = explode('=', $line, 2);
        $k = trim($k); $v = trim($v);
        if (!isset($_ENV[$k])) { $_ENV[$k] = $v; putenv("$k=$v"); }
    }
}

$PAGE_PASSWORD = getenv('BRIDGE_VOUCHER_PASSWORD') ?: 'Prasham123$';

// Same DB the rest of /api uses — needed for the licence-key lookup + the
// offline_activations binding table (one offline activation per licence key).
require_once __DIR__ . '/api/config/db.php';

// Must match the value embedded in the Bridge (offlineRecharge.js / main.js).
// Set BRIDGE_VOUCHER_SECRET in the environment for production. Updated to the
// rotated secret — the previous literal was already public in the source tree
// and treated as compromised.
const VOUCHER_SECRET_DEFAULT = '68aYblxmiI1Ds0Ss3LKW12DvmsTI6XAnFCwAPRA2TyM=';
function voucher_secret(): string {
    $s = getenv('BRIDGE_VOUCHER_SECRET');
    return ($s !== false && $s !== '') ? $s : VOUCHER_SECRET_DEFAULT;
}

/** Lazily create the binding table the first time the page is hit, so a fresh
 *  DB doesn't 500. UNIQUE on key_code is the real one-key-one-machine control:
 *  a second mint for the same licence trips it and we refuse without the
 *  "Force re-issue" override. */
function ensure_offline_activations_table(): void {
    try {
        db()->exec("CREATE TABLE IF NOT EXISTS offline_activations (
          id INT AUTO_INCREMENT PRIMARY KEY,
          key_code     VARCHAR(32) NOT NULL,
          request_code VARCHAR(16) NOT NULL,
          prints INT NOT NULL,
          days   INT NOT NULL,
          created_at DATETIME NOT NULL,
          UNIQUE KEY uniq_key (key_code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    } catch (\Throwable $e) { error_log('[bridge-voucher] ensure_offline_activations_table: ' . $e->getMessage()); }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
$authErr = '';
if (isset($_POST['logout']))   unset($_SESSION['bv_authed']);
if (isset($_POST['password'])) {
    if (hash_equals($PAGE_PASSWORD, (string)$_POST['password'])) $_SESSION['bv_authed'] = true;
    else $authErr = 'Wrong password.';
}
$authed = !empty($_SESSION['bv_authed']);

// ── Short voucher codec (mirrors the Bridge) ────────────────────────────────────
function short_base32_encode(string $bytes): string {
    $alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    $bits = 0; $value = 0; $out = '';
    $len = strlen($bytes);
    for ($i = 0; $i < $len; $i++) {
        $value = ($value << 8) | ord($bytes[$i]);
        $bits += 8;
        while ($bits >= 5) { $out .= $alphabet[($value >> ($bits - 5)) & 31]; $bits -= 5; }
        $value &= (1 << $bits) - 1;
    }
    if ($bits > 0) $out .= $alphabet[($value << (5 - $bits)) & 31];
    return $out;
}

/** Normalise the request code the same lenient way the Bridge decodes. */
function normalize_request(string $s): string {
    $s = strtoupper(trim($s));
    $s = strtr($s, 'OILU', '011V');
    return preg_replace('/[^0-9A-Z]/', '', $s);
}

function make_voucher(string $requestCode, int $prints, int $days): string {
    $prints = max(0, min(65535, $prints));
    $days   = max(0, min(4095, $days));
    $payload = pack('n', $prints) . pack('n', $days);                 // big-endian u16 ×2
    $mac = substr(hash_hmac('sha256', "vch|{$requestCode}|{$prints}|{$days}", voucher_secret(), true), 0, 3);
    return short_base32_encode($payload . $mac);
}
function group_code(string $code): string { return trim(implode('-', str_split($code, 4)), '-'); }

// ── Handle POST ───────────────────────────────────────────────────────────────
$voucher = ''; $vErr = ''; $vInfo = ''; $licenseInfo = '';
if ($authed && isset($_POST['generate'])) {
    try {
        $req     = normalize_request($_POST['request_code'] ?? '');
        $prints  = max(0, min(65535, (int)($_POST['prints'] ?? 0)));
        $days    = max(0, min(4095,  (int)($_POST['days'] ?? 0)));
        $lk      = strtoupper(trim((string)($_POST['license_key'] ?? '')));
        $force   = !empty($_POST['force_reissue']);
        if (strlen($req) < 5)            throw new \InvalidArgumentException('Enter the Request code shown on the Bridge.');

        // ── Licence-key lookup: auto-fill prints/days if operator left them at 0,
        //    and enforce one-offline-activation-per-key via offline_activations.
        if ($lk !== '') {
            ensure_offline_activations_table();
            $st = db()->prepare("SELECT key_code, quota_remaining, quota_total, term_days, plan, status
                                   FROM licenses WHERE key_code = ? LIMIT 1");
            $st->execute([$lk]);
            $row = $st->fetch(PDO::FETCH_ASSOC);
            if (!$row) throw new \InvalidArgumentException('Licence key not found.');
            if ($row['status'] !== 'active') throw new \InvalidArgumentException('Licence is not active (status: ' . $row['status'] . ').');

            // Auto-fill only when the operator left the field at 0 so they can
            // still override (e.g. issue extra recharge days on top of a paid key).
            if ($prints === 0) $prints = (int)$row['quota_remaining'];
            if ($days   === 0) $days   = (int)($row['term_days'] ?? 0);

            // One-key-one-machine: refuse a second mint for the same key unless
            // the operator explicitly ticks "Force re-issue" (reinstall path).
            $check = db()->prepare("SELECT request_code, created_at FROM offline_activations WHERE key_code = ? LIMIT 1");
            $check->execute([$lk]);
            $existing = $check->fetch(PDO::FETCH_ASSOC);
            if ($existing && !$force) {
                throw new \InvalidArgumentException(
                    'This key has already been activated offline on ' . substr((string)$existing['created_at'], 0, 10)
                    . ' (request ' . $existing['request_code'] . '). Tick "Force re-issue" to allow a reinstall.'
                );
            }
        }

        if ($prints <= 0 && $days <= 0)  throw new \InvalidArgumentException('Enter prints to add and/or days to extend (or pick a licence key with those set).');

        $voucher = group_code(make_voucher($req, $prints, $days));
        $bits = [];
        if ($prints > 0) $bits[] = "{$prints} prints";
        if ($days > 0)   $bits[] = "{$days} days";
        $vInfo = 'Grants ' . implode(' + ', $bits) . ' on request ' . $req . '.';

        // Record / refresh the offline activation row and sync the dashboard
        // view so the licence shows up as active for the same term.
        if ($lk !== '') {
            try {
                db()->prepare("REPLACE INTO offline_activations (key_code, request_code, prints, days, created_at)
                                VALUES (?,?,?,?, UTC_TIMESTAMP())")
                    ->execute([$lk, $req, $prints, $days]);
                db()->prepare("UPDATE licenses
                                  SET status     = 'active',
                                      expires_at = COALESCE(expires_at, DATE_ADD(UTC_TIMESTAMP(), INTERVAL term_days DAY))
                                WHERE key_code = ?")->execute([$lk]);
                $licenseInfo = $force
                    ? 'Re-issued offline activation for ' . $lk . '.'
                    : 'Recorded offline activation for ' . $lk . '.';
            } catch (\Throwable $e) {
                error_log('[bridge-voucher] activation record failed: ' . $e->getMessage());
            }
        }
    } catch (\Throwable $e) { $vErr = $e->getMessage(); }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Bridge Recharge — One Clickz</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f1117;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
.card{background:#1a1d27;border:1px solid #2d3148;border-radius:12px;padding:1.5rem;width:100%;max-width:480px}
.logo{font-size:.7rem;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:#6366f1;margin-bottom:.25rem}
h1{font-size:1.1rem;font-weight:700;color:#f1f5f9;margin-bottom:1.25rem}
label{display:block;font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:.35rem;margin-top:1rem}
input[type=text],input[type=password],input[type=number]{width:100%;background:#0f1117;border:1px solid #2d3148;border-radius:8px;color:#e2e8f0;padding:.65rem .75rem;font-size:.85rem;font-family:inherit;outline:none}
input:focus{border-color:#6366f1}
.row{display:flex;gap:.75rem}.row>div{flex:1}
.btn{display:block;width:100%;margin-top:1.25rem;background:#6366f1;color:#fff;border:none;border-radius:8px;padding:.75rem;font-size:.9rem;font-weight:600;cursor:pointer}
.btn:active{background:#4f46e5}
.btn-sm{display:inline-block;width:auto;padding:.4rem .9rem;font-size:.78rem;border-radius:6px;margin-top:0;background:#2d3148;color:#94a3b8;border:none;cursor:pointer}
.err{background:#450a0a;border:1px solid #7f1d1d;color:#fca5a5;border-radius:8px;padding:.65rem .75rem;font-size:.82rem;margin-top:1rem}
.ok{background:#052e16;border:1px solid #14532d;color:#86efac;border-radius:8px;padding:.65rem .75rem;font-size:.82rem;margin-top:1rem}
.vbox{background:#0f1117;border:1px solid #6366f1;border-radius:8px;padding:1rem;margin-top:1rem;text-align:center;font-family:monospace;font-size:1.6rem;font-weight:800;letter-spacing:.18em;color:#a5b4fc}
.copy{display:block;width:100%;margin-top:.5rem;background:#1e1b4b;color:#a5b4fc;border:1px solid #4f46e5;border-radius:6px;padding:.55rem;font-size:.82rem;font-weight:600;cursor:pointer}
.copy:active{background:#312e81}
.hint{font-size:.72rem;color:#475569;margin-top:.5rem}
.logout{text-align:right;margin-bottom:1rem}
</style>
</head>
<body>
<div class="card">
<div class="logo">One Clickz</div>
<h1>Bridge Recharge</h1>
<?php if(!$authed):?>
<form method="post">
  <label>Admin password</label>
  <input type="password" name="password" autofocus autocomplete="current-password" placeholder="••••••••">
  <?php if($authErr):?><div class="err"><?=htmlspecialchars($authErr)?></div><?php endif?>
  <button type="submit" class="btn">Sign in</button>
</form>
<?php else:?>
<div class="logout"><form method="post" style="display:inline"><button type="submit" name="logout" value="1" class="btn-sm">Sign out</button></form></div>
<form method="post">
  <label>Licence key <span style="color:#64748b;font-weight:400;text-transform:none;letter-spacing:0">(optional — auto-fills prints/days and binds the key to this machine)</span></label>
  <input type="text" name="license_key" placeholder="MV-XXXX-XXXX-XXXX-XXXX" style="text-transform:uppercase;letter-spacing:.05em;font-family:monospace" value="<?=htmlspecialchars($_POST['license_key']??'')?>" maxlength="23">
  <label style="margin-top:.6rem">Request code (from the Bridge Recharge tab)</label>
  <input type="text" name="request_code" placeholder="e.g. A4RC9DP" style="text-transform:uppercase;letter-spacing:.1em" value="<?=htmlspecialchars($_POST['request_code']??'')?>" required>
  <label style="margin-top:.6rem">…or upload a photo of the QR code</label>
  <input type="file" accept="image/*" id="qrfile" style="font-size:.8rem;color:#94a3b8">
  <div id="qrmsg" class="hint"></div>
  <div class="row">
    <div><label>Prints to add</label><input type="number" name="prints" min="0" max="65535" value="<?=htmlspecialchars($_POST['prints']??'0')?>"></div>
    <div><label>Days to extend</label><input type="number" name="days" min="0" max="4095" value="<?=htmlspecialchars($_POST['days']??'0')?>"></div>
  </div>
  <label style="display:flex;align-items:center;gap:.5rem;margin-top:.85rem;font-size:.72rem;color:#94a3b8;text-transform:none;letter-spacing:0;font-weight:500">
    <input type="checkbox" name="force_reissue" value="1" <?= !empty($_POST['force_reissue']) ? 'checked' : '' ?> style="width:auto;margin:0">
    Force re-issue (reinstall) — only for legitimate reinstalls
  </label>
  <button type="submit" name="generate" value="1" class="btn">Generate Unlock Code</button>
</form>
<?php if($vErr):?><div class="err"><?=htmlspecialchars($vErr)?></div><?php endif?>
<?php if($voucher):?>
  <div class="ok"><?=htmlspecialchars($vInfo)?><?php if($licenseInfo):?><br><?=htmlspecialchars($licenseInfo)?><?php endif?></div>
  <div class="vbox" id="vch"><?=htmlspecialchars($voucher)?></div>
  <button class="copy" onclick="copyV(this)">Copy unlock code</button>
  <div class="hint">Read this to the operator → Bridge/Viewer offline panel → paste → Activate. Single-use, tied to that request code.</div>
<?php endif?>
<?php endif?>
</div>
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"></script>
<script>
// Decode an uploaded QR photo entirely in the browser and fill the request code.
(function(){
  var f=document.getElementById('qrfile'); if(!f) return;
  var msg=document.getElementById('qrmsg');
  f.addEventListener('change', function(){
    var file=f.files&&f.files[0]; if(!file) return;
    msg.textContent='Reading…';
    var img=new Image();
    img.onload=function(){
      var max=1200, scale=Math.min(1, max/Math.max(img.width,img.height));
      var c=document.createElement('canvas'); c.width=Math.round(img.width*scale); c.height=Math.round(img.height*scale);
      var ctx=c.getContext('2d'); ctx.drawImage(img,0,0,c.width,c.height);
      var data;
      try { data=ctx.getImageData(0,0,c.width,c.height); } catch(e){ msg.textContent='Could not read the image.'; return; }
      var code=(typeof jsQR!=='undefined')?jsQR(data.data,c.width,c.height):null;
      if(code&&code.data){
        var inp=document.querySelector('input[name=request_code]');
        inp.value=String(code.data).trim().toUpperCase();
        msg.textContent='✓ Read code: '+inp.value;
      } else { msg.textContent='Could not read a QR code — try a clearer photo, or type the code.'; }
      URL.revokeObjectURL(img.src);
    };
    img.onerror=function(){ msg.textContent='Could not load that image.'; };
    img.src=URL.createObjectURL(file);
  });
})();
function copyV(btn){
  var t=document.getElementById('vch').textContent.trim();
  if(navigator.clipboard){navigator.clipboard.writeText(t).then(function(){btn.textContent='Copied!';setTimeout(function(){btn.textContent='Copy voucher'},2000)});}
  else{var a=document.createElement('textarea');a.value=t;a.style.cssText='position:fixed;opacity:0';document.body.appendChild(a);a.select();document.execCommand('copy');document.body.removeChild(a);btn.textContent='Copied!';setTimeout(function(){btn.textContent='Copy voucher'},2000);}
}
</script>
</body>
</html>
