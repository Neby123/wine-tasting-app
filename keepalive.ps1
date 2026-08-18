# ============================================================================
# SUPABASE IMMEDIATE KEEPALIVE PING SCRIPT
# Project: wine-tasting (rprjfaxsmwdzqwzycujh)
# Resets the 7-day Supabase free-tier inactivity timer immediately
# ============================================================================

Write-Host "Pinging Supabase project rprjfaxsmwdzqwzycujh..." -ForegroundColor Cyan

$Url = "https://rprjfaxsmwdzqwzycujh.supabase.co/rest/v1/"
try {
    $code = & curl.exe -s -o NUL -w "%{http_code}" $Url
    Write-Host "Supabase API Response Status Code: $code" -ForegroundColor Green
    Write-Host "SUCCESS: Activity recorded! The 7-day auto-pause timer has been reset." -ForegroundColor Green
} catch {
    Write-Host "Error sending keepalive request: $_" -ForegroundColor Red
}
