<?php
/**
 * Shared helpers for lab result entry: patient age, reference-range resolution,
 * H/L flagging, and safe formula evaluation for derived parameters (e.g. eAG).
 * Pure functions — safe to require from any endpoint.
 */
if (!defined('DICOM_VIEWER')) { define('DICOM_VIEWER', true); }

if (!function_exists('ris_patient_age_days')) {
    function ris_patient_age_days(array $patient): int
    {
        $dob = trim((string)($patient['dob'] ?? ''));
        if ($dob !== '' && $dob !== '0000-00-00') {
            $ts = strtotime($dob);
            if ($ts !== false) {
                return max(0, (int)floor((time() - $ts) / 86400));
            }
        }
        $y = (int)($patient['age_years'] ?? 0);
        $m = (int)($patient['age_months'] ?? 0);
        $d = (int)($patient['age_days'] ?? 0);
        return $y * 365 + $m * 30 + $d;
    }

    /** Pick the best-matching reference range for a parameter given sex + age (days). */
    function ris_resolve_range(array $ranges, string $sex, int $ageDays): ?array
    {
        $sex = strtolower($sex);
        $best = null;
        foreach ($ranges as $r) {
            $rsex = strtolower((string)($r['sex'] ?? 'any'));
            if ($rsex !== 'any' && $rsex !== $sex) { continue; }
            $min = (int)($r['age_min_days'] ?? 0);
            $max = (int)($r['age_max_days'] ?? 54750);
            if ($ageDays < $min || $ageDays > $max) { continue; }
            // Prefer a sex-specific match over an 'any' match.
            if ($best === null || ($rsex !== 'any' && strtolower((string)$best['sex']) === 'any')) {
                $best = $r;
            }
        }
        return $best;
    }

    /** Return 'L' | 'H' | 'N' | '' for a value against a resolved range. */
    function ris_flag($value, ?array $range): string
    {
        if ($range === null) { return ''; }
        if (!is_numeric($value)) { return ''; }
        $v = (float)$value;
        $low = $range['low'];
        $high = $range['high'];
        if ($low !== null && $v < (float)$low) { return 'L'; }
        if ($high !== null && $v > (float)$high) { return 'H'; }
        if ($low !== null || $high !== null) { return 'N'; }
        return '';
    }

    /**
     * Evaluate a derived-parameter formula. Reference other parameters with
     * {Parameter Name} placeholders, e.g. "28.7*{HBA1C} - 46.7".
     * Supports + - * / and parentheses on decimal numbers. Returns null on failure.
     *
     * @param array $valuesByName  name(lowercased) => numeric value
     */
    function ris_eval_formula(string $formula, array $valuesByName): ?string
    {
        $expr = preg_replace_callback('/\{([^}]+)\}/', function ($m) use ($valuesByName) {
            $key = strtolower(trim($m[1]));
            return isset($valuesByName[$key]) && is_numeric($valuesByName[$key]) ? '(' . (float)$valuesByName[$key] . ')' : 'NaN';
        }, $formula);
        if (strpos($expr, 'NaN') !== false) { return null; }
        if (!preg_match('/^[0-9+\-*\/(). ]+$/', $expr)) { return null; }
        $result = ris_eval_arith($expr);
        if ($result === null || !is_finite($result)) { return null; }
        return (string)round($result, 4);
    }

    /** Minimal safe arithmetic evaluator (shunting-yard). + - * / and parentheses. */
    function ris_eval_arith(string $expr): ?float
    {
        $tokens = [];
        preg_match_all('/\d+\.?\d*|[+\-*\/()]/', $expr, $matches);
        $tokens = $matches[0];
        if (!$tokens) { return null; }
        $prec = ['+' => 1, '-' => 1, '*' => 2, '/' => 2];
        $output = [];
        $ops = [];
        $prev = null;
        foreach ($tokens as $t) {
            if (is_numeric($t)) {
                $output[] = (float)$t;
            } elseif ($t === '(') {
                $ops[] = $t;
            } elseif ($t === ')') {
                while ($ops && end($ops) !== '(') { $output[] = array_pop($ops); }
                if (!$ops) { return null; }
                array_pop($ops);
            } else {
                // Unary minus/plus handling.
                if (($t === '-' || $t === '+') && ($prev === null || $prev === '(' || isset($prec[$prev]))) {
                    $output[] = 0.0;
                }
                while ($ops && end($ops) !== '(' && $prec[end($ops)] >= $prec[$t]) { $output[] = array_pop($ops); }
                $ops[] = $t;
            }
            $prev = $t;
        }
        while ($ops) { $op = array_pop($ops); if ($op === '(') { return null; } $output[] = $op; }

        $stack = [];
        foreach ($output as $tok) {
            if (is_float($tok)) { $stack[] = $tok; continue; }
            $b = array_pop($stack);
            $a = array_pop($stack);
            if ($a === null || $b === null) { return null; }
            switch ($tok) {
                case '+': $stack[] = $a + $b; break;
                case '-': $stack[] = $a - $b; break;
                case '*': $stack[] = $a * $b; break;
                case '/': if ($b == 0.0) { return null; } $stack[] = $a / $b; break;
            }
        }
        return count($stack) === 1 ? (float)$stack[0] : null;
    }
}
