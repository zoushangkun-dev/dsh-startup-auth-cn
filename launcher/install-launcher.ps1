# Desktop launcher for DeepSeek Harness.
#
# Why this exists: the Electron main process needs several seconds before it has
# a window, and a second click during that gap only spawns a process that exits
# immediately. People read that as "the click did nothing" and keep clicking.
# The launcher shows a small window within ~100 ms and closes it once the real
# window appears.
#
# English only on purpose: this file is UTF-8, and PowerShell 5.1 renders literal
# non-ASCII on some code pages as mojibake.

param(
  [string]$Exe = 'D:\dsh\DeepSeek Harness.exe',
  [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$vbs = Join-Path $here 'dsh-launcher.vbs'
$lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) 'DeepSeek Harness (Launcher).lnk'

try {
  if ($Uninstall) {
    if (Test-Path -LiteralPath $lnk) { Remove-Item -LiteralPath $lnk -Force }
    Write-Host '[ok] desktop shortcut removed'
    exit 0
  }

  if (-not (Test-Path -LiteralPath $vbs)) {
    Write-Host ('[fail] launcher script missing: ' + $vbs)
    exit 1
  }

  $shell = New-Object -ComObject WScript.Shell
  $s = $shell.CreateShortcut($lnk)
  $s.TargetPath = (Join-Path $env:WINDIR 'System32\wscript.exe')
  $s.Arguments = '"' + $vbs + '"'
  $s.WorkingDirectory = $here
  if ($Exe -and (Test-Path -LiteralPath $Exe)) { $s.IconLocation = $Exe + ',0' }
  $s.Description = 'DeepSeek Harness - starts once, shows feedback immediately'
  $s.Save()

  Write-Host ('[ok] shortcut created: ' + $lnk)
} catch {
  Write-Host ('[fail] ' + $_.Exception.Message)
  exit 1
}
