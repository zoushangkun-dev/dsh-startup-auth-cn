@echo off
chcp 936 >nul
setlocal
title dsh-boot-handmade 设置

rem 快路径：记住的端口还活着就直接开，不启动 PowerShell（省 2 秒）。
rem 慢路径：端口变了，交给 设置.ps1 去问应用。
rem 调试：设 BH_NOOPEN=1 只打印地址、不开浏览器。
set "CACHE=%LOCALAPPDATA%\dsh-boot-handmade\last-port.txt"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if not "%~1"=="" goto slow

if exist "%CACHE%" (
  set "PORT="
  set /p PORT=<"%CACHE%"
)
if not defined PORT goto slow

curl.exe -s -o nul --max-time 2 "http://127.0.0.1:%PORT%/boot-auth/status"
if errorlevel 1 goto slow

set "URL=http://127.0.0.1:%PORT%/boot-auth/ui"
echo 设置页: %URL%
if defined BH_NOOPEN exit /b 0
if exist "%CHROME%" (
  start "" "%CHROME%" --new-window "%URL%"
) else (
  start "" "%URL%"
)
exit /b 0

:slow
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0设置.ps1" %*
if errorlevel 1 timeout /t 8 >nul
exit /b 0