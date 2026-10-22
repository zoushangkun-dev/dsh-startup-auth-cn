# Windows Hello prompt for dsh-boot-handmade.
# Prints AVAILABILITY=<enum> and RESULT=<enum> for the host half to parse.
# Uses UserConsentVerifier, i.e. whatever Windows Hello is enrolled for this
# user: fingerprint, face, or the Hello PIN.
#
# -CheckOnly  reports availability without putting a prompt on screen.
# -EchoMessage prints the prompt text and exits: proves how powershell.exe
#             decoded the literal below without a dialog appearing.
#
# NOTE: this file must stay UTF-8 **with BOM**. Windows PowerShell 5.1 reads a
# BOM-less .ps1 as ANSI (GBK on this machine), which turned the Chinese prompt
# into mojibake on screen. Do not "convert to UTF-8" without keeping the BOM.
param([switch]$CheckOnly, [switch]$EchoMessage)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Runtime.WindowsRuntime | Out-Null
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($op, $type) {
    $task = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
    $task.Wait(-1) | Out-Null
    $task.Result
}

try {
    [Windows.Security.Credentials.UI.UserConsentVerifier, Windows.Security.Credentials.UI, ContentType = WindowsRuntime] | Out-Null
    $verifier = [Windows.Security.Credentials.UI.UserConsentVerifier]
    $availabilityType = [Windows.Security.Credentials.UI.UserConsentVerifierAvailability]
    $resultType = [Windows.Security.Credentials.UI.UserConsentVerificationResult]

    $availability = Await ($verifier::CheckAvailabilityAsync()) $availabilityType
    Write-Output "AVAILABILITY=$availability"

    if ($CheckOnly) { exit 0 }

    if ("$availability" -ne 'Available') {
        Write-Output "RESULT=DeviceNotPresent"
        exit 0
    }

    # Kept in a variable so -EchoMessage can prove the decoded text.
    $message = '验证以解锁 DeepSeek Harness'
    if ($EchoMessage) {
        Write-Output ("MESSAGE=" + $message)
        exit 0
    }

    $result = Await ($verifier::RequestVerificationAsync($message)) $resultType
    Write-Output "RESULT=$result"
} catch {
    Write-Output "RESULT=Error"
    Write-Output ("DETAIL=" + $_.Exception.Message.Replace("`r", ' ').Replace("`n", ' '))
}
