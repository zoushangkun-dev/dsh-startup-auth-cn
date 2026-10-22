# Raise the Windows Hello consent prompt above everything else.
# The prompt is hosted out-of-process by CredentialUIBroker.exe in a window of
# class "Credential Dialog Xaml Host" (title "Windows 安全中心"), and it is
# neither topmost nor foreground -- so an Electron app covering the screen
# hides it completely.
#
# Polls for a few seconds because the dialog appears slightly after the host
# spawns hello.ps1. Prints RAISED=<hwnd> once, then exits.
param(
    [int]$Seconds = 20,
    [int]$IntervalMs = 300
)

$ErrorActionPreference = 'Continue'

Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;

public static class WinRaise {
    delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hWnd, StringBuilder s, int max);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hWnd, int cmd);
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int x, int y, int cx, int cy, uint flags);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hWnd, IntPtr pid);
    [DllImport("user32.dll")] static extern bool AttachThreadInput(uint attach, uint attachTo, bool doAttach);
    [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
    [StructLayout(LayoutKind.Sequential)] struct RECT { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
    [DllImport("user32.dll")] static extern bool MoveWindow(IntPtr hWnd, int x, int y, int w, int h, bool repaint);
    [DllImport("user32.dll")] static extern int GetSystemMetrics(int index);

    const uint SWP_NOMOVE = 0x0002;
    const uint SWP_NOSIZE = 0x0001;
    const uint SWP_SHOWWINDOW = 0x0040;
    static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);

    public static IntPtr Find() {
        IntPtr found = IntPtr.Zero;
        EnumWindows((h, l) => {
            if (!IsWindowVisible(h)) return true;
            var cls = new StringBuilder(256);
            GetClassName(h, cls, cls.Capacity);
            if (cls.ToString().IndexOf("Credential Dialog", StringComparison.OrdinalIgnoreCase) >= 0) {
                found = h;
                return false;
            }
            uint pid;
            GetWindowThreadProcessId(h, out pid);
            try {
                if (System.Diagnostics.Process.GetProcessById((int)pid).ProcessName
                        .IndexOf("CredentialUIBroker", StringComparison.OrdinalIgnoreCase) >= 0) {
                    found = h;
                    return false;
                }
            } catch {}
            return true;
        }, IntPtr.Zero);
        return found;
    }

    public static bool Raise(IntPtr hWnd) {
        if (hWnd == IntPtr.Zero) return false;
        ShowWindow(hWnd, 9); // SW_RESTORE

        // The broker reuses one window across prompts, so a window another tool
        // parked off-screen stays parked: raising it would just focus something
        // nobody can see. Put it back on the desktop first.
        RECT r;
        if (GetWindowRect(hWnd, out r)) {
            bool offscreen = r.Left < -1000 || r.Top < -1000 || r.Right < 0 || r.Bottom < 0;
            if (offscreen) {
                int w = r.Right - r.Left, h = r.Bottom - r.Top;
                if (w <= 0 || h <= 0) { w = 520; h = 420; }
                int x = Math.Max(80, (GetSystemMetrics(0) - w) / 2);
                int y = Math.Max(80, (GetSystemMetrics(1) - h) / 2);
                MoveWindow(hWnd, x, y, w, h, true);
            }
        }

        // Topmost first: this is what makes it visible even if Windows refuses
        // to hand us the foreground (our own app currently owns it).
        SetWindowPos(hWnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
        BringWindowToTop(hWnd);

        bool ok = SetForegroundWindow(hWnd);
        if (!ok) {
            // Foreground lock: temporarily join the input queue of the thread
            // that owns the dialog, then try again.
            uint pid;
            uint tid = GetWindowThreadProcessId(hWnd, out pid);
            uint mine = GetCurrentThreadId();
            if (AttachThreadInput(mine, tid, true)) {
                BringWindowToTop(hWnd);
                SetForegroundWindow(hWnd);
                AttachThreadInput(mine, tid, false);
            }
        }
        return true;
    }
}
'@

$deadline = (Get-Date).AddSeconds($Seconds)
while ((Get-Date) -lt $deadline) {
    $hwnd = [WinRaise]::Find()
    if ($hwnd -ne [IntPtr]::Zero) {
        [void][WinRaise]::Raise($hwnd)
        Write-Output ("RAISED=" + $hwnd.ToString("X"))
        exit 0
    }
    Start-Sleep -Milliseconds $IntervalMs
}

Write-Output 'RAISED=none'
