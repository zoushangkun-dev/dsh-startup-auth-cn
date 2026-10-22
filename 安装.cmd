@echo off
chcp 936 >nul
setlocal enabledelayedexpansion
title dsh-boot-handmade 安装

set "CLI=D:\dsh\resources\runtime\cli\bin\dsh.cmd"
set "PLUGIN=%~dp0"
if "%PLUGIN:~-1%"=="\" set "PLUGIN=%PLUGIN:~0,-1%"

echo ============================================
echo  dsh-boot-handmade 安装
echo  插件目录: %PLUGIN%
echo ============================================
echo.

tasklist /FI "IMAGENAME eq DeepSeek Harness.exe" 2>nul | find /I "DeepSeek Harness.exe" >nul
if not errorlevel 1 (
  echo [失败] DeepSeek Harness 还在运行。
  echo 请先完全退出：关闭窗口，并到任务管理器里结束所有 "DeepSeek Harness" 进程。
  echo 然后重新双击本脚本。
  echo.
  pause
  exit /b 1
)

if not exist "%CLI%" (
  echo [失败] 找不到 DSH 命令行: %CLI%
  echo 请把这个路径改成你机器上的实际位置，再双击运行。
  echo.
  pause
  exit /b 1
)

echo 正在安装（会顺带把旧的同名行清掉）...
call "%CLI%" plugin --profile desktop add "link:%PLUGIN%"
if errorlevel 1 (
  echo.
  echo [失败] 安装命令返回了错误，把上面的报错发给我。
  pause
  exit /b 1
)

echo.
echo [完成] 现在重新打开 DeepSeek Harness，冷启动时就会播动画。
echo 不想每次看：控制台执行 sessionStorage.setItem 无效也没关系 —— 刷新页面即可重看。
echo 出问题：双击同目录的「卸载.cmd」，再重开客户端。
echo.
pause
