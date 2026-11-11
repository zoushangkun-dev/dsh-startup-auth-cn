@echo off
chcp 936 >nul
setlocal
title dsh-boot-handmade 设置
rem 端口不写死：设置.ps1 会自己找运行中的应用。
rem 想指定端口就带参数：设置.cmd 37565
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0设置.ps1" %*
if errorlevel 1 pause
exit /b 0