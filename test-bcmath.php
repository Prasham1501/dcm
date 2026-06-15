<?php
function bcpos(string $n, string $m): string {
    $r = bcmod($n, $m);
    return bccomp($r, '0') < 0 ? bcadd($r, $m) : $r;
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
function bcmodinv(string $a, string $m): string {
    $a = bcpos($a, $m);
    $g0=$m; $g1=$a; $v0='0'; $v1='1';
    while (bccomp($g1,'0')!==0) {
        $q=bcdiv($g0,$g1,0);
        [$g0,$g1]=[$g1,bcsub($g0,bcmul($q,$g1))];
        [$v0,$v1]=[$v1,bcsub($v0,bcmul($q,$v1))];
    }
    return bcpos($v0,$m);
}
function bcbits(string $n): string {
    if (bccomp($n,'0')===0) return '0';
    $s='';
    while (bccomp($n,'0')>0) { $s=bcmod($n,'2').$s; $n=bcdiv($n,'2',0); }
    return $s;
}
function bcFromLE(string $bytes): string {
    $b=array_values(unpack('C*',$bytes));
    $n='0'; $p='1';
    foreach ($b as $byte) { $n=bcadd($n,bcmul((string)$byte,$p)); $p=bcmul($p,'256'); }
    return $n;
}
function bcToLE(string $n, int $len): string {
    $out=[];
    for ($i=0;$i<$len;$i++) { $out[]=(int)bcmod($n,'256'); $n=bcdiv($n,'256',0); }
    return pack('C*',...$out);
}

$q='57896044618658097711785492504343953926634992332820282019728792003956564819949';
$l='7237005577332262213973186563042994240857116359379907606001950938285454250989';

echo "BCMath ext: ".(extension_loaded('bcmath')?'YES':'NO')."\n";
echo "2^255 mod q = ".bcpowmod2('2','255',$q)."\n";

// Full sign test
$seed_hex = '4ab6075f5f1a84fc43cd06e7502690b9eedf936d4cdc0e77e6ae29f1aa5fe6f1';

$fa=fn($a,$b)=>bcpos(bcadd($a,$b),$q);
$fs=fn($a,$b)=>bcpos(bcsub($a,$b),$q);
$fm=fn($a,$b)=>bcpos(bcmul($a,$b),$q);
$fi=fn($a)=>bcmodinv($a,$q);

$d=$fm(bcpos('-121665',$q),$fi('121666'));
$I=bcpowmod2('2',bcdiv(bcsub($q,'1'),'4',0),$q);

$By=$fm('4',$fi('5'));
$By2=$fm($By,$By);
$Bx2=$fm($fs($By2,'1'),$fi($fa($fm($d,$By2),'1')));
$Bx=bcpowmod2($Bx2,bcdiv(bcadd($q,'3'),'8',0),$q);
if (bccomp($fs($fm($Bx,$Bx),$Bx2),'0')!==0) $Bx=$fm($Bx,$I);
if (bcmod($Bx,'2')==='1') $Bx=$fs($q,$Bx);
$G=[$Bx,$By,'1',$fm($Bx,$By)];

$padd=function(array $P, array $Q) use ($d,$fa,$fs,$fm): array {
    [$X1,$Y1,$Z1,$T1]=$P; [$X2,$Y2,$Z2,$T2]=$Q;
    $A=$fm($fs($Y1,$X1),$fs($Y2,$X2));
    $B=$fm($fa($Y1,$X1),$fa($Y2,$X2));
    $C=$fm($fm($T1,'2'),$fm($d,$T2));
    $D=$fm($fm($Z1,'2'),$Z2);
    $E=$fs($B,$A); $F=$fs($D,$C); $H=$fa($D,$C); $I2=$fa($B,$A);
    return [$fm($E,$F),$fm($H,$I2),$fm($F,$H),$fm($E,$I2)];
};

$smul=function(string $s, array $P) use ($padd): array {
    $Q=['0','1','1','0'];
    foreach (str_split(bcbits($s)) as $bit) {
        $Q=$padd($Q,$Q);
        if ($bit==='1') $Q=$padd($Q,$P);
    }
    return $Q;
};

$compress=function(array $P) use ($fm,$fs,$fi,$q): string {
    [$X,$Y,$Z]=$P;
    $Zi=$fi($Z); $x=$fm($X,$Zi); $y=$fm($Y,$Zi);
    $b=bcToLE($y,32);
    if (bcmod($x,'2')==='1') $b[31]=chr(ord($b[31])|0x80);
    return $b;
};

$seed=hex2bin($seed_hex);
$h=hash('sha512',$seed,true);
$ab=array_values(unpack('C32',substr($h,0,32)));
$ab[0]&=248; $ab[31]&=127; $ab[31]|=64;
$aBytes=pack('C*',...$ab);
$prefix=substr($h,32,32);
$a=bcFromLE($aBytes);
$A=$compress($smul($a,$G));
echo "Public key (hex): ".bin2hex($A)."\n";

// Sign a test message
$message='test-payload-for-bcmath';
$r=bcpos(bcFromLE(hash('sha512',$prefix.$message,true)),$l);
$R=$compress($smul($r,$G));
$k=bcpos(bcFromLE(hash('sha512',$R.$A.$message,true)),$l);
$S=bcpos(bcadd($r,bcmul($k,$a)),$l);
$sig=$R.bcToLE($S,32);
echo "Signature (hex): ".bin2hex($sig)."\n";
echo "Sig length: ".strlen($sig)." bytes\n";
echo "DONE\n";
