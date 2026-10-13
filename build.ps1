[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

if (-not ([System.Management.Automation.PSTypeName]'PathSecurity').Type) {
    Add-Type -TypeDefinition @"
using System; using System.IO; using System.Runtime.InteropServices; using System.Text; using Microsoft.Win32.SafeHandles;
public static class PathSecurity {
    [StructLayout(LayoutKind.Sequential)] public struct FILE_DISPOSITION_INFO { [MarshalAs(UnmanagedType.U1)] public bool DeleteFile; }
    [DllImport("kernel32.dll", EntryPoint = "CreateFileW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern SafeFileHandle CreateFile(string n, uint a, uint s, IntPtr sec, uint d, uint f, IntPtr t);
    [DllImport("kernel32.dll", EntryPoint = "GetFinalPathNameByHandleW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern uint GetFinalPathNameByHandle(SafeFileHandle h, StringBuilder b, uint c, uint f);
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetFileInformationByHandle(SafeFileHandle h, int c, ref FILE_DISPOSITION_INFO i, uint l);
    [DllImport("kernel32.dll", EntryPoint = "MoveFileExW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool MoveFileEx(string e, string n, uint f);

    public static string GetFinalPath(SafeFileHandle h) {
        StringBuilder sb = new StringBuilder(1024);
        uint res = GetFinalPathNameByHandle(h, sb, 1024, 0);
        if (res == 0) return null;
        if (res >= 1024) { sb = new StringBuilder((int)res + 2); if (GetFinalPathNameByHandle(h, sb, (uint)sb.Capacity, 0) == 0) return null; }
        string p = sb.ToString();
        return p.StartsWith(@"\\?\UNC\") ? @"\\" + p.Substring(8) : (p.StartsWith(@"\\?\") ? p.Substring(4) : p);
    }

    public static string GetFinalPath(string p) {
        using (SafeFileHandle h = CreateFile(p, 0x0080, 7, IntPtr.Zero, 3, 0x02200000, IntPtr.Zero)) { return h.IsInvalid ? null : GetFinalPath(h); }
    }

    public static bool IsStrictSubPath(string path, string parentCanonical) {
        if (string.IsNullOrEmpty(path) || string.IsNullOrEmpty(parentCanonical)) return false;
        string p = Path.GetFullPath(path).TrimEnd('\\', '/');
        string parent = Path.GetFullPath(parentCanonical).TrimEnd('\\', '/');
        return p.Equals(parent, StringComparison.OrdinalIgnoreCase) || p.StartsWith(parent + "\\", StringComparison.OrdinalIgnoreCase);
    }

    public static void AssertNotReparsePoint(string p, string root) {
        using (SafeFileHandle h = CreateFile(p, 0x0080, 7, IntPtr.Zero, 3, 0x02200000, IntPtr.Zero)) {
            if (h.IsInvalid) throw new FileNotFoundException(p);
            string f = GetFinalPath(h);
            if (f == null || (root != null && !IsStrictSubPath(f, root)) || (File.GetAttributes(p) & FileAttributes.ReparsePoint) != 0)
                throw new InvalidOperationException("Reparse or outside root: " + p);
        }
    }
    public static SafeFileHandle LockDirectory(string dir, string root) {
        SafeFileHandle h = CreateFile(dir, 0x80000000, 3, IntPtr.Zero, 3, 0x02200000, IntPtr.Zero);
        if (h.IsInvalid) throw new IOException("Cannot lock dir: " + dir);
        string f = GetFinalPath(h);
        if (f == null || !IsStrictSubPath(f, root) || (File.GetAttributes(dir) & FileAttributes.ReparsePoint) != 0) {
            h.Dispose(); throw new InvalidOperationException("Directory invalid or reparse: " + dir);
        }
        return h;
    }

    public static void WriteFileHandleBound(string dir, string name, string content, string root) {
        using (SafeFileHandle hDir = LockDirectory(dir, root)) {
            string m = Path.Combine(dir, name);
            if (File.Exists(m) && (File.GetAttributes(m) & FileAttributes.ReparsePoint) != 0) throw new InvalidOperationException("Reparse: " + m);
            string tmp = Path.Combine(dir, name + ".tmp." + Guid.NewGuid().ToString("N"));
            using (SafeFileHandle h = CreateFile(tmp, 0x40000000, 0, IntPtr.Zero, 2, 0x02200000, IntPtr.Zero)) {
                if (h.IsInvalid) throw new IOException(tmp);
                string f = GetFinalPath(h);
                if (f == null || !IsStrictSubPath(f, root)) throw new InvalidOperationException("Outside root: " + tmp);
                byte[] b = Encoding.UTF8.GetBytes(content);
                using (FileStream s = new FileStream(h, FileAccess.Write)) { s.Write(b, 0, b.Length); s.Flush(true); }
            }
            if (File.Exists(m)) { FileAttributes a = File.GetAttributes(m); if ((a & FileAttributes.ReadOnly) != 0) File.SetAttributes(m, a & ~FileAttributes.ReadOnly); }
            if (!MoveFileEx(tmp, m, 9)) { DeleteHandleBound(tmp, root); throw new IOException("Failed atomic rename: " + m); }
            AssertNotReparsePoint(m, root);
        }
    }

    public static void CopyFileHandleBound(string s, string d, string srcRoot, string dstRoot) {
        using (SafeFileHandle hSrc = CreateFile(s, 0x80000080, 1, IntPtr.Zero, 3, 0x02200000, IntPtr.Zero)) {
            if (hSrc.IsInvalid) throw new FileNotFoundException("Source: " + s);
            string fSrc = GetFinalPath(hSrc);
            if (fSrc == null || !IsStrictSubPath(fSrc, srcRoot) || (File.GetAttributes(s) & FileAttributes.ReparsePoint) != 0)
                throw new InvalidOperationException("Source invalid or reparse: " + s);
            string dir = Path.GetDirectoryName(d);
            if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
            using (SafeFileHandle hDir = LockDirectory(dir, dstRoot)) {
                if (File.Exists(d) && (File.GetAttributes(d) & FileAttributes.ReparsePoint) != 0) throw new InvalidOperationException("Reparse dest: " + d);
                string tmp = Path.Combine(dir, Path.GetFileName(d) + ".tmp." + Guid.NewGuid().ToString("N"));
                using (SafeFileHandle hDst = CreateFile(tmp, 0x40000000, 0, IntPtr.Zero, 2, 0x02200000, IntPtr.Zero)) {
                    if (hDst.IsInvalid) throw new IOException("Dest: " + tmp);
                    string fDst = GetFinalPath(hDst);
                    if (fDst == null || !IsStrictSubPath(fDst, dstRoot)) throw new InvalidOperationException("Dest outside root: " + tmp);
                    using (FileStream src = new FileStream(hSrc, FileAccess.Read))
                    using (FileStream dst = new FileStream(hDst, FileAccess.Write)) { src.CopyTo(dst); dst.Flush(true); }
                }
                if (File.Exists(d)) { FileAttributes a = File.GetAttributes(d); if ((a & FileAttributes.ReadOnly) != 0) File.SetAttributes(d, a & ~FileAttributes.ReadOnly); }
                if (!MoveFileEx(tmp, d, 9)) { DeleteHandleBound(tmp, dstRoot); throw new IOException("Failed atomic rename: " + d); }
                AssertNotReparsePoint(d, dstRoot);
            }
        }
    }

    public static bool DeleteHandleBound(string p, string root) {
        if (!File.Exists(p) && !Directory.Exists(p)) return false;
        using (SafeFileHandle h = CreateFile(p, 0x00010080, 7, IntPtr.Zero, 3, 0x02200000, IntPtr.Zero)) {
            if (h.IsInvalid) return false;
            string f = GetFinalPath(h);
            if (f == null || !IsStrictSubPath(f, root)) throw new InvalidOperationException("Outside root: " + p);
            FILE_DISPOSITION_INFO d = new FILE_DISPOSITION_INFO { DeleteFile = true };
            if (!SetFileInformationByHandle(h, 4, ref d, (uint)Marshal.SizeOf(typeof(FILE_DISPOSITION_INFO)))) {
                try { FileAttributes a = File.GetAttributes(p); if ((a & FileAttributes.ReadOnly) != 0) File.SetAttributes(p, a & ~FileAttributes.ReadOnly); } catch { }
                return SetFileInformationByHandle(h, 4, ref d, (uint)Marshal.SizeOf(typeof(FILE_DISPOSITION_INFO)));
            }
            return true;
        }
    }

    public static SafeFileHandle OpenLockHandle(string p, string root) {
        SafeFileHandle h = CreateFile(p, 0xC0060000, 0, IntPtr.Zero, 4, 0x02200000, IntPtr.Zero);
        if (h.IsInvalid) return null;
        string f = GetFinalPath(h);
        if (f == null || !IsStrictSubPath(f, root) || (File.GetAttributes(p) & FileAttributes.ReparsePoint) != 0) {
            h.Dispose(); throw new InvalidOperationException("Lock is reparse or outside root: " + p);
        }
        return h;
    }
}
"@
}

$ProjectDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
$pFinal = [PathSecurity]::GetFinalPath($ProjectDir); if (-not $pFinal) { $pFinal = [System.IO.Path]::GetFullPath($ProjectDir) }
$ProjectDirCanonical = $pFinal.TrimEnd('\', '/') + '\'
$tFinal = [PathSecurity]::GetFinalPath($env:TEMP); if (-not $tFinal) { $tFinal = [System.IO.Path]::GetFullPath($env:TEMP) }
$TempDirCanonical = $tFinal.TrimEnd('\', '/') + '\'

function Test-AnonJwt([string]$Token) {
    if ($Token -notmatch '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$') { return $false }
    try {
        $b = $Token.Split('.')[1].Replace('-', '+').Replace('_', '/')
        switch ($b.Length % 4) { 2 { $b += "==" } 3 { $b += "=" } }
        return ((ConvertFrom-Json ([System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b)))).role -eq 'anon')
    } catch { return $false }
}

function Assert-SecretScan([string]$DirectoryPath) {
    Get-ChildItem -LiteralPath $DirectoryPath -Recurse -File | ForEach-Object {
        $c = [System.IO.File]::ReadAllText($_.FullName)
        if ($c -match 'sb_secret_[A-Za-z0-9_-]{10,}' -or $c -match '(?i)\b(service_role|master_key)\b') { throw "Forbidden key: $($_.Name)" }
        foreach ($m in [regex]::Matches($c, 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}')) {
            if (-not (Test-AnonJwt $m.Value)) { throw "Invalid JWT: $($_.Name)" }
        }
    }
}

$UserIdent = [System.Security.Principal.WindowsIdentity]::GetCurrent(); $UserSid = $UserIdent.User.Value
$ProjectHash = [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($ProjectDirCanonical.ToLowerInvariant()))).Replace("-", "").Substring(0, 16)
$LockFilePath = Join-Path $env:TEMP "wine_tasting_build_${ProjectHash}_${UserSid}.lock"; $LockFile = $null
$FileSecurity = New-Object System.Security.AccessControl.FileSecurity; $FileSecurity.SetAccessRuleProtection($true, $false)
$FileSecurity.SetAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($UserIdent.User, "FullControl", "Allow")))

function Open-BuildLock([string]$Path, [System.Security.AccessControl.FileSecurity]$Security, [string]$ExpectedSid, [string]$TempRoot) {
    $Handle = [PathSecurity]::OpenLockHandle($Path, $TempRoot)
    if (-not $Handle -or $Handle.IsInvalid) {
        $Err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
        if ($Err -eq 32) { throw [System.IO.IOException]"Lock busy." }
        if ($Err -eq 5) { throw [System.UnauthorizedAccessException]"Lock access denied." }
        throw (New-Object System.ComponentModel.Win32Exception($Err))
    }
    $Stream = New-Object System.IO.FileStream($Handle, [System.IO.FileAccess]::ReadWrite)
    try {
        if ($Stream.GetAccessControl().GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $ExpectedSid) {
            throw [System.Security.SecurityException]"Build lock owner mismatch ($ExpectedSid)."
        }
        $Stream.SetAccessControl($Security)
        return $Stream
    } catch { $Stream.Dispose(); throw }
}

try {
    $LockFile = Open-BuildLock $LockFilePath $FileSecurity $UserSid $TempDirCanonical
} catch [System.IO.IOException], [System.UnauthorizedAccessException] {
    Write-Host "Waiting for build lock..." -ForegroundColor Yellow
    $Retries = 0
    while ($Retries -lt 30) {
        Start-Sleep -Seconds 2
        try { $LockFile = Open-BuildLock $LockFilePath $FileSecurity $UserSid $TempDirCanonical; break }
        catch [System.IO.IOException], [System.UnauthorizedAccessException] { $Retries++ }
    }
    if (-not $LockFile) { throw "Timeout acquiring build lock." }
}

$OriginalLocation = Get-Location; $BuildSucceeded = $false; $BuildDir = $null; $PreservedEnvVars = @{}
$BuildGuid = [guid]::NewGuid().ToString("N"); $TargetDist = Join-Path $ProjectDir "dist"

function Remove-SafeFolder([string]$FolderPath, [string]$AllowedParentCanonical, [string[]]$AllowedPrefixes) {
    if (-not (Test-Path -LiteralPath $FolderPath)) { return }
    $CanonicalPath = [System.IO.Path]::GetFullPath($FolderPath)
    if (-not [PathSecurity]::IsStrictSubPath($CanonicalPath, $AllowedParentCanonical)) { return }
    $Leaf = [System.IO.Path]::GetFileName($CanonicalPath)
    if (-not ($AllowedPrefixes | Where-Object { $Leaf.StartsWith($_, [System.StringComparison]::OrdinalIgnoreCase) })) { return }
    $RootInfo = New-Object System.IO.DirectoryInfo($CanonicalPath); if (-not $RootInfo.Exists) { return }
    if (($RootInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { [PathSecurity]::DeleteHandleBound($CanonicalPath, $AllowedParentCanonical) | Out-Null; return }
    $Stack = New-Object System.Collections.Generic.Stack[System.IO.DirectoryInfo]; $DirsToDelete = New-Object System.Collections.ArrayList; $Stack.Push($RootInfo)
    while ($Stack.Count -gt 0) {
        $Current = $Stack.Pop()
        $Resolved = [PathSecurity]::GetFinalPath($Current.FullName)
        if (-not $Resolved -or (-not [PathSecurity]::IsStrictSubPath($Resolved, $AllowedParentCanonical))) { throw "Path escape: $($Current.FullName)" }
        if (($Current.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { [PathSecurity]::DeleteHandleBound($Current.FullName, $AllowedParentCanonical) | Out-Null; continue }
        [void]$DirsToDelete.Add($Current)
        foreach ($Sub in $Current.GetDirectories()) {
            if (($Sub.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { [PathSecurity]::DeleteHandleBound($Sub.FullName, $AllowedParentCanonical) | Out-Null }
            else { $Stack.Push($Sub) }
        }
        foreach ($File in $Current.GetFiles()) { [PathSecurity]::DeleteHandleBound($File.FullName, $AllowedParentCanonical) | Out-Null }
    }
    for ($i = $DirsToDelete.Count - 1; $i -ge 0; $i--) {
        $Dir = $DirsToDelete[$i]
        if ($Dir.Exists -and (-not [PathSecurity]::DeleteHandleBound($Dir.FullName, $AllowedParentCanonical))) { try { $Dir.Delete($false) } catch { } }
    }
}

function Copy-SafeDirectory([string]$SourceDir, [string]$DestDir, [string]$SrcRoot, [string]$DstRoot, [switch]$Prune) {
    if (-not (Test-Path -LiteralPath $SourceDir)) { return }
    $SourceCanonical = [System.IO.Path]::GetFullPath($SourceDir).TrimEnd('\', '/') + '\'
    $SourceDirInfo = New-Object System.IO.DirectoryInfo($SourceCanonical)
    if (($SourceDirInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Reparse point: $SourceCanonical" }
    if (-not (Test-Path -LiteralPath $DestDir)) { New-Item -ItemType Directory -Path $DestDir -Force | Out-Null }
    [PathSecurity]::AssertNotReparsePoint($DestDir, $DstRoot)
    $Stack = New-Object System.Collections.Generic.Stack[System.IO.DirectoryInfo]; $Visited = New-Object System.Collections.ArrayList
    $Stack.Push($SourceDirInfo)
    while ($Stack.Count -gt 0) {
        $CurrentDir = $Stack.Pop()
        $ResolvedDir = [PathSecurity]::GetFinalPath($CurrentDir.FullName)
        if (-not $ResolvedDir -or (-not [PathSecurity]::IsStrictSubPath($ResolvedDir, $SourceCanonical))) { throw "Path escape: $($CurrentDir.FullName)" }
        if (($CurrentDir.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Reparse dir: $($CurrentDir.FullName)" }
        $Relative = if ($CurrentDir.FullName.Length -gt $SourceCanonical.Length) { $CurrentDir.FullName.Substring($SourceCanonical.Length).TrimStart('\', '/') } else { "" }
        $CurrentTarget = if ($Relative) { Join-Path $DestDir $Relative } else { $DestDir }
        if (-not (Test-Path -LiteralPath $CurrentTarget)) { New-Item -ItemType Directory -Path $CurrentTarget -Force | Out-Null }
        [PathSecurity]::AssertNotReparsePoint($CurrentTarget, $DstRoot)
        [void]$Visited.Add(@($CurrentTarget, $CurrentDir.FullName))
        foreach ($File in $CurrentDir.GetFiles()) {
            if ($Relative -eq "" -and $File.Name -eq "index.html") { continue }
            if (($File.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Reparse file: $($File.FullName)" }
            [PathSecurity]::CopyFileHandleBound($File.FullName, (Join-Path $CurrentTarget $File.Name), $SrcRoot, $DstRoot)
        }
        foreach ($SubDir in $CurrentDir.GetDirectories()) {
            if (($SubDir.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Reparse dir: $($SubDir.FullName)" }
            $Stack.Push($SubDir)
        }
    }
    $RootIndex = Join-Path $SourceDir "index.html"
    if (Test-Path -LiteralPath $RootIndex) { [PathSecurity]::CopyFileHandleBound($RootIndex, (Join-Path $DestDir "index.html"), $SrcRoot, $DstRoot) }
    if ($Prune) {
        foreach ($Pair in $Visited) {
            $Tgt, $Src = $Pair
            if (Test-Path -LiteralPath $Tgt) {
                $TgtInfo = New-Object System.IO.DirectoryInfo($Tgt)
                $TgtInfo.GetFiles() | Where-Object { -not (Test-Path -LiteralPath (Join-Path $Src $_.Name)) } | ForEach-Object { [PathSecurity]::DeleteHandleBound($_.FullName, $DstRoot) | Out-Null }
                $TgtInfo.GetDirectories() | Where-Object { -not (Test-Path -LiteralPath (Join-Path $Src $_.Name)) } | ForEach-Object { Remove-SafeFolder $_.FullName $DstRoot @($_.Name) }
            }
        }
    }
}

try {
    Get-ChildItem -LiteralPath $env:TEMP -Filter "wine-tasting-build-$ProjectHash-*" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.LastWriteTime -lt (Get-Date).AddHours(-1)) { Remove-SafeFolder $_.FullName $TempDirCanonical @("wine-tasting-build-$ProjectHash-") }
    }

    @("dist_staging_*", "dist_backup_*") | ForEach-Object {
        Get-ChildItem -LiteralPath $ProjectDir -Filter $_ -Directory -ErrorAction SilentlyContinue |
            ForEach-Object { Remove-SafeFolder $_.FullName $ProjectDirCanonical @("dist_staging_", "dist_backup_") }
    }

    $BuildDir = Join-Path $env:TEMP "wine-tasting-build-$ProjectHash-$BuildGuid"
    $SystemNpm = Get-Command npm.cmd, npm -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $SystemNpm) { throw "npm not in PATH. Install Node.js." }
    $NpmCmd = $SystemNpm.Source

    Write-Host "Compiling Wine Tasting App..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null
    $ds = New-Object System.Security.AccessControl.DirectorySecurity
    $ds.SetAccessRuleProtection($true, $false); $ds.SetOwner($UserIdent.User)
    $ds.SetAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($UserIdent.User, "FullControl", "ContainerInherit, ObjectInherit", "None", "Allow")))
    (Get-Item -LiteralPath $BuildDir).SetAccessControl($ds); [PathSecurity]::AssertNotReparsePoint($BuildDir, $TempDirCanonical)

    Write-Host "1. Copying files..." -ForegroundColor Cyan
    Copy-SafeDirectory (Join-Path $ProjectDir "src") (Join-Path $BuildDir "src") $ProjectDirCanonical $TempDirCanonical
    
    $ProjectLockFile = Join-Path $ProjectDir "package-lock.json"
    if (-not (Test-Path -LiteralPath $ProjectLockFile)) { throw "package-lock.json required." }

    @("package.json", "package-lock.json", "vite.config.ts", "tsconfig.json", "tsconfig.node.json", "postcss.config.js", "tailwind.config.js", "index.html") | ForEach-Object {
        $p = Join-Path $ProjectDir $_
        if (Test-Path -LiteralPath $p) { [PathSecurity]::CopyFileHandleBound($p, (Join-Path $BuildDir $_), $ProjectDirCanonical, $TempDirCanonical) }
    }

    $LocalEnv = Join-Path $ProjectDir ".env"
    if (Test-Path -LiteralPath $LocalEnv) {
        [PathSecurity]::AssertNotReparsePoint($LocalEnv, $ProjectDirCanonical)
        $AllowedVars = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_APP_TITLE', 'VITE_APP_VERSION')
        $ViteEnvLines = @()
        Get-Content -LiteralPath $LocalEnv | ForEach-Object {
            $Line = ($_.Trim() -replace '^(?i)export\s+', '').Trim()
            if ($Line -match '^VITE_') {
                $k, $v = ($Line -split '=', 2).Trim()
                $v = $v.Trim('"').Trim("'")
                if ($k -notin $AllowedVars) { throw "Unapproved variable in .env: $k" }
                if ($v -match '(?i)(sb_secret_|service_role|master_key)') { throw "Sensitive pattern in .env: $k" }
                if ($v -match '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$' -and (-not (Test-AnonJwt $v))) { throw "Invalid JWT in .env: $k" }
                if ($k -eq 'VITE_SUPABASE_URL' -and $v -notmatch '\Ahttps:\/\/[A-Za-z0-9._-]+\.supabase\.co\/?\z') { throw "Invalid VITE_SUPABASE_URL format." }
                if ($k -eq 'VITE_SUPABASE_ANON_KEY' -and (-not ($v.StartsWith("sb_publishable_") -or ($v -match '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$')))) { throw "Invalid VITE_SUPABASE_ANON_KEY format." }
                $ViteEnvLines += "$k=$v"
            }
        }
        if ($ViteEnvLines.Count -gt 0) {
            [PathSecurity]::WriteFileHandleBound($BuildDir, ".env", ($ViteEnvLines -join "`r`n"), $TempDirCanonical)
        }
    }
    
    $PubDir = Join-Path $ProjectDir "public"; if (Test-Path -LiteralPath $PubDir) { Copy-SafeDirectory $PubDir (Join-Path $BuildDir "public") $ProjectDirCanonical $TempDirCanonical }

    $SafeEnv = @('PATH','PATHEXT','SYSTEMROOT','TEMP','TMP','USERNAME','USERPROFILE','HOMEPATH','LOCALAPPDATA','APPDATA','COMPUTERNAME','OS','PROCESSOR_ARCHITECTURE','PSMODULEPATH','COMSPEC')
    Get-ChildItem env: | Where-Object { $_.Name -like 'VITE_*' -or ($_.Name -match '(?i)(TOKEN|SECRET|KEY|PASSWORD|CREDENTIAL|SESSION|AUTH)' -and $_.Name -notin $SafeEnv) } | ForEach-Object {
        $PreservedEnvVars[$_.Name] = $_.Value; Remove-Item -LiteralPath "env:$($_.Name)" -Force -ErrorAction SilentlyContinue
    }

    Write-Host "2. Installing dependencies..." -ForegroundColor Cyan
    Set-Location $BuildDir; & $NpmCmd ci --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed ($LASTEXITCODE)" }

    Write-Host "3. Compiling..." -ForegroundColor Cyan
    & $NpmCmd run build; if ($LASTEXITCODE -ne 0) { throw "npm run build failed ($LASTEXITCODE)" }

    $CompiledDist = Join-Path $BuildDir "dist"
    if (-not (Test-Path -LiteralPath (Join-Path $CompiledDist "index.html"))) { throw "index.html not found in $CompiledDist" }

    Write-Host "4. Scanning artifacts..." -ForegroundColor Cyan
    Assert-SecretScan $CompiledDist
    Write-Host "Bundle secret scan passed." -ForegroundColor Green

    Set-Location $OriginalLocation

    Write-Host "5. Publishing distribution..." -ForegroundColor Cyan
    Copy-SafeDirectory $CompiledDist $TargetDist $TempDirCanonical $ProjectDirCanonical -Prune
    Assert-SecretScan $TargetDist
    if (-not (Test-Path -LiteralPath (Join-Path $TargetDist "index.html"))) { throw ("index.html not found in " + $TargetDist) }
    $BuildSucceeded = $true
} catch {
    Set-Location $OriginalLocation
    Write-Host "BUILD ERROR: $_" -ForegroundColor Red
    $BuildSucceeded = $false
} finally {
    Set-Location $OriginalLocation
    Write-Host "6. Cleaning up..." -ForegroundColor Cyan
    try { if ($BuildDir -and (Test-Path -LiteralPath $BuildDir)) { Remove-SafeFolder $BuildDir $TempDirCanonical @("wine-tasting-build-$ProjectHash-") } } catch { }
    try { if ($LockFile) { $LockFile.Close(); $LockFile.Dispose() } } catch { }
    try { if ($PreservedEnvVars) { foreach ($e in $PreservedEnvVars.GetEnumerator()) { Set-Item -LiteralPath "env:$($e.Key)" -Value $e.Value -ErrorAction SilentlyContinue } } } catch { }
}

if ($BuildSucceeded) {
    Write-Host "SUCCESS: Build complete! Output: $TargetDist" -ForegroundColor Green
    exit 0
} else {
    Write-Host "BUILD FAILED: See error log above." -ForegroundColor Red
    exit 1
}
