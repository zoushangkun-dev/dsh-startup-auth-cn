# 打开开机门的设置页。
#
# 为什么不再写死端口：DSH 每次启动的 Web 端口是变的（0.2.2 这次就从 19387 变成 37565），
# 写死的话更新一次快捷方式就废了。所以这里自己去问运行中的应用。
param(
  [int]$Port = 0,
  [switch]$Probe   # 只打印找到的端口，不打开浏览器
)

$ErrorActionPreference = 'Stop'

function Test-Endpoint([int]$p) {
  try {
    $r = Invoke-WebRequest -Uri ("http://127.0.0.1:{0}/boot-auth/status" -f $p) -UseBasicParsing -TimeoutSec 3
    return ($r.StatusCode -eq 200)
  } catch { return $false }
}

$candidates = @()
if ($Port -gt 0) {
  $candidates = @($Port)
} else {
  # 1) 找 DeepSeek Harness 进程监听的端口
  try {
    $ids = @(Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
    if ($ids.Count -gt 0) {
      $candidates += Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $ids -contains $_.OwningProcess } |
        Select-Object -ExpandProperty LocalPort
    }
  } catch { }
  # 2) 兜底：常见端口
  $candidates += @(19387, 37565, 3000, 8080)
  $candidates = $candidates | Select-Object -Unique
}

$found = $null
foreach ($c in $candidates) {
  if (Test-Endpoint $c) { $found = $c; break }
}

if (-not $found) {
  Write-Host '找不到开机门的设置页。' -ForegroundColor Red
  Write-Host '请确认 DeepSeek Harness 正在运行。' -ForegroundColor Yellow
  Write-Host ''
  Write-Host ('试过的端口：' + ($candidates -join ', '))
  exit 1
}

$url = "http://127.0.0.1:$found/boot-auth/ui"
if ($Probe) {
  Write-Host ("找到端口: " + $found)
  Write-Host ("地址: " + $url)
  exit 0
}

Write-Host ("设置页: " + $url)
Start-Process $url
exit 0