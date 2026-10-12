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

$curlArgs = @("-s", "-o", "NUL", "-w", "%{http_code}", "--retry", "2", "--max-time", "15")

if ($ApiKey) {
    Write-Host "Pinging Supabase database with authentication ($ProjectRef)..." -ForegroundColor Cyan
    $Url = "https://$ProjectRef.supabase.co/rest/v1/sessions?select=id&limit=1"
    $curlArgs += @("-H", "apikey: $ApiKey", "-H", "Authorization: Bearer $ApiKey")
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
    Write-Host "GATEWAY ACTIVE: REST gateway responded (HTTP 401 Unauthorized)." -ForegroundColor Yellow
    Write-Host "Inbound network traffic recorded by Supabase gateway. Pass -ApiKey or set VITE_SUPABASE_ANON_KEY to perform an authenticated database query." -ForegroundColor Gray
    exit 2
} else {
    Write-Host "ERROR: Received unexpected HTTP status code $httpCode" -ForegroundColor Red
    exit 1
}

