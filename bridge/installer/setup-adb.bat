@echo off
REM Set up ADB reverse port forwarding (Windows)
REM Run on PC after connecting phone via USB.

set PORT=18800

echo [bridge] Setting up ADB reverse port forwarding...

where adb >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [!] ADB not found. Install Android Platform Tools.
    echo     https://developer.android.com/tools/releases/platform-tools
    pause
    exit /b 1
)

adb devices | findstr "device" >nul
if %ERRORLEVEL% neq 0 (
    echo [!] No Android device connected.
    echo     1. Enable USB Debugging on the phone
    echo     2. Connect via USB cable
    echo     3. Accept the debugging prompt on the phone
    pause
    exit /b 1
)

adb reverse tcp:%PORT% tcp:%PORT%
echo [ok] Port %PORT% forwarded. Phone can reach bridge at 127.0.0.1:%PORT%
echo.
echo On the phone (Termux), run:
echo   cd ~/bridge/client ^&^& node src/pair.js

pause
