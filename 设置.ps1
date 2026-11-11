# 打开开机门的设置页。
#
# 为什么不再写死端口：DSH 每次启动的 Web 端口都是变的（0.2.2 这次从 19387 变成 37565），
# 写死的话更新一次快捷方式就废了。所以这里去问运行中的应用，并记住上次的端口。
#
# 为什么默认用 Chrome：系统的默认浏览器是夸克，渲染这个页面很慢。
# Chrome 打开是秒开的。想用系统默认浏览器就加 -Default。
param(
  [int]$Port = 0,
  [switch]$Probe,
  [switch]$Default
)

$ErrorActionPreference = 'Stop'
$cacheDir = Join-Path $env:LOCALAPPDATA 'dsh-boot-handmade'
$cacheFile = Join-Path $cacheDir 'last-port.txt'

function Test-Endpoint([int]$p) {
  try {
    $r = Invoke-WebRequest -Uri ("http://127.0.0.1:{0}/boot-auth/status" -f $p) -UseBasicParsing -TimeoutSec 2
    return ($r.StatusCode -eq 200)
  } catch { return $false }
}

$found = $null

if ($Port -gt 0) {
  if (Test-Endpoint $Port) { $found = $Port }
} else {
  # 1) 先试上次成功的端口：命中就等于秒开
  if (Test-Path -LiteralPath $cacheFile) {
    $last = 0
    try { $last = [int](Get-Content -LiteralPath $cacheFile -Raw).Trim() } catch { $last = 0 }
    if ($last -gt 0 -and (Test-Endpoint $last)) { $found = $last }
  }

  # 2) 没命中就问进程：只探它真的在监听的端口，不猜
  if (-not $found) {
    try {
      $ids = @(Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
      if ($ids.Count -gt 0) {
        $ports = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
          Where-Object { $ids -contains $_.OwningProcess } |
          Select-Object -ExpandProperty LocalPort
        foreach ($c in ($ports | Select-Object -Unique)) {
          if (Test-Endpoint $c) { $found = $c; break }
        }
      }
    } catch { }
  }

  # 3) 最后的兜底：只试最常见的两个，别把一堆关闭端口逐个等满超时
  if (-not $found) {
    foreach ($c in @(19387, 37565)) {
      if (Test-Endpoint $c) { $found = $c; break }
    }
  }
}

if (-not $found) {
  Write-Host '找不到开机门的设置页。' -ForegroundColor Red
  Write-Host '请确认 DeepSeek Harness 正在运行。' -ForegroundColor Yellow
  exit 1
}

# 记住这个端口，下次直接命中
try {
  New-Item -ItemType Directory -Path $cacheDir -Force | Out-Null
  Set-Content -LiteralPath $cacheFile -Value $found -Encoding ASCII
} catch { }

$url = "http://127.0.0.1:$found/boot-auth/ui"

if ($Probe) {
  Write-Host ("找到端口: " + $found)
  Write-Host ("地址: " + $url)
  exit 0
}

Write-Host ("设置页: " + $url)

# 浏览器：默认 Chrome（夸克渲染这个页面明显慢），-Default 用系统默认
$chrome = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $Default -and $chrome) {
  Write-Host '用 Chrome 打开（加 -Default 可改用系统默认浏览器）'
  Start-Process -FilePath $chrome -ArgumentList @('--new-window', $url)
} else {
  Start-Process $url
}
exit 0