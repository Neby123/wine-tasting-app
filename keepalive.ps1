# ============================================================================
# SUPABASE IMMEDIATE KEEPALIVE PING SCRIPT
# Project: wine-tasting (rprjfaxsmwdzqwzycujh)
# ============================================================================

Write-Host "Pinging Supabase database REST endpoint..." -ForegroundColor Cyan

$Url = "https://rprjfaxsmwdzqwzycujh.supabase.co/rest/v1/sessions?select=id&limit=1"
try {
    $code = & curl.exe -s -o NUL -w "%{http_code}" $Url
    Write-Host "Supabase API Response Status Code: $code" -ForegroundColor Green
    Write-Host "Keepalive request sent! Open your app to log full database activity." -ForegroundColor Green
} catch {
    Write-Host "Error sending keepalive request: $_" -ForegroundColor Red
}
