@echo off
chcp 936 >nul
setlocal
title dsh-boot-handmade 回滚
cd /d "%~dp0"

REM 这台机器上没有系统级 git，只有 dsh-ops 自带的一份，所以先找再决定。
set "GITCMD="
where git >nul 2>&1 && set "GITCMD=git"
if not defined GITCMD if exist "%USERPROFILE%\.dsh\profiles\desktop\node_modules\@dsh-ops\bash-win32-x64\ucrt64\bin\git.exe" set "GITCMD=%USERPROFILE%\.dsh\profiles\desktop\node_modules\@dsh-ops\bash-win32-x64\ucrt64\bin\git.exe"

echo ============================================
echo  dsh-boot-handmade 回滚
echo ============================================
echo.

if not defined GITCMD (
  echo [失败] 没找到 git。回滚需要它读取本目录的 .git 历史。
  echo   可以装 Git for Windows 后重试，或者：
  echo   1. 用交接包里的 dsh-boot-handmade.bundle 克隆一份干净的；
  echo   2. 手动把本目录换掉，再刷新客户端。
  echo   详细步骤见 HANDOFF.md 第十节。
  echo.
  pause
  exit /b 1
)

echo 当前提交：
%GITCMD% log --oneline -5
echo.
echo 可选目标：
echo   1 = 856b7ea  最初版（六幕动画 + PIN/Hello；没有 BOM 修复、没有失败提示改进）
echo   2 = 366ebc5  BOM 修复版（弹窗中文不再乱码）
echo   3 = 保持现状（不动）
echo.
set "CHOICE="
set /p "CHOICE=输入 1 / 2 / 3 后回车: "

if "%CHOICE%"=="1" goto roll_one
if "%CHOICE%"=="2" goto roll_two
echo.
echo 未做任何改动。
goto done

:roll_one
echo.
echo 正在回滚到 856b7ea ...
%GITCMD% reset --hard 856b7ea
if errorlevel 1 goto fail
goto done

:roll_two
echo.
echo 正在回滚到 366ebc5 ...
%GITCMD% reset --hard 366ebc5
if errorlevel 1 goto fail
goto done

:fail
echo.
echo [失败] 回滚命令报错了，把上面的输出发我。
pause
exit /b 1

:done
echo.
echo 回滚已生效：刷新 DeepSeek Harness 页面，或重开客户端。
echo 想彻底移除插件：双击同目录的「卸载.cmd」。
echo 想再往前回来：本脚本重跑，选 3 是保持，或者用 %GITCMD% log 看还有哪些提交。
pause
