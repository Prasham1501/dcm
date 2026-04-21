@echo off
REM =====================================================
REM Hospital DICOM Viewer Pro - Desktop Edition
REM Main Startup Script
REM =====================================================

setlocal enabledelayedexpansion

echo =====================================================
echo   Hospital DICOM Viewer Pro - Desktop Edition
echo   Starting services...
echo =====================================================
echo.

REM Set paths relative to this script
set "SCRIPT_DIR=%~dp0"
set "DATA_DIR=%SCRIPT_DIR%data"
set "CONFIG_DIR=%SCRIPT_DIR%config"
set "WWW_DIR=%SCRIPT_DIR%www"
set "LOGS_DIR=%DATA_DIR%\logs"
set "ORTHANC_DATA=%DATA_DIR%\orthanc"
set "MYSQL_DATA=%DATA_DIR%\mysql"

REM Create directories if they don't exist
if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"
if not exist "%LOGS_DIR%" mkdir "%LOGS_DIR%"
if not exist "%ORTHANC_DATA%" mkdir "%ORTHANC_DATA%"
if not exist "%MYSQL_DATA%" mkdir "%MYSQL_DATA%"

REM Log file for this session
set "LOG_FILE=%LOGS_DIR%\startup_%date:~-4,4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%.log"
echo [%date% %time%] Starting DICOM Viewer Desktop >> "%LOG_FILE%"

echo [1/5] Checking prerequisites...
echo.

REM =====================================================
REM Check for PHP
REM =====================================================
echo [DEBUG] Checking for PHP...
where php >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] PHP not found in PATH
    echo [ERROR] Please install PHP 8.0+ and add to PATH, or install XAMPP
    echo.
    echo Quick fix: If you have XAMPP installed, run:
    echo setx PATH "%%PATH%%;C:\xampp\php"
    echo.
    echo [%date% %time%] ERROR: PHP not found >> "%LOG_FILE%"
    goto :error_exit
)
for /f "tokens=2" %%i in ('php -v 2^>^&1 ^| findstr /i "PHP"') do (
    set "PHP_VERSION=%%i"
    goto :php_found
)
:php_found
echo [OK] PHP found: %PHP_VERSION%
echo [%date% %time%] PHP found: %PHP_VERSION% >> "%LOG_FILE%"

REM =====================================================
REM Check for MySQL
REM =====================================================
echo [DEBUG] Checking for MySQL...
set "MYSQL_BIN="
where mysql >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] MySQL CLI not found in PATH - will try XAMPP location
    if exist "C:\xampp\mysql\bin\mysql.exe" (
        set "MYSQL_BIN=C:\xampp\mysql\bin\"
        echo [OK] Found MySQL in XAMPP: C:\xampp\mysql\bin\
    ) else (
        echo [ERROR] MySQL not found. Please install XAMPP or MySQL Server
        echo [%date% %time%] ERROR: MySQL not found >> "%LOG_FILE%"
        goto :error_exit
    )
) else (
    for /f "tokens=*" %%i in ('where mysql') do (
        set "MYSQL_BIN=%%~dpi"
        echo [OK] MySQL found at: !MYSQL_BIN!
        goto :mysql_found
    )
)
:mysql_found
echo [%date% %time%] MySQL found >> "%LOG_FILE%"

REM =====================================================
REM Check for Orthanc
REM =====================================================
echo.
echo [2/5] Checking Orthanc PACS Server...
echo [DEBUG] Testing Orthanc connection at localhost:8042...

REM Try to connect to Orthanc
set "ORTHANC_RUNNING=0"
curl -s -o nul -w "%%{http_code}" http://localhost:8042/system > "%TEMP%\orthanc_check.txt" 2>nul
set /p ORTHANC_STATUS=<"%TEMP%\orthanc_check.txt"

if "%ORTHANC_STATUS%"=="200" (
    echo [OK] Orthanc is running on port 8042
    echo [%date% %time%] Orthanc already running >> "%LOG_FILE%"
    set "ORTHANC_RUNNING=1"
    goto :orthanc_done
)
if "%ORTHANC_STATUS%"=="401" (
    echo [OK] Orthanc is running on port 8042 (auth required)
    echo [%date% %time%] Orthanc already running with auth >> "%LOG_FILE%"
    set "ORTHANC_RUNNING=1"
    goto :orthanc_done
)

REM Orthanc not running - try to start it
echo [INFO] Orthanc not running. Attempting to start...

REM Check common Orthanc installation paths
set "ORTHANC_EXE="
if exist "C:\Program Files\Orthanc Server\Orthanc.exe" (
    set "ORTHANC_EXE=C:\Program Files\Orthanc Server\Orthanc.exe"
) else if exist "C:\Orthanc\Orthanc.exe" (
    set "ORTHANC_EXE=C:\Orthanc\Orthanc.exe"
) else if exist "%SCRIPT_DIR%runtime\orthanc\Orthanc.exe" (
    set "ORTHANC_EXE=%SCRIPT_DIR%runtime\orthanc\Orthanc.exe"
)

