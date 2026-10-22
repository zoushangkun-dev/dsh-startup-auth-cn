# 邮件救援配置向导（dsh-boot-handmade）
# 问你要「发件邮箱 + 客户端授权密码」，写进 ~/.dsh/boot-recover.json，
# 然后真发一封测试邮件，成不成当场就知道。
$ErrorActionPreference = 'Stop'
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function 提示($text) { Write-Host $text -ForegroundColor Cyan }
function 成功($text) { Write-Host $text -ForegroundColor Green }
function 失败($text) { Write-Host $text -ForegroundColor Red }

$homeDir = Join-Path $env:USERPROFILE '.dsh'
$configPath = Join-Path $homeDir 'boot-recover.json'

Write-Host '============================================'
Write-Host '  DeepSeek Harness · 邮件救援配置'
Write-Host '============================================'
Write-Host ''
Write-Host '说明：这里要的不是登录密码，是邮箱的「客户端授权密码」。'
Write-Host '126 邮箱获取路径：网页版 → 设置 → POP3/SMTP/IMAP → 开启 SMTP → 新增授权密码'
Write-Host ''

# 收件地址
$toDefault = ''
if (Test-Path $configPath) {
    try { $toDefault = (Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json).email.to } catch { }
}
if (-not $toDefault) { $toDefault = '{0}@126.com' -f $env:USERNAME }
$to = Read-Host ("收件邮箱（验证码发到这里）[$toDefault]")
if ([string]::IsNullOrWhiteSpace($to)) { $to = $toDefault }
if ($to -notmatch '^[^@\s]+@[^@\s]+\.[^@\s]+$') { 失败 "邮箱格式不对：$to"; exit 1 }

# 发件账号
$user = Read-Host ("发件邮箱 $to")
if ([string]::IsNullOrWhiteSpace($user)) { $user = $to }

# SMTP 服务器
$domain = ($user -split '@')[-1].ToLower()
$hostDefault = switch -Regex ($domain) {
    '126\.com' { 'smtp.126.com' }
    '163\.com' { 'smtp.163.com' }
    'qq\.com'  { 'smtp.qq.com' }
    'gmail\.com' { 'smtp.gmail.com' }
    'outlook\.com|hotmail\.com|live\.com' { 'smtp.office365.com' }
    default { "smtp.$domain" }
}
$smtpHost = Read-Host ("SMTP 服务器 [$hostDefault]")
if ([string]::IsNullOrWhiteSpace($smtpHost)) { $smtpHost = $hostDefault }

$portDefault = if ($domain -match 'gmail|office365') { '587' } else { '465' }
$port = Read-Host ("端口 [$portDefault]")
if ([string]::IsNullOrWhiteSpace($port)) { $port = $portDefault }

# 授权密码（不回显）
$secure = Read-Host '客户端授权密码（输入时不显示）' -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
if ([string]::IsNullOrWhiteSpace($password)) { 失败 '授权密码为空，已取消。'; exit 1 }

# 写配置
New-Item -ItemType Directory -Force -Path $homeDir | Out-Null
$config = @{
    email = @{
        to   = $to
        smtp = @{ host = $smtpHost; port = [int]$port; username = $user; password = $password }
    }
    phone = ''
    sms   = @{ provider = 'none' }
}
$json = $config | ConvertTo-Json -Depth 6
[IO.File]::WriteAllText($configPath, $json, (New-Object Text.UTF8Encoding($false)))

# 只允许当前用户读写，避免授权码被同机其它账户看到
try {
    & icacls.exe $configPath /inheritance:r /grant:r "$($env:USERNAME):F" 2>&1 | Out-Null
    成功 '权限已收紧：只有你能读这个文件'
} catch { Write-Host '（收紧权限失败，但配置已写入）' -ForegroundColor Yellow }

Write-Host ''
提示 "配置已写入：$configPath"
Write-Host ''
提示 '正在用这份配置发一封测试邮件…'

# 组一封邮件，用 Windows 自带的 curl.exe 走 SMTPS
$code = '123456'
$subject = 'DeepSeek Harness 邮件救援测试'
$body = "这是一封测试邮件。`r`n`r`n如果你收到了它，说明邮件救援配置成功。`r`n收件人：$to`r`n发送时间：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($body))
$subjB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($subject))
$eml = @(
    "From: $user"
    "To: $to"
    "Subject: =?UTF-8?B?$subjB64?="
    "Date: $((Get-Date).ToUniversalTime().ToString('r'))"
    'MIME-Version: 1.0'
    'Content-Type: text/plain; charset=UTF-8'
    'Content-Transfer-Encoding: base64'
    ''
    $b64
) -join "`r`n"
$tmp = Join-Path $env:TEMP ("boot-recover-test-" + $PID + ".eml")
[IO.File]::WriteAllText($tmp, $eml, (New-Object Text.UTF8Encoding($false)))

$curl = Join-Path $env:SystemRoot 'System32\curl.exe'
$args2 = @(
    '-sS', '--max-time', '30',
    '--url', "smtps://${smtpHost}:${port}",
    '--user', "${user}:${password}",
    '--mail-from', $user,
    '--mail-rcpt', $to,
    '--upload-file', $tmp
)
$out = & $curl @args2 2>&1
$code = $LASTEXITCODE
Remove-Item $tmp -Force -ErrorAction SilentlyContinue

Write-Host ''
if ($code -eq 0) {
    成功 '✓ 测试邮件已发出。去收件箱看一眼（可能在垃圾箱）。'
    成功 '  之后在门上的「PIN 输错被锁了？」里就能收到真实验证码。'
} else {
    失败 "✗ 发送失败（curl exit $code）"
    Write-Host ($out | Out-String).Trim() -ForegroundColor Yellow
    Write-Host ''
    Write-Host '常见原因：' -ForegroundColor Yellow
    Write-Host '  · 授权密码填错（必须用「客户端授权密码」，不是登录密码）'
    Write-Host '  · 邮箱没开启 SMTP 服务'
    Write-Host '  · 端口不对：SSL 用 465，STARTTLS 用 587（本脚本只走 SSL）'
}
Write-Host ''
Read-Host '按回车关闭'
