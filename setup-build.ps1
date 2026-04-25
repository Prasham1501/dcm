# MediView Pro - Build Setup Script
# Run this on a fresh clone to download dependencies and build the installer
# Usage: powershell -ExecutionPolicy Bypass -File setup-build.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MediView Pro - Build Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$root = $PSScriptRoot
Set-Location $root

# 1. Install Node.js dependencies
Write-Host "`n[1/6] Installing root dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

# 2. Install frontend dependencies
Write-Host "`n[2/6] Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location "$root\www"
npm install
if ($LASTEXITCODE -ne 0) { throw "www npm install failed" }
Set-Location $root

# 3. Download MariaDB portable
if (-not (Test-Path "mysql\bin\mysqld.exe")) {
    Write-Host "`n[3/6] Downloading MariaDB 10.11.11 (~86MB)..." -ForegroundColor Yellow
    $mariaUrl = "https://archive.mariadb.org/mariadb-10.11.11/winx64-packages/mariadb-10.11.11-winx64.zip"
    Invoke-WebRequest -Uri $mariaUrl -OutFile "mariadb.zip" -UseBasicParsing
    Write-Host "  Extracting..." -ForegroundColor Gray
    Expand-Archive -Path "mariadb.zip" -DestinationPath "." -Force
    if (Test-Path "mariadb-10.11.11-winx64") {
        Rename-Item "mariadb-10.11.11-winx64" "mysql" -Force
    }
    Remove-Item "mariadb.zip" -Force
    Write-Host "  MariaDB ready." -ForegroundColor Green
} else {
    Write-Host "`n[3/6] MariaDB already present." -ForegroundColor Green
}

# 4. Download Orthanc + plugins
if (-not (Test-Path "orthanc\Orthanc.exe")) {
    Write-Host "`n[4/6] Downloading Orthanc 1.12.11 + plugins..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "orthanc" -Force | Out-Null
    
    Write-Host "  Orthanc.exe (~26MB)..." -ForegroundColor Gray
    Invoke-WebRequest -Uri "https://orthanc.uclouvain.be/downloads/windows-64/orthanc/1.12.11/Orthanc.exe" -OutFile "orthanc\Orthanc.exe" -UseBasicParsing
    
    Write-Host "  DICOMweb plugin (~5MB)..." -ForegroundColor Gray
    Invoke-WebRequest -Uri "https://orthanc.uclouvain.be/downloads/windows-64/orthanc-dicomweb/OrthancDicomWeb-1.23.dll" -OutFile "orthanc\OrthancDicomWeb-1.23.dll" -UseBasicParsing
    
    Write-Host "  ServeFolders plugin..." -ForegroundColor Gray
    Invoke-WebRequest -Uri "https://orthanc.uclouvain.be/downloads/windows-64/orthanc/1.12.11/ServeFolders.dll" -OutFile "orthanc\ServeFolders.dll" -UseBasicParsing
    
    Write-Host "  Orthanc ready." -ForegroundColor Green
} else {
    Write-Host "`n[4/6] Orthanc already present." -ForegroundColor Green
}

# 5. Build React frontend
Write-Host "`n[5/6] Building React frontend..." -ForegroundColor Yellow
Set-Location "$root\www"
npm run build
if ($LASTEXITCODE -ne 0) { throw "React build failed" }
Set-Location $root

# 6. Build installer
Write-Host "`n[6/6] Building Windows installer..." -ForegroundColor Yellow
npx electron-builder --win
if ($LASTEXITCODE -ne 0) { throw "Electron builder failed" }

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  BUILD COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
$installer = Get-ChildItem "installer-output\*.exe" | Select-Object -First 1
Write-Host "Installer: $($installer.FullName)" -ForegroundColor Cyan
Write-Host "Size: $([math]::Round($installer.Length / 1MB, 1)) MB" -ForegroundColor Cyan
Write-Host "`nCopy this EXE to any Windows PC to install MediView Pro."
