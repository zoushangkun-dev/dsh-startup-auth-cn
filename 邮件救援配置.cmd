@echo off
chcp 936 >nul
setlocal
title ” º˛æ»‘Æ≈‰÷√
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

echo ============================================
echo   DeepSeek Harness °§ ” º˛æ»‘Æ≈‰÷√
echo ============================================
echo.
"%PS%" -NoProfile -ExecutionPolicy Bypass -File "%~dp0” º˛æ»‘Æ≈‰÷√.ps1"
if errorlevel 1 pause
