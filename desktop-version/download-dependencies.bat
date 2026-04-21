@echo off
REM =====================================================
REM Download CDN Dependencies for Offline Use
REM =====================================================

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "VENDOR_DIR=%SCRIPT_DIR%www\assets\vendor"

echo =====================================================
echo   Downloading CDN Dependencies for Offline Use
echo =====================================================
echo.

REM Create vendor directories
if not exist "%VENDOR_DIR%" mkdir "%VENDOR_DIR%"
if not exist "%VENDOR_DIR%\bootstrap\css" mkdir "%VENDOR_DIR%\bootstrap\css"
if not exist "%VENDOR_DIR%\bootstrap\js" mkdir "%VENDOR_DIR%\bootstrap\js"
if not exist "%VENDOR_DIR%\bootstrap-icons" mkdir "%VENDOR_DIR%\bootstrap-icons"
if not exist "%VENDOR_DIR%\cornerstone" mkdir "%VENDOR_DIR%\cornerstone"
if not exist "%VENDOR_DIR%\dicom" mkdir "%VENDOR_DIR%\dicom"
if not exist "%VENDOR_DIR%\pdf" mkdir "%VENDOR_DIR%\pdf"

echo [1/10] Downloading Bootstrap CSS...
curl -sL "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" -o "%VENDOR_DIR%\bootstrap\css\bootstrap.min.css"
if %errorlevel% equ 0 (echo [OK] Bootstrap CSS) else (echo [FAIL] Bootstrap CSS)

echo [2/10] Downloading Bootstrap JS...
curl -sL "https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" -o "%VENDOR_DIR%\bootstrap\js\bootstrap.bundle.min.js"
if %errorlevel% equ 0 (echo [OK] Bootstrap JS) else (echo [FAIL] Bootstrap JS)

echo [3/10] Downloading Bootstrap Icons CSS...
curl -sL "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" -o "%VENDOR_DIR%\bootstrap-icons\bootstrap-icons.min.css"
if %errorlevel% equ 0 (echo [OK] Bootstrap Icons CSS) else (echo [FAIL] Bootstrap Icons CSS)

echo [4/10] Downloading Cornerstone Core...
curl -sL "https://cdn.jsdelivr.net/npm/cornerstone-core@2.6.1/dist/cornerstone.min.js" -o "%VENDOR_DIR%\cornerstone\cornerstone.min.js"
if %errorlevel% equ 0 (echo [OK] Cornerstone Core) else (echo [FAIL] Cornerstone Core)

echo [5/10] Downloading Cornerstone Math...
curl -sL "https://cdn.jsdelivr.net/npm/cornerstone-math@0.1.10/dist/cornerstoneMath.min.js" -o "%VENDOR_DIR%\cornerstone\cornerstoneMath.min.js"
if %errorlevel% equ 0 (echo [OK] Cornerstone Math) else (echo [FAIL] Cornerstone Math)

echo [6/10] Downloading Cornerstone Tools...
curl -sL "https://cdn.jsdelivr.net/npm/cornerstone-tools@5.1.5/dist/cornerstoneTools.min.js" -o "%VENDOR_DIR%\cornerstone\cornerstoneTools.min.js"
if %errorlevel% equ 0 (echo [OK] Cornerstone Tools) else (echo [FAIL] Cornerstone Tools)

echo [7/10] Downloading Cornerstone WADO Image Loader...
curl -sL "https://cdn.jsdelivr.net/npm/cornerstone-wado-image-loader@3.1.2/dist/cornerstoneWADOImageLoader.min.js" -o "%VENDOR_DIR%\cornerstone\cornerstoneWADOImageLoader.min.js"
if %errorlevel% equ 0 (echo [OK] WADO Image Loader) else (echo [FAIL] WADO Image Loader)

echo [8/10] Downloading DICOM Parser...
curl -sL "https://cdn.jsdelivr.net/npm/dicom-parser@1.8.21/dist/dicomParser.min.js" -o "%VENDOR_DIR%\dicom\dicomParser.min.js"
if %errorlevel% equ 0 (echo [OK] DICOM Parser) else (echo [FAIL] DICOM Parser)

echo [9/10] Downloading Hammer.js...
curl -sL "https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js" -o "%VENDOR_DIR%\cornerstone\hammer.min.js"
if %errorlevel% equ 0 (echo [OK] Hammer.js) else (echo [FAIL] Hammer.js)

echo [10/10] Downloading PDF Libraries...
curl -sL "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js" -o "%VENDOR_DIR%\pdf\html2canvas.min.js"
if %errorlevel% equ 0 (echo [OK] html2canvas) else (echo [FAIL] html2canvas)

curl -sL "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js" -o "%VENDOR_DIR%\pdf\jspdf.umd.min.js"
if %errorlevel% equ 0 (echo [OK] jsPDF) else (echo [FAIL] jsPDF)

echo.
echo =====================================================
echo   Download Complete!
echo =====================================================
echo.
echo Files saved to: %VENDOR_DIR%
echo.
echo Next step: Run start.bat to launch the application
echo.

pause
