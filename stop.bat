@echo off
title Stop AV System Builder
cd /d "%~dp0"

echo ==========================================
echo    Stopping AV System Builder Server
echo ==========================================
echo.

:: Find the PID listening on port 5173 and kill it
set "PID="
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    set "PID=%%a"
)

if defined PID (
    echo Found server running on PID %PID%.
    echo Terminating process...
    taskkill /f /pid %PID% >nul 2>&1
    echo Server stopped successfully!
) else (
    echo No active server found running on port 5173.
)

echo.
timeout /t 3 >nul
exit
