# Runs the full RIS test suite: rebuild test DB -> PHP tests -> frontend (Vitest).
# Exits non-zero if anything fails, so it can gate a phase's acceptance.
# Prereq: XAMPP MySQL running.
param(
    [string]$Php = "C:\xampp\php\php.exe"
)
$fail = 0
$here = $PSScriptRoot
$www  = Join-Path $here ".."

Write-Host "=== [1/3] Building throwaway test database ===" -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File (Join-Path $here "setup-testdb.ps1")

Write-Host "`n=== [2/4] PHP tests (backend) ===" -ForegroundColor Cyan
& $Php (Join-Path $here "run.php")
if ($LASTEXITCODE -ne 0) { $fail = 1 }

Write-Host "`n=== [3/4] Concurrency: parallel accession uniqueness ===" -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File (Join-Path $here "concurrency-accession.ps1") -N 20
if ($LASTEXITCODE -ne 0) { $fail = 1 }

Write-Host "`n=== [4/4] Frontend tests (Vitest) ===" -ForegroundColor Cyan
npm --prefix $www test
if ($LASTEXITCODE -ne 0) { $fail = 1 }

Write-Host ""
if ($fail -ne 0) {
    Write-Host "SOME TESTS FAILED" -ForegroundColor Red
    exit 1
}
Write-Host "ALL TESTS PASSED" -ForegroundColor Green
