@echo off
chcp 65001 >nul
title ARAM Squad Stats - 전적 동기화

echo.
echo  ╔══════════════════════════════════╗
echo  ║   ARAM Squad Stats 전적 동기화  ║
echo  ╚══════════════════════════════════╝
echo.

:: 스크립트 위치로 이동
cd /d "%~dp0"

:: Python 확인
python --version >nul 2>&1
if errorlevel 1 (
    echo  [오류] Python이 설치되어 있지 않습니다.
    echo  https://python.org 에서 설치해주세요.
    pause
    exit /b 1
)

:: 실행
python lcu_agent.py

echo.
echo  완료! 이 창은 5초 후 자동으로 닫힙니다.
timeout /t 5 >nul
