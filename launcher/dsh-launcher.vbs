' Hidden launcher: instant feedback while DeepSeek Harness boots.
' ASCII only on purpose -- a UTF-8 file with Chinese text in it is read as GBK by
' wscript, which corrupts the PowerShell path and the launcher exits silently.
Dim fso, shell, here, ps1, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = here & "\dsh-launcher.ps1"
If Not fso.FileExists(ps1) Then
  MsgBox "Missing: " & ps1, 16, "DSH launcher"
  WScript.Quit 1
End If
cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """"
' Optional: wscript dsh-launcher.vbs -Demo   (shows the splash without starting DSH)
If WScript.Arguments.Count > 0 Then
  cmd = cmd & " " & WScript.Arguments(0)
End If
shell.Run cmd, 0, False
