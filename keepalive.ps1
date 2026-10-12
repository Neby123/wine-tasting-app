# ============================================================================
# SUPABASE IMMEDIATE KEEPALIVE PING SCRIPT
# Project: wine-tasting (rprjfaxsmwdzqwzycujh)
# ============================================================================

[CmdletBinding()]
param()

$ProjectRef = "rprjfaxsmwdzqwzycujh"
$Url = "https://$ProjectRef.supabase.co/rest/v1/sessions?select=id&limit=1"

Write-Host "Pinging Supabase database REST endpoint ($ProjectRef)..." -ForegroundColor Cyan

$curlExe = Get-Command curl.exe -ErrorAction SilentlyContinue
if (-not $curlExe) {
    Write-Host "Error: curl.exe not found on system." -ForegroundColor Red
    exit 1
}

$httpCode = & $curlExe.Source -s -o NUL -w "%{http_code}" --retry 2 --max-time 15 $Url
$curlExitCode = $LASTEXITCODE

if ($curlExitCode -ne 0) {
    Write-Host "Network Error: curl exited with code $curlExitCode. Host could not be reached or resolved." -ForegroundColor Red
    exit $curlExitCode
}

Write-Host "Supabase API Response Status Code: $httpCode" -ForegroundColor Yellow

if ($httpCode -ge 200 -and $httpCode -lt 300) {
    Write-Host "SUCCESS: Database query confirmed (HTTP $httpCode). Project activity timer reset." -ForegroundColor Green
    exit 0
} elseif ($httpCode -eq "401") {
    Write-Host "GATEWAY ACTIVE: REST gateway responded (HTTP 401 Unauthorized - expected without API key)." -ForegroundColor Yellow
    Write-Host "Inbound network traffic recorded by Supabase gateway. To execute an authenticated database query, pass your anon key in app settings." -ForegroundColor Gray
    exit 0
} else {
    Write-Host "ERROR: Received unexpected HTTP status code $httpCode" -ForegroundColor Red
    exit 1
}
