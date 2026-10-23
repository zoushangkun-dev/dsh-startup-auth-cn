@echo off
chcp 936 >nul
title DSH 启动器卸载
echo.
echo  正在移除桌面启动器...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\install-launcher.ps1" -Uninstall
echo.
pause
