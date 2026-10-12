# ============================================================================
# SUPABASE IMMEDIATE KEEPALIVE PING SCRIPT
# Project: wine-tasting (rprjfaxsmwdzqwzycujh)
# ============================================================================

[CmdletBinding()]
param(
    [string]$ApiKey = $env:VITE_SUPABASE_ANON_KEY
)

$ProjectRef = "rprjfaxsmwdzqwzycujh"
$curlExe = Get-Command curl.exe -ErrorAction SilentlyContinue
if (-not $curlExe) {
    Write-Host "Error: curl.exe not found on system." -ForegroundColor Red
    exit 1
}

$TempConfigFile = $null

try {
    $curlArgs = @("-s", "-o", "NUL", "-w", "%{http_code}", "--retry", "2", "--max-time", "15")

    if ($ApiKey) {
        Write-Host "Pinging Supabase database with authentication ($ProjectRef)..." -ForegroundColor Cyan
        $Url = "https://$ProjectRef.supabase.co/rest/v1/sessions?select=id&limit=1"
        
        # Write headers to a short-lived config file to prevent passing API keys in process argv
        $TempConfigFile = Join-Path $env:TEMP ("curl_keepalive_" + [guid]::NewGuid().ToString("N") + ".cfg")
        $ConfigLines = @(
            "header = ""apikey: $ApiKey"""
            "header = ""Authorization: Bearer $ApiKey"""
        )
        [System.IO.File]::WriteAllLines($TempConfigFile, $ConfigLines)
        $curlArgs += @("-K", $TempConfigFile)
    } else {
        Write-Host "Pinging Supabase REST gateway ($ProjectRef)..." -ForegroundColor Cyan
        $Url = "https://$ProjectRef.supabase.co/rest/v1/"
    }
    $curlArgs += $Url

    $httpCode = & $curlExe.Source $curlArgs
    $curlExitCode = $LASTEXITCODE

    if ($curlExitCode -ne 0) {
        if ($curlExitCode -eq 6) {
            Write-Host "Network Error: Could not resolve host ($ProjectRef.supabase.co). The Supabase project is likely paused in the dashboard." -ForegroundColor Red
        } else {
            Write-Host "Network Error: curl exited with code $curlExitCode. Host could not be reached." -ForegroundColor Red
        }
        exit $curlExitCode
    }

    Write-Host "Supabase API Response Status Code: $httpCode" -ForegroundColor Yellow

    if ($httpCode -ge 200 -and $httpCode -lt 300) {
        Write-Host "SUCCESS: Database query confirmed (HTTP $httpCode). Project activity timer reset." -ForegroundColor Green
        exit 0
    } elseif ($httpCode -eq "401") {
        if ($ApiKey) {
            Write-Host "ERROR: API key was provided but rejected by gateway (HTTP 401 Unauthorized). Verify key permissions." -ForegroundColor Red
            exit 1
        } else {
            Write-Host "GATEWAY ACTIVE: REST gateway responded (HTTP 401 Unauthorized)." -ForegroundColor Yellow
            Write-Host "Inbound network traffic recorded by Supabase gateway. Pass -ApiKey or set VITE_SUPABASE_ANON_KEY to perform an authenticated database query." -ForegroundColor Gray
            exit 2
        }
    } else {
        Write-Host "ERROR: Received unexpected HTTP status code $httpCode" -ForegroundColor Red
        exit 1
    }
} finally {
    if ($TempConfigFile -and (Test-Path $TempConfigFile)) {
        Remove-Item -Path $TempConfigFile -Force -ErrorAction SilentlyContinue
    }
}
