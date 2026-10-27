@echo off
chcp 936 >nul
setlocal
title 创建桌面快捷方式
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0安装桌面快捷方式.ps1"
echo.
pause