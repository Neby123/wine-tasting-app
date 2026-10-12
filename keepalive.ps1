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
        # Validate format: prevent curl config injection with strict \A...\z anchors (rejects trailing newlines)
        if ($ApiKey -notmatch '\A[A-Za-z0-9._-]+\z') {
            Write-Host "SECURITY ERROR: ApiKey contains invalid characters or newlines. Must be a valid alphanumeric token." -ForegroundColor Red
            exit 1
        }

        # Guard against newer sb_secret_ format or high-privilege keywords
        if ($ApiKey -match '(?i)(sb_secret_|service_role|master_key)') {
            Write-Host "SECURITY ERROR: High-privilege secret key pattern detected. Refusing to execute keepalive with administrative key. Provide anon key only." -ForegroundColor Red
            exit 1
        }

        # Guard against legacy JWT service_role keys
        $TokenParts = $ApiKey.Split('.')
        if ($TokenParts.Length -ge 2) {
            try {
                $Base64Payload = $TokenParts[1].Replace('-', '+').Replace('_', '/')
                switch ($Base64Payload.Length % 4) {
                    2 { $Base64Payload += "==" }
                    3 { $Base64Payload += "=" }
                }
                $PayloadBytes = [System.Convert]::FromBase64String($Base64Payload)
                $PayloadJson = [System.Text.Encoding]::UTF8.GetString($PayloadBytes)
                if ($PayloadJson -match '"role"\s*:\s*"service_role"') {
                    Write-Host "SECURITY ERROR: service_role JWT claim detected. Refusing to execute keepalive with administrative key. Provide anon key only." -ForegroundColor Red
                    exit 1
                }
            } catch {
                # Non-standard JWT formatting; continue
            }
        }

        Write-Host "Pinging Supabase database with authentication ($ProjectRef)..." -ForegroundColor Cyan
        $Url = "https://$ProjectRef.supabase.co/rest/v1/sessions?select=id&limit=1"
        
        # Create short-lived config file with owner-only ACL to protect secret material
        $TempConfigFile = Join-Path $env:TEMP ("curl_keepalive_" + [guid]::NewGuid().ToString("N") + ".cfg")
        $FileStream = [System.IO.File]::Create($TempConfigFile)
        $FileStream.Close()

        $CurrentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        $FileAcl = New-Object System.Security.AccessControl.FileSecurity
        $OwnerRule = New-Object System.Security.AccessControl.FileSystemAccessRule($CurrentUser, "FullControl", "Allow")
        $FileAcl.SetAccessRuleProtection($true, $false) # Strip inherited permissions
        $FileAcl.SetAccessRule($OwnerRule)
        (Get-Item -LiteralPath $TempConfigFile).SetAccessControl($FileAcl)

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

    $statusCode = 0
    if (-not [int]::TryParse($httpCode, [ref]$statusCode)) {
        Write-Host "ERROR: Non-numeric HTTP response received: $httpCode" -ForegroundColor Red
        exit 1
    }

    if ($statusCode -ge 200 -and $statusCode -lt 300) {
        if ($ApiKey) {
            Write-Host "SUCCESS: Authenticated database query confirmed (HTTP $statusCode). Project activity timer reset." -ForegroundColor Green
        } else {
            Write-Host "SUCCESS: Gateway ping confirmed (HTTP $statusCode)." -ForegroundColor Green
        }
        exit 0
    } elseif ($statusCode -eq 401) {
        if ($ApiKey) {
            Write-Host "ERROR: API key was provided but rejected by gateway (HTTP 401 Unauthorized). Verify key permissions." -ForegroundColor Red
            exit 1
        } else {
            Write-Host "GATEWAY ACTIVE: REST gateway responded (HTTP 401 Unauthorized)." -ForegroundColor Yellow
            Write-Host "Inbound network traffic recorded by Supabase gateway. Pass -ApiKey or set VITE_SUPABASE_ANON_KEY to perform an authenticated database query." -ForegroundColor Gray
            exit 2
        }
    } else {
        Write-Host "ERROR: Received unexpected HTTP status code $statusCode" -ForegroundColor Red
        exit 1
    }
} finally {
    if ($TempConfigFile -and (Test-Path -LiteralPath $TempConfigFile)) {
        try {
            # Zero out secret content before deletion
            [System.IO.File]::WriteAllBytes($TempConfigFile, [byte[]]::new(256))
        } catch { }
        Remove-Item -LiteralPath $TempConfigFile -Force -ErrorAction SilentlyContinue
    }
}
