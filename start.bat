@echo off
title AV System Builder Launcher
cd /d "%~dp0"

echo ==========================================
echo    AV System Builder Launcher
echo ==========================================
echo.
echo 1. Starting development server...
start "AV System Builder Server" cmd /k "npm run dev"

echo 2. Waiting for server to start (3 seconds)...
timeout /t 3 >nul

echo 3. Opening browser...
start http://localhost:5173

echo.
echo Done! You can close this window now. The server will keep running.
timeout /t 3 >nul
exit
