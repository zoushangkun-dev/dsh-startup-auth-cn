@echo off
chcp 65001 >nul
setlocal
title dsh-boot-handmade 卸载

set "CLI=D:\dsh\resources\runtime\cli\bin\dsh.cmd"

echo ============================================
echo  dsh-boot-handmade 卸载（急救用）
echo ============================================
echo.

tasklist /FI "IMAGENAME eq DeepSeek Harness.exe" 2>nul | find /I "DeepSeek Harness.exe" >nul
if not errorlevel 1 (
  echo [失败] DeepSeek Harness 还在运行，先完全退出（任务管理器结束所有同名进程）。
  pause
  exit /b 1
)

call "%CLI%" plugin --profile desktop remove dsh-boot-handmade
echo.
echo 已移除。重开客户端确认界面恢复正常。
pause
