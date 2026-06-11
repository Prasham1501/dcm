<?php
/**
 * Shared Code128 (Code-B) barcode SVG generator for RIS print assets.
 * Pure function, no side effects — safe to require from any print endpoint.
 * Guarded with function_exists so legacy inline copies do not clash.
 */
if (!defined('DICOM_VIEWER')) {
    define('DICOM_VIEWER', true);
}

if (!function_exists('ris_code128_svg')) {
    /**
     * Render an ASCII string as a Code128-B barcode SVG.
     *
     * @param string $text   Payload (printable ASCII 32..127).
     * @param int    $height Bar height in SVG units.
     * @param int    $module Module (narrowest bar) width in SVG units.
     */
    function ris_code128_svg(string $text, int $height = 54, int $module = 2): string
    {
        $patterns = [
            '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
            '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
            '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
            '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
            '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
            '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
            '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
            '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
            '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
            '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
            '114131','311141','411131','211412','211214','211232','2331112'
        ];
        $codes = [104]; // Start Code B
        $sum = 104;
        $chars = str_split($text);
        foreach ($chars as $idx => $char) {
            $code = ord($char) - 32;
            if ($code < 0 || $code > 95) { $code = 0; }
            $codes[] = $code;
            $sum += $code * ($idx + 1);
        }
        $codes[] = $sum % 103; // checksum
        $codes[] = 106;        // stop

        // Code128 spec requires a quiet zone of at least 10 modules each side.
        $quiet = 10 * $module;
        $x = $quiet;
        $bars = '';
        foreach ($codes as $code) {
            $pattern = $patterns[$code];
            for ($i = 0; $i < strlen($pattern); $i++) {
                $w = (int)$pattern[$i] * $module;
                if ($i % 2 === 0) {
                    $bars .= '<rect x="' . $x . '" y="0" width="' . $w . '" height="' . $height . '" />';
                }
                $x += $w;
            }
        }
        $total = $x + $quiet; // trailing quiet zone
        $label = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');
        return '<svg class="barcode" viewBox="0 0 ' . $total . ' ' . $height . '" preserveAspectRatio="none" aria-label="' . $label . '">' . $bars . '</svg>';
    }
}
