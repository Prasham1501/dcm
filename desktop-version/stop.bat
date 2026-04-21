@echo off
REM =====================================================
REM Hospital DICOM Viewer Pro - Desktop Edition
REM Shutdown Script
REM =====================================================

echo =====================================================
echo   Stopping DICOM Viewer Desktop...
echo =====================================================
echo.

REM Kill PHP server
echo [INFO] Stopping web server...
taskkill /FI "WINDOWTITLE eq DICOM Viewer Server*" /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo [OK] Web server stopped

echo.
echo [INFO] Note: Orthanc and MySQL are NOT stopped (they may be used by other applications)
echo [INFO] To stop them, use XAMPP Control Panel or Services
echo.
echo =====================================================
echo   DICOM Viewer Desktop stopped successfully
echo =====================================================

pause
