@echo off
REM Hospital DICOM Viewer Pro v2.0 - Quick Installation Script
REM Run this as Administrator

echo ============================================
echo Hospital DICOM Viewer Pro v2.0
echo Quick Installation Script
echo ============================================
echo.

echo IMPORTANT: Make sure Apache is restarted in XAMPP
echo (Required after enabling PHP extensions)
echo.
pause

REM Change to script directory
cd /d "%~dp0"

echo [1/3] Checking Composer...
where composer >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Composer is not installed!
    echo.
    echo Please install Composer first:
    echo 1. Download: https://getcomposer.org/Composer-Setup.exe
    echo 2. Run installer
    echo 3. Restart Command Prompt
    echo 4. Run this script again
    echo.
    pause
    exit /b 1
)
echo    Composer found: OK

echo.
echo [2/3] Installing PHP dependencies...
echo    This may take 2-3 minutes...
composer install --no-dev --optimize-autoloader

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Composer install failed!
    echo Please check the error messages above.
    pause
    exit /b 1
)

echo.
echo [3/3] Verifying installation...

REM Check if autoload.php exists
if exist "vendor\autoload.php" (
    echo    vendor\autoload.php: OK
) else (
    echo    ERROR: vendor\autoload.php not found!
    pause
    exit /b 1
)

REM Check if Google API library installed
if exist "vendor\google" (
    echo    Google API library: OK
) else (
    echo    ERROR: Google API library not installed!
    pause
    exit /b 1
)

REM Check if DotEnv library installed
if exist "vendor\vlucas" (
    echo    DotEnv library: OK
) else (
    echo    ERROR: DotEnv library not installed!
    pause
    exit /b 1
)

echo.
echo ============================================
echo Installation Complete!
echo ============================================
echo.
echo NEXT STEPS:
echo.
echo 1. Create database in phpMyAdmin:
echo    - Open: http://localhost/phpmyadmin
echo    - Create database: dicom_viewer_v2_production
echo    - Import: setup\schema_v2_production.sql
echo.
echo 2. Access the application:
echo    - URL: http://localhost/papa/dicom_again/claude/login.php
echo    - Username: admin
echo    - Password: Admin@123
echo.
echo 3. Read documentation:
echo    - QUICK_START_GUIDE.md
echo    - CONFIGURATION_CHECKLIST.md
echo.
echo ============================================
echo.
pause
