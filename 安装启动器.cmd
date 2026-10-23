@echo off
chcp 936 >nul
title DSH 启动器安装
echo.
echo  正在创建桌面启动器...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\install-launcher.ps1"
echo.
echo  装好后，桌面会出现「DeepSeek Harness (Launcher)」。
echo  以后双击它启动，点一下就有反馈，不会再重复启动。
echo.
pause
