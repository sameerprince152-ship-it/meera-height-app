@echo off
title Meera Heights App Launcher
cd /d "%~dp0"
echo Starting Meera Heights Building Management App...
python server.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Python was not found in PATH. Opening index.html directly in your default browser...
    start "" index.html
)
pause
