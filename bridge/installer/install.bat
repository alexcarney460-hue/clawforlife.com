@echo off
REM ClawForLife Bridge Installer (Windows)
REM
REM Checks Node.js, installs deps, configures auto-start, launches bridge.

echo ===================================
echo   ClawForLife Bridge Installer
echo ===================================
echo.

REM Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [!] Node.js not found.
    echo     Please install Node.js 18+ from https://nodejs.org
    echo     Then run this installer again.
    pause
    exit /b 1
)

for /f "tokens=1 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a
echo [ok] Node.js found

REM Install dependencies
echo [..] Installing dependencies...
cd /d "%~dp0..\server"
call npm install --production --no-audit --no-fund
echo [ok] Dependencies installed

REM Install auto-start
echo [..] Setting up auto-start...
node src\service-install.js

REM Start bridge
echo.
echo [..] Starting bridge server...
start /B node src\index.js

echo.
echo ===================================
echo   Bridge is ready!
echo   Open: http://127.0.0.1:18800
echo ===================================
echo.
echo On the phone, run:
echo   adb reverse tcp:18800 tcp:18800
echo   cd bridge/client ^&^& node src/pair.js

pause
