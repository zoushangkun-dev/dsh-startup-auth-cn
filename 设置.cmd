@echo off
chcp 936 >nul
setlocal
title dsh-boot-made 设置

rem 端口由插件在每次启动/打开时写进这个文件，这里只读它。
rem 不启动 PowerShell —— 那会触发一次安全提示，对普通用户就像病毒。
set "PORTFILE=%USERPROFILE%\.dsh\boot-gate-port.txt"
set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if not exist "%PORTFILE%" goto noport
set "PORT="
set /p PORT=<"%PORTFILE%"
if not defined PORT goto noport

set "URL=http://127.0.0.1:%PORT%/boot-auth/ui"
echo 设置页: %URL%
if defined BH_NOOPEN exit /b 0
if exist "%CHROME%" (
  start "" "%CHROME%" --new-window "%URL%"
) else (
  start "" "%URL%"
)
exit /b 0

:noport
echo.
echo   还没有找到正在运行的开机门。
echo   请先启动 DeepSeek Harness，再点这个快捷方式。
echo.
timeout /t 6 >nul
exit /b 1