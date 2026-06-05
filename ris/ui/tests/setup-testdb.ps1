# Builds the throwaway test database `dicom_viewer_pro_test` from the LIVE schema
# (structure only, no data), then applies the new RIS migrations (016+).
# Tests run against this DB so they never touch real patient data.
param(
    [string]$Mysql    = "C:\xampp\mysql\bin\mysql.exe",
    [string]$Mysqldump= "C:\xampp\mysql\bin\mysqldump.exe",
    [string]$Source   = "dicom_viewer_pro",
    [string]$Test     = "dicom_viewer_pro_test"
)
$ErrorActionPreference = "Stop"

Write-Host "[setup-testdb] Recreating $Test ..."
& $Mysql -u root -e "DROP DATABASE IF EXISTS $Test; CREATE DATABASE $Test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

Write-Host "[setup-testdb] Cloning schema from $Source (no data) ..."
$schema = & $Mysqldump -u root --no-data --routines --events --skip-comments $Source
$schema | & $Mysql -u root $Test

# Apply RIS migrations (016 and onward) on top of the cloned baseline.
$migDir = Join-Path $PSScriptRoot "..\database\migrations"
$migrations = Get-ChildItem $migDir -Filter "*.sql" -ErrorAction SilentlyContinue |
              Where-Object { $_.Name -match '^0(1[6-9]|[2-9][0-9])_' } |
              Sort-Object Name
foreach ($m in $migrations) {
    $p = ($m.FullName -replace '\\','/')
    Write-Host "[setup-testdb] Applying $($m.Name) ..."
    & $Mysql -u root $Test -e "source $p"
}

Write-Host "[setup-testdb] Done."
