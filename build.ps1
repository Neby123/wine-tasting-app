# build.ps1 - Compiles the app using an isolated local temp directory to bypass Google Drive sync locks
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$ProjectDir = $PSScriptRoot
if (-not $ProjectDir) { $ProjectDir = (Get-Location).Path }
$ProjectDirCanonical = [System.IO.Path]::GetFullPath($ProjectDir).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar

# Local lockfile in TEMP derived from project path hash (prevents Google Drive cloud sync locks)
$ProjectBytes = [System.Text.Encoding]::UTF8.GetBytes($ProjectDir.ToLowerInvariant())
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

# Safe folder deletion helper: enforces strict project root containment and guards against following reparse points (symlinks/junctions)
function Remove-SafeStagingFolder([string]$FolderPath) {
    if (-not (Test-Path -LiteralPath $FolderPath)) { return }
    $CanonicalPath = [System.IO.Path]::GetFullPath($FolderPath)
    if (-not $CanonicalPath.StartsWith($ProjectDirCanonical, [System.StringComparison]::OrdinalIgnoreCase)) {
        Write-Warning "Refusing to delete path outside project root: $CanonicalPath"
        return
    }

    $TopItem = Get-Item -LiteralPath $CanonicalPath -Force -ErrorAction SilentlyContinue
    if (-not $TopItem) { return }

    # If top item is a reparse point (junction/symlink), remove the link only without recursing into target
    if (($TopItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        Write-Warning "Reparse point detected on $CanonicalPath. Safely removing link without traversing contents..."
        cmd /c rmdir "$CanonicalPath" 2>&1 | Out-Null
        return
    }

    # Inspect tree for any nested reparse points
    $ChildReparse = Get-ChildItem -LiteralPath $CanonicalPath -Recurse -Force -ErrorAction SilentlyContinue | Where-Object {
        ($_.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
    }
    if ($ChildReparse) {
        Write-Warning "Nested reparse point detected in $CanonicalPath. Refusing to remove folder to prevent traversal."
        return
    }

    # Delete via native cmd rmdir which does not follow symlinks/junctions
    cmd /c rmdir /s /q "$CanonicalPath" 2>&1 | Out-Null
    if (Test-Path -LiteralPath $CanonicalPath) {
        throw "Failed to safely remove staging folder: $CanonicalPath"
    }
}

# Outer try/catch/finally guarantees lock disposal and proper error propagation
try {
    # Startup sweep: Clean stale temporary build folders in TEMP belonging strictly to this project hash (older than 1 hour)
    Get-ChildItem -LiteralPath $env:TEMP -Filter "wine-tasting-build-$ProjectHash-*" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.LastWriteTime -lt (Get-Date).AddHours(-1)) {
            $TempFolder = $_.FullName
            $Item = Get-Item -LiteralPath $TempFolder -Force -ErrorAction SilentlyContinue
            if ($Item -and (($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0)) {
                cmd /c rmdir /s /q "$TempFolder" 2>&1 | Out-Null
            }
        }
    }

    # Startup sweep: Clean or recover any orphaned staging/backup folders from previous interrupted runs
    $StaleBackups = Get-ChildItem -LiteralPath $ProjectDir -Filter "dist_backup_*" -Directory -ErrorAction SilentlyContinue
    if ((-not (Test-Path $TargetDist)) -and $StaleBackups) {
        $MostRecentBackup = $StaleBackups | Sort-Object Name -Descending | Select-Object -First 1
        if ($MostRecentBackup -and (($MostRecentBackup.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0)) {
            Write-Host "Recovering orphaned distribution backup from interrupted previous run ($($MostRecentBackup.Name))..." -ForegroundColor Yellow
            Rename-Item -LiteralPath $MostRecentBackup.FullName -NewName (Split-Path $TargetDist -Leaf) -Force
        }
    }

    Get-ChildItem -LiteralPath $ProjectDir -Filter "dist_staging_*" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-SafeStagingFolder $_.FullName
    }
    Get-ChildItem -LiteralPath $ProjectDir -Filter "dist_backup_*" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        Remove-SafeStagingFolder $_.FullName
    }

    # Generate unique isolated temporary build directory scoped to this project hash
    $BuildDir = Join-Path $env:TEMP "wine-tasting-build-$ProjectHash-$BuildGuid"

    # Locate Node/npm strictly from system PATH (reject execution of unverified binaries from synced cloud directories)
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
    if (-not (Test-Path $ProjectLockFile)) {
        throw "package-lock.json is required for deterministic and secure builds. Run 'npm install' to generate a verified lockfile before building."
    }
    Copy-Item -Path $ProjectLockFile -Destination (Join-Path $BuildDir "package-lock.json") -Force

    # Copy ONLY frontend public VITE_* environment variables into the isolated build folder
    $LocalEnv = Join-Path $ProjectDir ".env"
    if (Test-Path $LocalEnv) {
        $ViteEnvLines = @()
        Get-Content -LiteralPath $LocalEnv | ForEach-Object {
            $Line = $_.Trim()
            if ($Line -match '^VITE_') {
                # Reject sensitive credential patterns from being bundled into client assets
                if ($Line -match '(?i)(service_role|secret|sb_secret_|private|password|master)') {
                    throw "Security violation in .env: Sensitive keyword detected in frontend variable: $Line. High-privilege secrets must never be exposed via VITE_* variables."
                }
                # Check for JWT with service_role claim
                if ($Line -match '(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)') {
                    $Token = $Matches[1]
                    $Parts = $Token.Split('.')
                    if ($Parts.Length -ge 2) {
                        try {
                            $B64 = $Parts[1].Replace('-', '+').Replace('_', '/')
                            switch ($B64.Length % 4) { 2 { $B64 += "==" } 3 { $B64 += "=" } }
                            $Payload = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($B64))
                            if ($Payload -match '"role"\s*:\s*"service_role"') {
                                throw "Security violation in .env: Service role JWT detected in VITE_* variable: $Line"
                            }
                        } catch { }
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
    if (-not (Test-Path $CompiledIndex)) {
        throw "Verification failed: Compiled output index.html not found in $CompiledDist"
    }

    Set-Location $OriginalLocation

    Write-Host "5. Publishing verified distribution..." -ForegroundColor Cyan
    Copy-Item -Path $CompiledDist -Destination $StagingDist -Recurse -Force

    # Swap distribution directory
    if (Test-Path $TargetDist) {
        Rename-Item -Path $TargetDist -NewName (Split-Path $BackupDist -Leaf) -Force
    }
    Rename-Item -Path $StagingDist -NewName (Split-Path $TargetDist -Leaf) -Force

    # Remove backup once publish has verified
    if (Test-Path $BackupDist) {
        Remove-SafeStagingFolder $BackupDist
    }

    $BuildSucceeded = $true
} catch {
    Set-Location $OriginalLocation
    Write-Host "BUILD ERROR: $_" -ForegroundColor Red
    $BuildSucceeded = $false
} finally {
    Set-Location $OriginalLocation
    Write-Host "6. Cleaning up temporary build artifacts..." -ForegroundColor Cyan
    if ($BuildDir -and (Test-Path $BuildDir)) {
        cmd /c rmdir /s /q "$BuildDir" 2>&1 | Out-Null
    }

    # If build failed before clean completion, roll back from backup if target is missing
    if (-not $BuildSucceeded) {
        if (Test-Path $StagingDist) {
            Remove-SafeStagingFolder $StagingDist
        }
        if ((Test-Path $BackupDist) -and (-not (Test-Path $TargetDist))) {
            Rename-Item -Path $BackupDist -NewName (Split-Path $TargetDist -Leaf) -Force
        }
    }

    # Release file lock (OS cleans up the file handle)
    if ($LockFile) {
        $LockFile.Close()
        $LockFile.Dispose()
    }
    if (Test-Path $LockFilePath) {
        Remove-Item -Path $LockFilePath -Force -ErrorAction SilentlyContinue
    }
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
