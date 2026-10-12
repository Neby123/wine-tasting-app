# build.ps1 - Compiles the app using an isolated local temp directory to bypass Google Drive sync locks
[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$ProjectDir = $PSScriptRoot
if (-not $ProjectDir) { $ProjectDir = (Get-Location).Path }

$LockFilePath = Join-Path $env:TEMP "wine_tasting_build.lock"
$LockFile = $null

try {
    $LockFile = [System.IO.File]::Open($LockFilePath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
} catch {
    Write-Host "Another build is currently in progress. Waiting for lock..." -ForegroundColor Yellow
    $Retries = 0
    while ($Retries -lt 30) {
        Start-Sleep -Seconds 2
        try {
            $LockFile = [System.IO.File]::Open($LockFilePath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
            break
        } catch {
            $Retries++
        }
    }
    if (-not $LockFile) {
        throw "Could not acquire build lock after 60 seconds. Aborting concurrent build."
    }
}

$OriginalLocation = Get-Location
$BuildSucceeded = $false
$BuildDir = $null

try {
    $TargetDist = Join-Path $ProjectDir "dist"

    Get-ChildItem -Path $ProjectDir -Filter "dist_staging_*" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path $ProjectDir -Filter "dist_backup_*" -Directory -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

    $BuildGuid = [guid]::NewGuid().ToString("N")
    $BuildDir = Join-Path $env:TEMP "wine-tasting-build-$BuildGuid"

    $NodePortable = Join-Path (Split-Path (Split-Path (Split-Path $ProjectDir -Parent) -Parent) -Parent) "node-portable"
    $NpmCmd = ""
    if (Test-Path (Join-Path $NodePortable "npm.cmd")) {
        $NpmCmd = Join-Path $NodePortable "npm.cmd"
        $NodeExe = Join-Path $NodePortable "node.exe"
        if (Test-Path $NodeExe) {
            $env:PATH = "$NodePortable;$env:PATH"
        }
    } else {
        $SystemNpm = Get-Command npm.cmd, npm -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($SystemNpm) {
            $NpmCmd = $SystemNpm.Source
        } else {
            throw "npm command could not be located in portable directory or system PATH."
        }
    }

    Write-Host "=========================================" -ForegroundColor Yellow
    Write-Host "   Wine Tasting Web App Compilation" -ForegroundColor Yellow
    Write-Host "=========================================" -ForegroundColor Yellow

    Write-Host "1. Creating isolated build folder at $BuildDir..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $BuildDir -Force | Out-Null

    Write-Host "2. Copying project files..." -ForegroundColor Cyan
    Copy-Item -Path (Join-Path $ProjectDir "src") -Destination (Join-Path $BuildDir "src") -Recurse -Force
    Copy-Item -Path (Join-Path $ProjectDir "package.json") -Destination (Join-Path $BuildDir "package.json") -Force
    
    $ProjectLockFile = Join-Path $ProjectDir "package-lock.json"
    $HasLockFile = Test-Path $ProjectLockFile
    if ($HasLockFile) {
        Copy-Item -Path $ProjectLockFile -Destination (Join-Path $BuildDir "package-lock.json") -Force
    }
    
    Copy-Item -Path (Join-Path $ProjectDir "vite.config.ts") -Destination (Join-Path $BuildDir "vite.config.ts") -Force
    Copy-Item -Path (Join-Path $ProjectDir "tsconfig.json") -Destination (Join-Path $BuildDir "tsconfig.json") -Force
    Copy-Item -Path (Join-Path $ProjectDir "postcss.config.js") -Destination (Join-Path $BuildDir "postcss.config.js") -Force
    Copy-Item -Path (Join-Path $ProjectDir "tailwind.config.js") -Destination (Join-Path $BuildDir "tailwind.config.js") -Force
    Copy-Item -Path (Join-Path $ProjectDir "index.html") -Destination (Join-Path $BuildDir "index.html") -Force

    Write-Host "3. Installing dependencies in local build folder..." -ForegroundColor Cyan
    Set-Location $BuildDir
    if ($HasLockFile) {
        & $NpmCmd ci --no-audit --no-fund
    } else {
        & $NpmCmd install --no-audit --no-fund
    }
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

    Write-Host "5. Updating distribution files in Google Drive in-place..." -ForegroundColor Cyan
    if (-not (Test-Path $TargetDist)) {
        New-Item -ItemType Directory -Path $TargetDist -Force | Out-Null
    }

    $RoboExe = Get-Command robocopy.exe, robocopy -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($RoboExe) {
        & $RoboExe.Source "$CompiledDist" "$TargetDist" /MIR /R:1 /W:1 /NP /NFL /NDL /NJH /NJS | Out-Null
        if ($LASTEXITCODE -ge 8) {
            throw "robocopy mirror failed with exit code $LASTEXITCODE"
        }
    } else {
        Copy-Item -Path "$CompiledDist\*" -Destination $TargetDist -Recurse -Force
    }

    $BuildSucceeded = $true
}
finally {
    Set-Location $OriginalLocation
    Write-Host "6. Cleaning up temporary build artifacts..." -ForegroundColor Cyan
    if ($BuildDir -and (Test-Path $BuildDir)) {
        Remove-Item $BuildDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    if ($LockFile) {
        $LockFile.Close()
        $LockFile.Dispose()
        Remove-Item $LockFilePath -Force -ErrorAction SilentlyContinue
    }
}

if ($BuildSucceeded) {
    Write-Host "-----------------------------------------" -ForegroundColor Green
    Write-Host "SUCCESS: Build complete! Verified distribution files in:" -ForegroundColor Green
    Write-Host (Join-Path $ProjectDir "dist") -ForegroundColor White
    Write-Host "=========================================" -ForegroundColor Green
} else {
    Write-Host "BUILD FAILED: See error log above." -ForegroundColor Red
    exit 1
}
