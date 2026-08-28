@echo off
cd /d "%~dp0"
python --version >nul 2>&1
if errorlevel 1 (
    echo Python not found. Install from https://python.org
    pause
    exit /b 1
)
python lcu_agent.py
echo.
echo Done! Closing in 5 seconds...
timeout /t 5 >nul
