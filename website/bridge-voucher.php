<?php
/**
 * One Clickz Bridge — Mobile Voucher Generator
 * URL: https://mehrgrewal.com/mediview/bridge-voucher.php
 *
 * Pure PHP Ed25519 signing using BCMath — no GMP, no sodium required.
 * BCMath is enabled by default on all GoDaddy shared hosting.
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

// ── Auth ──────────────────────────────────────────────────────────────────────
$authErr = '';
if (isset($_POST['logout']))    unset($_SESSION['bv_authed']);
if (isset($_POST['password'])) {
    if ($_POST['password'] === $PAGE_PASSWORD) $_SESSION['bv_authed'] = true;
    else $authErr = 'Wrong password.';
}
$authed = !empty($_SESSION['bv_authed']);

// ── BCMath big-integer helpers ─────────────────────────────────────────────────
function bcpos(string $n, string $m): string {
    $r = bcmod($n, $m);
    return bccomp($r, '0') < 0 ? bcadd($r, $m) : $r;
}
function bcmodinv(string $a, string $m): string {
    $a = bcpos($a, $m);
    $g0 = $m; $g1 = $a; $v0 = '0'; $v1 = '1';
    while (bccomp($g1, '0') !== 0) {
        $q  = bcdiv($g0, $g1, 0);
        [$g0,$g1] = [$g1, bcsub($g0, bcmul($q,$g1))];
        [$v0,$v1] = [$v1, bcsub($v0, bcmul($q,$v1))];
    }
    return bcpos($v0, $m);
}
function bcpowmod2(string $b, string $e, string $m): string {
    $r = '1'; $b = bcpos($b, $m);
    while (bccomp($e, '0') > 0) {
        if (bcmod($e, '2') === '1') $r = bcpos(bcmul($r,$b), $m);
        $e = bcdiv($e, '2', 0);
        $b = bcpos(bcmul($b,$b), $m);
    }
    return $r;
}
function bcbits(string $n): string {
    if (bccomp($n,'0')===0) return '0';
    $s='';
    while (bccomp($n,'0')>0) { $s=bcmod($n,'2').$s; $n=bcdiv($n,'2',0); }
    return $s;
}
function bcFromLE(string $bytes): string {
    $b = array_values(unpack('C*', $bytes));
    $n='0'; $p='1';
    foreach ($b as $byte) { $n=bcadd($n,bcmul((string)$byte,$p)); $p=bcmul($p,'256'); }
    return $n;
}
function bcToLE(string $n, int $len): string {
    $out=[];
    for ($i=0;$i<$len;$i++) { $out[]=(int)bcmod($n,'256'); $n=bcdiv($n,'256',0); }
    return pack('C*',...$out);
}

// ── Pure BCMath Ed25519 signing ────────────────────────────────────────────────
function ed25519_sign(string $message, string $seed_hex): string {
    if (!extension_loaded('bcmath')) throw new \RuntimeException('BCMath extension not available on this server. Please contact your host.');

    // Field prime and group order
    $q = '57896044618658097711785492504343953926634992332820282019728792003956564819949';
    $l = '7237005577332262213973186563042994240857116359379907606001950938285454250989';

    // Field arithmetic mod q
    $fa = fn($a,$b)=>bcpos(bcadd($a,$b),$q);
    $fs = fn($a,$b)=>bcpos(bcsub($a,$b),$q);
    $fm = fn($a,$b)=>bcpos(bcmul($a,$b),$q);
    $fi = fn($a)   =>bcmodinv($a,$q);

    // Curve constant d = -121665/121666 mod q
    $d = $fm(bcpos('-121665',$q), $fi('121666'));
    // sqrt(-1) mod q
    $I = bcpowmod2('2', bcdiv(bcsub($q,'1'),'4',0), $q);

    // Base-point y = 4/5 mod q; recover x
    $By  = $fm('4', $fi('5'));
    $By2 = $fm($By,$By);
    $Bx2 = $fm($fs($By2,'1'), $fi($fa($fm($d,$By2),'1')));
    $Bx  = bcpowmod2($Bx2, bcdiv(bcadd($q,'3'),'8',0), $q);
    if (bccomp($fs($fm($Bx,$Bx),$Bx2),'0')!==0) $Bx=$fm($Bx,$I);
    if (bcmod($Bx,'2')==='1') $Bx=$fs($q,$Bx);
    $G = [$Bx,$By,'1',$fm($Bx,$By)]; // extended coord [X,Y,Z,T]

    // Extended-coordinate point addition
    $padd = function(array $P, array $Q) use ($d,$fa,$fs,$fm): array {
        [$X1,$Y1,$Z1,$T1]=$P; [$X2,$Y2,$Z2,$T2]=$Q;
        $A=$fm($fs($Y1,$X1),$fs($Y2,$X2));
        $B=$fm($fa($Y1,$X1),$fa($Y2,$X2));
        $C=$fm($fm($T1,'2'),$fm($d,$T2));
        $D=$fm($fm($Z1,'2'),$Z2);
        $E=$fs($B,$A); $F=$fs($D,$C); $H=$fa($D,$C); $I2=$fa($B,$A);
        return [$fm($E,$F),$fm($H,$I2),$fm($F,$H),$fm($E,$I2)];
    };

    // Scalar multiply: s * P  (double-and-add, MSB first)
    $smul = function(string $s, array $P) use ($padd): array {
        $Q=['0','1','1','0'];
        foreach (str_split(bcbits($s)) as $bit) {
            $Q=$padd($Q,$Q);
            if ($bit==='1') $Q=$padd($Q,$P);
        }
        return $Q;
    };

    // Compress extended point to 32 LE bytes
    $compress = function(array $P) use ($fm,$fs,$fi,$q): string {
        [$X,$Y,$Z]=$P;
        $Zi=$fi($Z); $x=$fm($X,$Zi); $y=$fm($Y,$Zi);
        $b=bcToLE($y,32);
        if (bcmod($x,'2')==='1') $b[31]=chr(ord($b[31])|0x80);
        return $b;
    };

    // ── Sign ──────────────────────────────────────────────────────────────────
    $seed   = hex2bin($seed_hex);
    $h      = hash('sha512', $seed, true);

    // Clamp scalar
    $ab     = array_values(unpack('C32', substr($h,0,32)));
    $ab[0] &=248; $ab[31]&=127; $ab[31]|=64;
    $aBytes = pack('C*',...$ab);
    $prefix = substr($h,32,32);

    $a  = bcFromLE($aBytes);
    $A  = $compress($smul($a,$G));          // public key bytes

    $r  = bcpos(bcFromLE(hash('sha512',$prefix.$message,true)), $l);
    $R  = $compress($smul($r,$G));

    $k  = bcpos(bcFromLE(hash('sha512',$R.$A.$message,true)), $l);
    $S  = bcpos(bcadd($r,bcmul($k,$a)), $l);

    return $R . bcToLE($S,32);              // 64-byte raw signature
}

// ── Voucher helpers ───────────────────────────────────────────────────────────
function b64u(string $b): string { return rtrim(strtr(base64_encode($b),'+/','-_'),'='); }
function ub64(string $s): string {
    $r=strtr($s,'-_','+/');
    return base64_decode($r.str_repeat('=',strlen($r)%4?4-strlen($r)%4:0));
}
function decode_request(string $code): array {
    $parts=explode('.',$code,2);
    if(count($parts)!==2||$parts[0]!=='OCZREQ1') throw new \InvalidArgumentException('Not a valid OCZREQ1 code.');
    $d=json_decode(ub64($parts[1]),true);
    if(!is_array($d)) throw new \InvalidArgumentException('Cannot decode request payload.');
    return $d;
}
function make_voucher(array $req, int $prints): string {
    $seedHex=getenv('BRIDGE_SIGNING_KEY_HEX');
    if(!$seedHex||strlen($seedHex)!==64) throw new \RuntimeException('BRIDGE_SIGNING_KEY_HEX missing or wrong length in .env.');
    $now=time();
    $payload=[
        'type'        =>'bridge-offline-recharge',
        'voucherId'   =>bin2hex(random_bytes(12)),
        'requestId'   =>$req['requestId'],
        'fingerprint' =>$req['fingerprint'],
        'licenseKey'  =>$req['licenseKey']??'TRIAL',
        'issuedAt'    =>gmdate('Y-m-d\TH:i:s.000\Z'),
        'expiresAt'   =>gmdate('Y-m-d\TH:i:s.000\Z',$now+7*86400),
        'prints'      =>$prints,
    ];
    $p64 = b64u(json_encode($payload,JSON_UNESCAPED_SLASHES));
    $sig = ed25519_sign($p64, $seedHex);
    return 'OCZV1.'.$p64.'.'.b64u($sig);
}

// ── Handle POST ───────────────────────────────────────────────────────────────
$voucher=''; $vErr=''; $vInfo='';
if ($authed && isset($_POST['generate'])) {
    try {
        $rc     = trim($_POST['request_code']??'');
        $prints = max(1,min(1000000,(int)($_POST['prints']??0)));
        if (!$rc) throw new \InvalidArgumentException('Paste the OCZREQ1 request code.');
        $req = decode_request($rc);
        if(($req['type']??'')!=='bridge-recharge-request')
            throw new \InvalidArgumentException('This is not a bridge recharge request code.');
        $exp=isset($req['expiresAt'])?strtotime($req['expiresAt']):0;
        if($exp&&$exp<time())
            throw new \InvalidArgumentException('Request expired at '.gmdate('H:i \U\T\C',$exp).'. Generate a fresh one in the bridge app.');
        $voucher=make_voucher($req,$prints);
        $vInfo="{$prints} prints granted for device ".substr($req['fingerprint']??'',0,8).'…';
        // Optional DB log — best-effort
        try {
            require_once __DIR__.'/api/config/db.php';
            $vp=json_decode(ub64(explode('.',$voucher)[1]),true);
            db()->exec("CREATE TABLE IF NOT EXISTS bridge_recharges(
              id VARCHAR(16) NOT NULL,request_id VARCHAR(64) NOT NULL,
              fingerprint VARCHAR(64) DEFAULT '',license_key VARCHAR(64) DEFAULT 'TRIAL',
              prints_granted INT UNSIGNED DEFAULT 0,voucher_id VARCHAR(64) DEFAULT '',
              created_at DATETIME NOT NULL,
              PRIMARY KEY(id),UNIQUE KEY uq_req(request_id)
            )ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            $s=db()->prepare("INSERT IGNORE INTO bridge_recharges(id,request_id,fingerprint,license_key,prints_granted,voucher_id,created_at)VALUES(?,?,?,?,?,?,?)");
            $s->execute([bin2hex(random_bytes(8)),$req['requestId'],$req['fingerprint']??'',$req['licenseKey']??'TRIAL',$prints,$vp['voucherId']??'',gmdate('Y-m-d H:i:s')]);
        } catch(\Throwable $e){error_log('[bridge-voucher] DB: '.$e->getMessage());}
    } catch(\Throwable $e){$vErr=$e->getMessage();}
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
input[type=text],input[type=password],input[type=number],textarea{width:100%;background:#0f1117;border:1px solid #2d3148;border-radius:8px;color:#e2e8f0;padding:.65rem .75rem;font-size:.85rem;font-family:inherit;outline:none}
input:focus,textarea:focus{border-color:#6366f1}
textarea{font-family:monospace;font-size:.72rem;resize:vertical;min-height:90px}
.btn{display:block;width:100%;margin-top:1.25rem;background:#6366f1;color:#fff;border:none;border-radius:8px;padding:.75rem;font-size:.9rem;font-weight:600;cursor:pointer}
.btn:active{background:#4f46e5}
.btn-sm{display:inline-block;width:auto;padding:.4rem .9rem;font-size:.78rem;border-radius:6px;margin-top:0;background:#2d3148;color:#94a3b8;border:none;cursor:pointer}
.err{background:#450a0a;border:1px solid #7f1d1d;color:#fca5a5;border-radius:8px;padding:.65rem .75rem;font-size:.82rem;margin-top:1rem}
.ok{background:#052e16;border:1px solid #14532d;color:#86efac;border-radius:8px;padding:.65rem .75rem;font-size:.82rem;margin-top:1rem}
.vbox{background:#0f1117;border:1px solid #6366f1;border-radius:8px;padding:.75rem;margin-top:1rem;font-family:monospace;font-size:.68rem;color:#a5b4fc;word-break:break-all;line-height:1.5}
.copy{display:block;width:100%;margin-top:.5rem;background:#1e1b4b;color:#a5b4fc;border:1px solid #4f46e5;border-radius:6px;padding:.55rem;font-size:.82rem;font-weight:600;cursor:pointer}
.copy:active{background:#312e81}
.hint{font-size:.72rem;color:#475569;margin-top:.5rem}
.logout{text-align:right;margin-bottom:1rem}
</style>
</head>
<body>
<div class="card">
<div class="logo">One Clickz</div>
<h1>Bridge Print Recharge</h1>
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
  <label>Request code (OCZREQ1… from bridge app)</label>
  <textarea name="request_code" placeholder="OCZREQ1.eyJ..." required><?=htmlspecialchars($_POST['request_code']??'')?></textarea>
  <label>Prints to grant</label>
  <input type="number" name="prints" min="1" max="1000000" value="<?=htmlspecialchars($_POST['prints']??'100')?>" required>
  <button type="submit" name="generate" value="1" class="btn">Generate Voucher</button>
</form>
<?php if($vErr):?><div class="err"><?=htmlspecialchars($vErr)?></div><?php endif?>
<?php if($voucher):?>
  <div class="ok"><?=htmlspecialchars($vInfo)?></div>
  <div class="vbox" id="vch"><?=htmlspecialchars($voucher)?></div>
  <button class="copy" onclick="copyV(this)">Copy voucher</button>
  <div class="hint">Paste into bridge app → Recharge dialog → Apply Recharge.</div>
<?php endif?>
<?php endif?>
</div>
<script>
function copyV(btn){
  var t=document.getElementById('vch').textContent.trim();
  if(navigator.clipboard){navigator.clipboard.writeText(t).then(function(){btn.textContent='Copied!';setTimeout(function(){btn.textContent='Copy voucher'},2000)});}
  else{var a=document.createElement('textarea');a.value=t;a.style.cssText='position:fixed;opacity:0';document.body.appendChild(a);a.select();document.execCommand('copy');document.body.removeChild(a);btn.textContent='Copied!';setTimeout(function(){btn.textContent='Copy voucher'},2000);}
}
</script>
</body>
</html>
