# 在桌面创建「开机门 设置」快捷方式。
# 卸载：删除桌面上那个 .lnk 即可，不改动插件本身。
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $here '设置.cmd'
$icon = Join-Path $here 'assets\icon.ico'
$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $desktop '开机门 设置.lnk'

if (-not (Test-Path -LiteralPath $target)) { Write-Host "找不到 设置.cmd" -ForegroundColor Red; exit 1 }

$shell = New-Object -ComObject WScript.Shell
$sc = $shell.CreateShortcut($lnk)
$sc.TargetPath = $target
$sc.WorkingDirectory = $here
$sc.WindowStyle = 7
$sc.Description = 'DeepSeek Harness 开机门 · 设置'
if (Test-Path -LiteralPath $icon) { $sc.IconLocation = $icon }
$sc.Save()

if (Test-Path -LiteralPath $lnk) {
  Write-Host "已创建：$lnk" -ForegroundColor Green
  Write-Host '双击它就能打开设置页（需要 DSH 正在运行）。'
} else {
  Write-Host '创建失败' -ForegroundColor Red
  exit 1
}