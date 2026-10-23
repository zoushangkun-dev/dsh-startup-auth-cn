' Hidden launcher for DSH: shows instant feedback while Electron boots.
' Keep this file ASCII-only; the PowerShell script holds the Chinese text.
Dim fso, shell, here, ps1
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = here & "\启动DSH.ps1"
If Not fso.FileExists(ps1) Then
  MsgBox "Missing file: " & ps1, 16, "DSH launcher"
  WScript.Quit 1
End If
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """", 0, False
