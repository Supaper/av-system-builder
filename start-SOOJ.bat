@echo off
title AV System Builder Launcher
cd /d "%~dp0"

echo Starting AV System Builder in the background...
wscript.exe start_hidden.vbs
exit
