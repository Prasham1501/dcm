<?php
/**
 * Test runner. Discovers and executes every tests/php/*Test.php file.
 * Exits non-zero if any test fails (so CI / run-all-tests can gate on it).
 */
require __DIR__ . '/php/_harness.php';

foreach (glob(__DIR__ . '/php/*Test.php') as $file) {
    require $file;
}

$pass = 0;
$fail = 0;
$failures = [];

foreach ($GLOBALS['__tests'] as [$name, $fn]) {
    try {
        $fn();
        echo "  PASS  $name\n";
        $pass++;
    } catch (Throwable $e) {
        echo "  FAIL  $name\n        " . $e->getMessage() . "\n";
        $failures[] = $name;
        $fail++;
    }
}

echo "\n" . str_repeat('-', 50) . "\n";
echo "$pass passed, $fail failed\n";
exit($fail > 0 ? 1 : 0);
