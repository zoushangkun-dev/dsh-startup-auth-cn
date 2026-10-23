# 启动 DSH：点下去立刻有反馈，且不会重复启动。
#
# 为什么要它：DSH 的 Electron 主进程要好几秒才建出窗口，这段空窗期里点第二次
# 只会拉起一个立刻退出的进程，看起来像「点了没反应」。本脚本在点击后约 100ms
# 弹出小窗，主窗口出现时自动关闭。

param(
  [string]$Exe = 'D:\dsh\DeepSeek Harness.exe',
  [string]$ProcessName = 'DeepSeek Harness',
  [int]$TimeoutSeconds = 40,
  [switch]$Demo
)

$ErrorActionPreference = 'Stop'
$logPath = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'launcher.log'

function Write-Log([string]$text) {
  try {
    ((Get-Date).ToString('yyyy-MM-dd HH:mm:ss') + '  ' + $text) |
      Out-File -FilePath $logPath -Append -Encoding utf8
  } catch { }
}

function Show-Error([string]$text) {
  Write-Log ('ERROR  ' + $text)
  try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($text, 'DSH launcher', 'OK', 'Error') | Out-Null
  } catch { }
}

try {
  Write-Log ('start  demo=' + [string]$Demo + '  ps=' + $PSVersionTable.PSVersion.ToString())

  # One assembly per call: Add-Type -AssemblyName does not accept a list on 5.1.
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  Write-Log 'assemblies loaded'

  # Already running with a window: bring it up instead of starting a second one.
  $existing = @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue |
    Where-Object { $_.MainWindowHandle -ne 0 })
  if ($existing.Count -gt 0 -and -not $Demo) {
    Write-Log ('already running, pid=' + $existing[0].Id + ', focusing')
    $sig = @"
using System;
using System.Runtime.InteropServices;
public class BhWin {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
}
"@
    try {
      Add-Type -TypeDefinition $sig -ErrorAction SilentlyContinue
      [BhWin]::ShowWindow($existing[0].MainWindowHandle, 9) | Out-Null
      [BhWin]::SetForegroundWindow($existing[0].MainWindowHandle) | Out-Null
    } catch { Write-Log ('focus failed: ' + $_.Exception.Message) }
    exit 0
  }

  $form = New-Object System.Windows.Forms.Form
  $form.FormBorderStyle = 'None'
  $form.StartPosition = 'CenterScreen'
  $form.Size = New-Object System.Drawing.Size(420, 150)
  $form.BackColor = [System.Drawing.Color]::FromArgb(20, 20, 26)
  $form.TopMost = $true
  $form.ShowInTaskbar = $false

  $title = New-Object System.Windows.Forms.Label
  $title.Text = 'DEEPSEEK HARNESS'
  $title.ForeColor = [System.Drawing.Color]::FromArgb(141, 136, 126)
  $title.Font = New-Object System.Drawing.Font('Consolas', 10)
  $title.AutoSize = $true
  $title.Location = New-Object System.Drawing.Point(32, 34)
  $form.Controls.Add($title)

  # Built from code points on purpose: this line comes from a UTF-8 file, and a
  # machine with a different ANSI code page would render it as mojibake.
  $msg = New-Object System.Windows.Forms.Label
  $msg.Text = [string][char]0x6B63 + [char]0x5728 + [char]0x542F + [char]0x52A8 + '...'
  $msg.ForeColor = [System.Drawing.Color]::FromArgb(243, 238, 228)
  $msg.Font = New-Object System.Drawing.Font('Microsoft YaHei', 16, [System.Drawing.FontStyle]::Bold)
  $msg.AutoSize = $true
  $msg.Location = New-Object System.Drawing.Point(30, 64)
  $form.Controls.Add($msg)

  $bar = New-Object System.Windows.Forms.Panel
  $bar.Size = New-Object System.Drawing.Size(0, 3)
  $bar.BackColor = [System.Drawing.Color]::FromArgb(255, 90, 31)
  $bar.Location = New-Object System.Drawing.Point(32, 118)
  $form.Controls.Add($bar)
  Write-Log 'form built'

  $spawned = $null
  if (-not $Demo) {
    if (Test-Path -LiteralPath $Exe) {
      try { $spawned = Start-Process -FilePath $Exe -PassThru -ErrorAction SilentlyContinue } catch { }
      Write-Log ('exe started, pid=' + [string]($spawned.Id))
    } else {
      Show-Error ('Executable not found: ' + $Exe)
    }
  }

  $state = @{ elapsed = 0 }
  $timer = New-Object System.Windows.Forms.Timer
  $timer.Interval = 120
  # 这两句用码点拼，避免 UTF-8 文件在别的代码页下变乱码。
  $msgWait = -join (@(0x5DF2,0x6709,0x5B9E,0x4F8B,0x5728,0x540E,0x53F0,0xFF0C,0x7B49,0x5F85,0x7A97,0x53E3) | ForEach-Object { [char]$_ })
  $msgFail = -join (@(0x8BF7,0x5728,0x4EFB,0x52A1,0x7BA1,0x7406,0x5668,0x7ED3,0x675F,0x20,0x44,0x53,0x48,0x20,0x540E,0x91CD,0x8BD5) | ForEach-Object { [char]$_ })
  $timer.Add_Tick({
    $state.elapsed += 120
    $w = [Math]::Min(356, [int](356 * ($state.elapsed / 2500.0)))
    if ($w -gt $bar.Width) { $bar.Width = $w }

    # 启动的进程已经退出、而系统里还有别的同名进程：单实例锁把它挡回来了，
    # 那个后台实例又没有窗口，所以什么都不会出现。
    if (-not $Demo -and $state.elapsed -ge 5000 -and $msg.Text -ne $msgWait) {
      $alive = @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowHandle -eq 0 })
      if ($spawned -and $spawned.HasExited -and $alive.Count -gt 0) {
        $msg.Text = $msgWait
        Write-Log ('blocked by a windowless instance, count=' + $alive.Count)
      }
    }
    if (-not $Demo -and $state.elapsed -ge 20000 -and ($msg.Text -eq $msgWait)) {
      $msg.Text = $msgFail
      $msg.ForeColor = [System.Drawing.Color]::FromArgb(255, 90, 31)
      Write-Log 'gave up: no window after 20s'
    }
    if (-not $Demo) {
      $hit = @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue |
        Where-Object { $_.MainWindowHandle -ne 0 })
      if ($hit.Count -gt 0) { $timer.Stop(); $form.Close(); return }
    }
    if ($state.elapsed -ge ($TimeoutSeconds * 1000)) { $timer.Stop(); $form.Close() }
  })
  $timer.Start()
  Write-Log 'showing'

  [void]$form.ShowDialog()
  Write-Log 'closed'
} catch {
  Show-Error ('Launcher failed: ' + $_.Exception.Message)
}
