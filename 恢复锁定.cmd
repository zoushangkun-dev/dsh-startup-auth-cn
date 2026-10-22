@echo off
chcp 936 >nul
setlocal
title dsh-boot-handmade 恢复应用锁

set "FLAG=%USERPROFILE%\.dsh\boot-auth-bypass"

echo ============================================
echo  恢复应用锁（撤掉急救绕过）
echo ============================================
echo.

if exist "%FLAG%" (
  del /f /q "%FLAG%"
  if errorlevel 1 (
    echo [失败] 删不掉 %FLAG%，手动删一下。
    pause
    exit /b 1
  )
  echo [完成] 标记已删除，下次启动恢复验证。
) else (
  echo [提示] 本来就不存在这个标记，已经处于验证状态。
)

echo.
echo 想连 PIN 一起清掉（回到首次设置）：
echo   删除 %USERPROFILE%\.dsh\boot-auth.json
pause
