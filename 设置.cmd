@echo off
chcp 936 >nul
setlocal
title dsh-boot-handmade 设置

rem 默认端口和 DSH 自身一致；如果改过端口，把端口当参数传进来：设置.cmd 19388
set "PORT=%~1"
if "%PORT%"=="" set "PORT=19387"

set "URL=http://127.0.0.1:%PORT%/boot-auth/ui"

echo ============================================
echo  开机门 · 设置
echo ============================================
echo.
echo  地址：%URL%
echo.
echo  需要 DSH 正在运行，设置页由插件自己提供。
echo.

start "" "%URL%"
timeout /t 3 >nul
exit /b 0
