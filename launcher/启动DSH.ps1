# 启动 DSH 的桌面快捷方式：点下去立刻有反馈，且不会重复启动。
#
# 为什么需要它：DSH 的 Electron 主进程要好几秒才建出窗口，这段时间里点第二次
# 只会拉起一个立刻退出的进程（任务管理器里能看到一闪而过），用户会以为没点上。
# 这个脚本在点击后 100 毫秒内弹出一个小窗，主窗口出现时自动关闭。

param(
  [string]$Exe = 'D:\dsh\DeepSeek Harness.exe',
  [string]$ProcessName = 'DeepSeek Harness',
  [int]$TimeoutSeconds = 40,
  [switch]$Demo
)

Add-Type -AssemblyName System.Windows.Forms, System.Drawing

# 已经有窗口了：直接退出，不重复启动。
$existing = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 }
if ($existing -and -not $Demo) {
  # 把已有窗口带到前面，省得用户以为没反应。
  Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
}
"@
  [Win]::ShowWindow($existing[0].MainWindowHandle, 9) | Out-Null
  [Win]::SetForegroundWindow($existing[0].MainWindowHandle) | Out-Null
  exit
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

$msg = New-Object System.Windows.Forms.Label
$msg.Text = '正在启动…'
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

if (-not $Demo) {
  Start-Process -FilePath $Exe -ErrorAction SilentlyContinue
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 120
$elapsed = 0
$timer.Add_Tick({
  $script:elapsed += 120
  $w = [Math]::Min(356, [int](356 * ($script:elapsed / 2500.0)))
  if ($w -gt $bar.Width) { $bar.Width = $w }
  if (-not $Demo) {
    $script:hit = Get-Process -Name $ProcessName -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowHandle -ne 0 }
    if ($script:hit) { $timer.Stop(); $form.Close(); return }
  }
  elseif ($script:elapsed -ge ($TimeoutSeconds * 1000)) { $timer.Stop(); $form.Close() }
})
$timer.Start()

[void]$form.ShowDialog()