if defined ORTHANC_EXE (
    echo [INFO] Starting Orthanc from: !ORTHANC_EXE!
    start "" "!ORTHANC_EXE!" "%CONFIG_DIR%\orthanc.json"
    echo [INFO] Waiting for Orthanc to start...
    timeout /t 5 /nobreak >nul
    
    REM Verify Orthanc started
    curl -s -o nul -w "%%{http_code}" http://localhost:8042/system > "%TEMP%\orthanc_check.txt" 2>nul
    set /p ORTHANC_STATUS=<"%TEMP%\orthanc_check.txt"
    if "!ORTHANC_STATUS!"=="200" (
        echo [OK] Orthanc started successfully
        set "ORTHANC_RUNNING=1"
    ) else if "!ORTHANC_STATUS!"=="401" (
        echo [OK] Orthanc started successfully (auth required)
        set "ORTHANC_RUNNING=1"
    ) else (
        echo [WARN] Orthanc may not have started properly
    )
) else (
    echo [WARN] Orthanc executable not found
    echo [INFO] Please install Orthanc from: https://orthanc-server.com/download.php
    echo [INFO] Application will continue but DICOM storage will not work
    echo [%date% %time%] WARNING: Orthanc not found >> "%LOG_FILE%"
)

:orthanc_done

REM =====================================================
REM Initialize Database
REM =====================================================
echo.
echo [3/5] Initializing Database...
echo [DEBUG] Checking if database exists...

REM Check if database exists
"%MYSQL_BIN%mysql.exe" -u root -e "USE dicom_viewer_desktop;" 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Database not found. Creating new database...
    "%MYSQL_BIN%mysql.exe" -u root -e "CREATE DATABASE IF NOT EXISTS dicom_viewer_desktop CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create database. Is MySQL running?
        echo [INFO] Try starting XAMPP Control Panel and starting MySQL
        echo [%date% %time%] ERROR: Database creation failed >> "%LOG_FILE%"
        goto :error_exit
    )
    echo [INFO] Running database migrations...
    "%MYSQL_BIN%mysql.exe" -u root dicom_viewer_desktop < "%WWW_DIR%\database\migrations\004_desktop_schema.sql"
    if %errorlevel% neq 0 (
        echo [WARN] Some migrations may have failed. Check logs.
    ) else (
        echo [OK] Database initialized successfully
    )
    echo [%date% %time%] Database created and initialized >> "%LOG_FILE%"
) else (
    echo [OK] Database already exists
    echo [%date% %time%] Database already exists >> "%LOG_FILE%"
)

REM =====================================================
REM Start PHP Development Server
REM =====================================================
echo.
echo [4/5] Starting Web Server...
echo [DEBUG] Starting PHP built-in server on port 8080...

REM Kill any existing PHP server on port 8080
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    echo [INFO] Killing existing process on port 8080 (PID: %%a)
    taskkill /F /PID %%a >nul 2>&1
)

REM Start PHP server in background
start "DICOM Viewer Server" /min cmd /c "php -S localhost:8080 -t "%WWW_DIR%" >> "%LOGS_DIR%\php_server.log" 2>&1"

echo [INFO] Waiting for server to start...
timeout /t 3 /nobreak >nul

REM Verify server started
curl -s -o nul -w "%%{http_code}" http://localhost:8080/api/health.php > "%TEMP%\server_check.txt" 2>nul
set /p SERVER_STATUS=<"%TEMP%\server_check.txt"
if "%SERVER_STATUS%"=="200" (
    echo [OK] Web server started successfully
) else (
    echo [INFO] Web server starting... (may take a moment)
)
echo [%date% %time%] PHP server started >> "%LOG_FILE%"

REM =====================================================
REM Open Browser
REM =====================================================
echo.
echo [5/5] Opening Application...
timeout /t 2 /nobreak >nul
start http://localhost:8080

echo.
echo =====================================================
echo   DICOM Viewer Desktop is now running!
echo =====================================================
echo.
echo   Web Interface:  http://localhost:8080
echo   Orthanc PACS:   http://localhost:8042
echo.
echo   Default Login:
echo     Username: admin
echo     Password: admin123
echo.
echo   Press any key to stop the server...
echo =====================================================
echo [%date% %time%] Application started successfully >> "%LOG_FILE%"

pause >nul

REM =====================================================
REM Cleanup
REM =====================================================
echo.
echo [INFO] Shutting down...

REM Kill PHP server
taskkill /FI "WINDOWTITLE eq DICOM Viewer Server*" /F >nul 2>&1
echo [OK] Web server stopped

echo [%date% %time%] Application stopped >> "%LOG_FILE%"
echo [INFO] Goodbye!
timeout /t 2 >nul

endlocal
exit /b 0

REM =====================================================
REM Error Exit - keeps window open
REM =====================================================
:error_exit
echo.
echo =====================================================
echo   ERROR: Startup failed. See messages above.
echo =====================================================
echo.
echo Press any key to exit...
pause >nul
endlocal
exit /b 1
