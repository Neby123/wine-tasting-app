# build.ps1 - Compiles the app using an isolated local temp directory to bypass Google Drive sync locks
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$ProjectDir = $PSScriptRoot
if (-not $ProjectDir) { $ProjectDir = (Get-Location).Path }
$ProjectDirCanonical = [System.IO.Path]::GetFullPath($ProjectDir).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
$TempDirCanonical = [System.IO.Path]::GetFullPath($env:TEMP).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar

# Local lockfile in TEMP derived from canonical project path hash (prevents Google Drive cloud sync locks)
$ProjectBytes = [System.Text.Encoding]::UTF8.GetBytes($ProjectDirCanonical.ToLowerInvariant())
$Hasher = [System.Security.Cryptography.SHA256]::Create()
$ProjectHash = [System.BitConverter]::ToString($Hasher.ComputeHash($ProjectBytes)).Replace("-", "").Substring(0, 16)
$LockFilePath = Join-Path $env:TEMP "wine_tasting_build_$ProjectHash.lock"
$LockFile = $null

try {
    $LockFile = [System.IO.File]::Open($LockFilePath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
} catch [System.IO.IOException] {
    Write-Host "Another build is in progress for this project. Waiting for lock..." -ForegroundColor Yellow
    $Retries = 0
    while ($Retries -lt 30) {
        Start-Sleep -Seconds 2
        try {
            $LockFile = [System.IO.File]::Open($LockFilePath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
            break
        } catch [System.IO.IOException] {
            $Retries++
        }
    }
    if (-not $LockFile) {
        throw "Could not acquire project build lock after 60 seconds. Aborting concurrent build."
    }
}

$OriginalLocation = Get-Location
$BuildSucceeded = $false
$BuildDir = $null
$BuildTimestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$BuildGuid = [guid]::NewGuid().ToString("N")
$StagingDist = Join-Path $ProjectDir "dist_staging_$BuildGuid"
$BackupDist = Join-Path $ProjectDir "dist_backup_$BuildTimestamp"
$TargetDist = Join-Path $ProjectDir "dist"

# Safe non-traversing folder deletion: uses explicit stack walk and unlinks reparse points without following them
function Remove-SafeStagingFolder([string]$FolderPath) {
    if (-not (Test-Path -LiteralPath $FolderPath)) { return }
    $CanonicalPath = [System.IO.Path]::GetFullPath($FolderPath)
    if (-not $CanonicalPath.StartsWith($ProjectDirCanonical, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Warning "Refusing to delete path outside project root: $CanonicalPath"
        return
    }

    $DirInfo = New-Object System.IO.DirectoryInfo($CanonicalPath)
    if (-not $DirInfo.Exists) { return }

    # If top item is a reparse point (junction/symlink), safely unlink without recursing into target
    if (($DirInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        Write-Warning "Reparse point detected on root $CanonicalPath. Safely deleting junction link..."
        $DirInfo.Delete($false)
        return
    }

    # Stack-based walk to detect and unlink reparse points before descending
    $Stack = New-Object System.Collections.Generic.Stack[System.IO.DirectoryInfo]
    $DirsToDelete = New-Object System.Collections.Generic.List[System.IO.DirectoryInfo]
    $Stack.Push($DirInfo)

    while ($Stack.Count -gt 0) {
        $Current = $Stack.Pop()
        $Current.Refresh()
        if (($Current.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            Write-Warning "Reparse point detected on ($($Current.FullName)). Safely unlinking without traversal..."
            $Current.Delete($false)
            continue
        }
        $DirsToDelete.Add($Current)

        foreach ($Sub in $Current.GetDirectories()) {
            $Sub.Refresh()
            if (($Sub.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                Write-Warning "Reparse point detected inside $CanonicalPath ($($Sub.FullName)). Safely unlinking without traversal..."
                $Sub.Delete($false)
            } else {
                $Stack.Push($Sub)
            }
        }
        foreach ($File in $Current.GetFiles()) {
            if ($File.IsReadOnly) { $File.IsReadOnly = $false }
            $File.Delete()
        }
    }

    # Delete unlinked directories from deepest child up to root
    for ($i = $DirsToDelete.Count - 1; $i -ge 0; $i--) {
        $DirsToDelete[$i].Delete($false)
    }
}

# Safe deletion for temporary build folders in TEMP with strict prefix containment
function Remove-SafeTempFolder([string]$FolderPath) {
    if (-not (Test-Path -LiteralPath $FolderPath)) { return }
    $CanonicalPath = [System.IO.Path]::GetFullPath($FolderPath)
    if (-not $CanonicalPath.StartsWith($TempDirCanonical, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Warning "Refusing to delete temp folder outside TEMP directory: $CanonicalPath"
        return
    }
    $LeafName = [System.IO.Path]::GetFileName($CanonicalPath)
    if (-not $LeafName.StartsWith("wine-tasting-build-$ProjectHash-", [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Warning "Refusing to delete folder not matching project build prefix: $CanonicalPath"
        return
    }

    $DirInfo = New-Object System.IO.DirectoryInfo($CanonicalPath)
    if (-not $DirInfo.Exists) { return }

    if (($DirInfo.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        $DirInfo.Delete($false)
        return
    }

    $Stack = New-Object System.Collections.Generic.Stack[System.IO.DirectoryInfo]
    $DirsToDelete = New-Object System.Collections.Generic.List[System.IO.DirectoryInfo]
    $Stack.Push($DirInfo)

    while ($Stack.Count -gt 0) {
        $Current = $Stack.Pop()
        $Current.Refresh()
        if (($Current.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
            $Current.Delete($false)
            continue
        }
        $DirsToDelete.Add($Current)

        foreach ($Sub in $Current.GetDirectories()) {
            $Sub.Refresh()
            if (($Sub.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
                $Sub.Delete($false)
            } else {
                $Stack.Push($Sub)
            }
        }
        foreach ($File in $Current.GetFiles()) {
            if ($File.IsReadOnly) { $File.IsReadOnly = $false }
            $File.Delete()
        }
    }

    for ($i = $DirsToDelete.Count - 1; $i -ge 0; $i--) {
        $DirsToDelete[$i].Delete($false)
    }
}

# Outer try/catch/finally guarantees lock disposal and proper error propagation
try {
    # Startup sweep: Clean stale temporary build folders in TEMP belonging strictly to this project hash (older than 1 hour)
    Get-ChildItem -LiteralPath $env:TEMP -Filter "wine-tasting-build-$ProjectHash-*" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.LastWriteTime -lt (Get-Date).AddHours(-1)) {
            try { Remove-SafeTempFolder $_.FullName } catch { }
        }
    }

    # Startup sweep: Clean or recover any orphaned staging/backup folders from previous interrupted runs
    $StaleBackups = Get-ChildItem -LiteralPath $ProjectDir -Filter "dist_backup_*" -Directory -ErrorAction SilentlyContinue
    if ((-not (Test-Path -LiteralPath $TargetDist)) -and $StaleBackups) {
        $MostRecentBackup = $StaleBackups | Sort-Object Name -Descending | Select-Object -First 1
        if ($MostRecentBackup -and (($MostRecentBackup.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0)) {
            Write-Host "Recovering orphaned distribution backup from interrupted previous run ($($MostRecentBackup.Name))..." -ForegroundColor Yellow
            Rename-Item -LiteralPath $MostRecentBackup.FullName -NewName ([System.IO.Path]::GetFileName($TargetDist)) -Force
        }
    }

    Get-ChildItem -LiteralPath $ProjectDir -Filter "dist_staging_*" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        try { Remove-SafeStagingFolder $_.FullName } catch { }
    }
    Get-ChildItem -LiteralPath $ProjectDir -Filter "dist_backup_*" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        try { Remove-SafeStagingFolder $_.FullName } catch { }
    }

    # Generate unique isolated temporary build directory scoped to this project hash
    $BuildDir = Join-Path $env:TEMP "wine-tasting-build-$ProjectHash-$BuildGuid"

    # Locate Node/npm strictly from system PATH
    $SystemNpm = Get-Command npm.cmd, npm -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $SystemNpm) {
        throw "npm command could not be located in system PATH. Install Node.js globally to compile this application."
    }
    $NpmCmd = $SystemNpm.Source

    Write-Host "=========================================" -ForegroundColor Yellow
    Write-Host "   Wine Tasting Web App Compilation" -ForegroundColor Yellow
    Write-Host "=========================================" -ForegroundColor Yellow

    Write-Host "1. Creating isolated build folder at $BuildDir..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null

    Write-Host "2. Copying project files..." -ForegroundColor Cyan
    Copy-Item -Path (Join-Path $ProjectDir "src") -Destination (Join-Path $BuildDir "src") -Recurse -Force
    Copy-Item -Path (Join-Path $ProjectDir "package.json") -Destination (Join-Path $BuildDir "package.json") -Force
    
    $ProjectLockFile = Join-Path $ProjectDir "package-lock.json"
    if (-not (Test-Path -LiteralPath $ProjectLockFile)) {
        throw "package-lock.json is required for deterministic and secure builds. Run 'npm install' to generate a verified lockfile before building."
    }
    Copy-Item -Path $ProjectLockFile -Destination (Join-Path $BuildDir "package-lock.json") -Force

    # Enforce strict allowlist for frontend public VITE_* environment variables
    $LocalEnv = Join-Path $ProjectDir ".env"
    if (Test-Path -LiteralPath $LocalEnv) {
        $AllowedFrontendVars = @('VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_APP_TITLE', 'VITE_APP_VERSION')
        $ViteEnvLines = @()
        Get-Content -LiteralPath $LocalEnv | ForEach-Object {
            $Line = $_.Trim()
            if ($Line -match '^VITE_') {
                $VarName = ($Line -split '=')[0].Trim()
                if ($VarName -notin $AllowedFrontendVars) {
                    throw "Security violation in .env: Unapproved frontend variable '$VarName'. Only explicitly permitted public frontend variables may be bundled."
                }
                # Inspect anon key value to ensure no elevated privileges are attached
                if ($VarName -eq 'VITE_SUPABASE_ANON_KEY') {
                    $VarValue = ($Line -split '=', 2)[1].Trim()
                    if ($VarValue -match '(?i)(sb_secret_|service_role|master_key)') {
                        throw "Security violation in .env: Sensitive key pattern detected in variable '$VarName'."
                    }
                    if ($VarValue.StartsWith("sb_publishable_")) {
                        # Modern Supabase publishable key format
                    } else {
                        $TokenParts = $VarValue.Split('.')
                        if ($TokenParts.Length -lt 2) {
                            throw "Security violation in .env: '$VarName' must be a valid JWT or publishable token."
                        }
                        $IsAnonRole = $false
                        try {
                            $B64 = $TokenParts[1].Replace('-', '+').Replace('_', '/')
                            switch ($B64.Length % 4) { 2 { $B64 += "==" } 3 { $B64 += "=" } }
                            $PayloadBytes = [System.Convert]::FromBase64String($B64)
                            $PayloadJson = [System.Text.Encoding]::UTF8.GetString($PayloadBytes)
                            $PayloadObj = $PayloadJson | ConvertFrom-Json
                            if ($PayloadObj.role -eq 'anon') {
                                $IsAnonRole = $true
                            }
                        } catch {
                            throw "Security violation in .env: Malformed JWT token in variable '$VarName'."
                        }
                        if (-not $IsAnonRole) {
                            throw "Security violation in .env: JWT token in variable '$VarName' does not contain an anon role claim."
                        }
                    }
                }
                $ViteEnvLines += $Line
            }
        }
        if ($ViteEnvLines.Count -gt 0) {
            $TargetEnv = Join-Path $BuildDir ".env"
            [System.IO.File]::WriteAllLines($TargetEnv, $ViteEnvLines)
        }
    }
    
    # Optional assets
    if (Test-Path -LiteralPath (Join-Path $ProjectDir "public")) {
        Copy-Item -Path (Join-Path $ProjectDir "public") -Destination (Join-Path $BuildDir "public") -Recurse -Force
    }
    if (Test-Path -LiteralPath (Join-Path $ProjectDir "tsconfig.node.json")) {
        Copy-Item -Path (Join-Path $ProjectDir "tsconfig.node.json") -Destination (Join-Path $BuildDir "tsconfig.node.json") -Force
    }

    Copy-Item -Path (Join-Path $ProjectDir "vite.config.ts") -Destination (Join-Path $BuildDir "vite.config.ts") -Force
    Copy-Item -Path (Join-Path $ProjectDir "tsconfig.json") -Destination (Join-Path $BuildDir "tsconfig.json") -Force
    Copy-Item -Path (Join-Path $ProjectDir "postcss.config.js") -Destination (Join-Path $BuildDir "postcss.config.js") -Force
    Copy-Item -Path (Join-Path $ProjectDir "tailwind.config.js") -Destination (Join-Path $BuildDir "tailwind.config.js") -Force
    Copy-Item -Path (Join-Path $ProjectDir "index.html") -Destination (Join-Path $BuildDir "index.html") -Force

    Write-Host "3. Installing dependencies in local build folder..." -ForegroundColor Cyan
    Set-Location $BuildDir
    # Install dependencies with --ignore-scripts to eliminate arbitrary lifecycle script execution
    & $NpmCmd ci --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) {
        throw "Dependency installation failed with exit code $LASTEXITCODE"
    }

    Write-Host "4. Compiling web application..." -ForegroundColor Cyan
    & $NpmCmd run build
    if ($LASTEXITCODE -ne 0) {
        throw "npm run build failed with exit code $LASTEXITCODE"
    }

    $CompiledDist = Join-Path $BuildDir "dist"
    $CompiledIndex = Join-Path $CompiledDist "index.html"
    if (-not (Test-Path -LiteralPath $CompiledIndex)) {
        throw "Verification failed: Compiled output index.html not found in $CompiledDist"
    }

    Set-Location $OriginalLocation

    Write-Host "5. Publishing verified distribution..." -ForegroundColor Cyan
    Copy-Item -Path $CompiledDist -Destination $StagingDist -Recurse -Force

    # Swap distribution directory: target is backed up, staging is renamed to target
    if (Test-Path -LiteralPath $TargetDist) {
        Rename-Item -LiteralPath $TargetDist -NewName ([System.IO.Path]::GetFileName($BackupDist)) -Force
    }
    Rename-Item -LiteralPath $StagingDist -NewName ([System.IO.Path]::GetFileName($TargetDist)) -Force

    # Output is now verified and active in target directory
    $BuildSucceeded = $true

    # Clean up backup folder without aborting successful build
    if (Test-Path -LiteralPath $BackupDist) {
        try {
            Remove-SafeStagingFolder $BackupDist
        } catch {
            Write-Warning "Could not immediately remove previous build backup ($BackupDist): $_"
        }
    }
} catch {
    Set-Location $OriginalLocation
    Write-Host "BUILD ERROR: $_" -ForegroundColor Red
    $BuildSucceeded = $false
} finally {
    Set-Location $OriginalLocation
    Write-Host "6. Cleaning up temporary build artifacts..." -ForegroundColor Cyan

    # Guarded cleanup: temporary build directory
    try {
        if ($BuildDir -and (Test-Path -LiteralPath $BuildDir)) {
            Remove-SafeTempFolder $BuildDir
        }
    } catch {
        Write-Warning "Could not delete temporary build directory ($BuildDir): $_"
    }

    # Guarded cleanup: rollback if build did not succeed
    try {
        if (-not $BuildSucceeded) {
            if (Test-Path -LiteralPath $StagingDist) {
                Remove-SafeStagingFolder $StagingDist
            }
            if ((Test-Path -LiteralPath $BackupDist) -and (-not (Test-Path -LiteralPath $TargetDist))) {
                Rename-Item -LiteralPath $BackupDist -NewName ([System.IO.Path]::GetFileName($TargetDist)) -Force
            }
        }
    } catch {
        Write-Warning "Error during build rollback: $_"
    }

    # Guarded cleanup: release and dispose build lock
    try {
        if ($LockFile) {
            $LockFile.Close()
            $LockFile.Dispose()
        }
    } catch {
        Write-Warning "Error disposing build lock: $_"
    }

    # Guarded cleanup: best-effort removal of project lock file
    try {
        if (Test-Path -LiteralPath $LockFilePath) {
            Remove-Item -LiteralPath $LockFilePath -Force -ErrorAction SilentlyContinue
        }
    } catch { }
}

if ($BuildSucceeded) {
    Write-Host "-----------------------------------------" -ForegroundColor Green
    Write-Host "SUCCESS: Build complete! Verified distribution files in:" -ForegroundColor Green
    Write-Host $TargetDist -ForegroundColor White
    Write-Host "=========================================" -ForegroundColor Green
    exit 0
} else {
    Write-Host "BUILD FAILED: See error log above." -ForegroundColor Red
    exit 1
}
