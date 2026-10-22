@echo off
chcp 65001 >nul
setlocal
title dsh-boot-handmade 急救：绕过应用锁

set "FLAG=%USERPROFILE%\.dsh\boot-auth-bypass"

echo ============================================
echo  急救：暂时绕过应用锁
echo ============================================
echo.
echo 作用：创建一个标记文件，开机动画的验证环节直接放行。
echo 文件：%FLAG%
echo 不会删除你设置的 PIN，随时可以点「恢复锁定」撤掉。
echo.

if not exist "%USERPROFILE%\.dsh" mkdir "%USERPROFILE%\.dsh"
echo bypass > "%FLAG%"
if errorlevel 1 (
  echo [失败] 写不了标记文件，把上面这行路径发给我。
  pause
  exit /b 1
)

echo [完成] 已放行。重开 DeepSeek Harness 即可直接进入。
echo 修好之后，双击「恢复锁定.cmd」恢复验证。
pause
