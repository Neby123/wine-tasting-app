# ============================================================================
# SUPABASE IMMEDIATE KEEPALIVE PING SCRIPT
# Project: wine-tasting (rprjfaxsmwdzqwzycujh)
# ============================================================================

[CmdletBinding()]
param(
    [switch]$GatewayOnly
)

$ProjectRef = "rprjfaxsmwdzqwzycujh"
$curlExe = Get-Command curl.exe -ErrorAction SilentlyContinue
if (-not $curlExe) {
    Write-Host "Error: curl.exe not found on system." -ForegroundColor Red
    exit 1
}

# Credential ingestion strictly via environment variable (prevents CLI argument/PSReadLine history exposure)
$ApiKey = $null
if (-not $GatewayOnly) {
    $ApiKey = $env:VITE_SUPABASE_ANON_KEY
    if (-not $ApiKey) {
        Write-Host "Notice: VITE_SUPABASE_ANON_KEY is not set in environment. Running unauthenticated REST gateway keepalive." -ForegroundColor Yellow
        Write-Host "To execute an authenticated database query and reset project inactivity timer, set `$env:VITE_SUPABASE_ANON_KEY." -ForegroundColor Gray
    }
}

if ($ApiKey) {
    # Validate format: prevent curl config injection with strict \A...\z anchors (rejects trailing newlines)
    if ($ApiKey -notmatch '\A[A-Za-z0-9._-]+\z') {
        Write-Host "SECURITY ERROR: VITE_SUPABASE_ANON_KEY contains invalid characters or newlines. Must be a valid alphanumeric token." -ForegroundColor Red
        exit 1
    }

    # Guard against newer sb_secret_ format or high-privilege keywords
    if ($ApiKey -match '(?i)(sb_secret_|service_role|master_key)') {
        Write-Host "SECURITY ERROR: High-privilege secret key pattern detected. Refusing to execute keepalive with administrative key. Provide anon key only." -ForegroundColor Red
        exit 1
    }

    # Guard against non-anon keys: allow only publishable keys or JWTs with verified anon role claim.
    # NOTE: Client-side role inspection is defense-in-depth input validation to prevent accidental administrative key usage,
    # not an authorization boundary (which is enforced server-side via Supabase RLS and JWT signature verification).
    if ($ApiKey.StartsWith("sb_publishable_")) {
        # Modern Supabase publishable key format
    } else {
        $TokenParts = $ApiKey.Split('.')
        if ($TokenParts.Length -lt 2) {
            Write-Host "SECURITY ERROR: VITE_SUPABASE_ANON_KEY must be a valid JWT or publishable token." -ForegroundColor Red
            exit 1
        }

        $IsAnonRole = $false
        try {
            $Base64Payload = $TokenParts[1].Replace('-', '+').Replace('_', '/')
            switch ($Base64Payload.Length % 4) {
                2 { $Base64Payload += "==" }
                3 { $Base64Payload += "=" }
            }
            $PayloadBytes = [System.Convert]::FromBase64String($Base64Payload)
            $PayloadJson = [System.Text.Encoding]::UTF8.GetString($PayloadBytes)
            $PayloadObj = $PayloadJson | ConvertFrom-Json
            if ($PayloadObj.role -eq 'anon') {
                $IsAnonRole = $true
            }
        } catch {
            Write-Host "SECURITY ERROR: Malformed JWT token payload. Cannot verify role claim." -ForegroundColor Red
            exit 1
        }
        if (-not $IsAnonRole) {
            Write-Host "SECURITY ERROR: Token does not contain an anon role claim. Refusing to execute." -ForegroundColor Red
            exit 1
        }
    }
}

# Helper function to invoke curl with streamed configuration over anonymous in-memory pipe (-K -)
# The secret is never written to disk or exposed in command-line arguments.
function Invoke-CurlPing {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,
        [string]$Method = "GET",
        [string]$Body = $null,
        [hashtable]$Headers = @{},
        [string]$Key = $null
    )

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $curlExe.Source
    $argsList = "-s -o NUL -w `"%{http_code}`" --retry 2 --max-time 15"
    if ($Method -ne "GET") {
        $argsList += " -X $Method"
    }
    if ($Body) {
        $argsList += " -d `"$Body`""
    }
    $argsList += " -K - `"$Url`""
    $psi.Arguments = $argsList
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    # Prefer native ProcessStartInfo.StandardInputEncoding when supported (.NET Core / PowerShell 7+).
    # On Windows PowerShell 5.1 (.NET Framework), attempt scoped [Console]::InputEncoding adjustment if a console handle exists.
    $hasInputEncodingProp = [bool]($psi.PSObject.Properties['StandardInputEncoding'])
    $proc = $null
    if ($hasInputEncodingProp) {
        $psi.StandardInputEncoding = [System.Text.Encoding]::ASCII
        $proc = [System.Diagnostics.Process]::Start($psi)
    } else {
        $prevEncoding = $null
        try {
            $prevEncoding = [Console]::InputEncoding
            [Console]::InputEncoding = [System.Text.Encoding]::ASCII
        } catch { }

        try {
            $proc = [System.Diagnostics.Process]::Start($psi)
        } finally {
            if ($prevEncoding) {
                try { [Console]::InputEncoding = $prevEncoding } catch { }
            }
        }
    }

    try {
        if ($Key) {
            $proc.StandardInput.Write("header = `"apikey: $Key`"`n")
            # Publishable keys ('sb_publishable_') use apikey header only; legacy anon JWT tokens require Bearer authorization header
            if (-not $Key.StartsWith("sb_publishable_")) {
                $proc.StandardInput.Write("header = `"Authorization: Bearer $Key`"`n")
            }
        }
        foreach ($hName in $Headers.Keys) {
            $hVal = $Headers[$hName]
            $proc.StandardInput.Write("header = `"$($hName): $hVal`"`n")
        }
        $proc.StandardInput.Close()

        # Drain stdout and stderr asynchronously in parallel to prevent pipe buffer deadlocks
        $stdoutTask = $proc.StandardOutput.ReadToEndAsync()
        $stderrTask = $proc.StandardError.ReadToEndAsync()
        [System.Threading.Tasks.Task]::WaitAll($stdoutTask, $stderrTask)
        $proc.WaitForExit()

        return [PSCustomObject]@{
            ExitCode = $proc.ExitCode
            HttpCode = $stdoutTask.Result.Trim()
            Error    = $stderrTask.Result.Trim()
        }
    } finally {
        if ($proc) {
            $proc.Dispose()
        }
    }
}

if ($ApiKey) {
    Write-Host "Authenticated mode: Executing comprehensive database activity burst ($ProjectRef)..." -ForegroundColor Cyan
    $targets = @(
        @{
            Label   = "sessions table"
            Url     = "https://$ProjectRef.supabase.co/rest/v1/sessions?select=id&limit=1"
            Method  = "GET"
            Body    = $null
            Headers = @{ 'Prefer' = 'count=exact'; 'Cache-Control' = 'no-cache' }
        },
        @{
            Label   = "wines table"
            Url     = "https://$ProjectRef.supabase.co/rest/v1/wines?select=id&limit=1"
            Method  = "GET"
            Body    = $null
            Headers = @{ 'Prefer' = 'count=exact'; 'Cache-Control' = 'no-cache' }
        },
        @{
            Label   = "history table"
            Url     = "https://$ProjectRef.supabase.co/rest/v1/history?select=id&limit=1"
            Method  = "GET"
            Body    = $null
            Headers = @{ 'Prefer' = 'count=exact'; 'Cache-Control' = 'no-cache' }
        },
        @{
            Label   = "rpc/check_is_host"
            Url     = "https://$ProjectRef.supabase.co/rest/v1/rpc/check_is_host"
            Method  = "POST"
            Body    = "{}"
            Headers = @{ 'Content-Type' = 'application/json'; 'Cache-Control' = 'no-cache' }
        }
    )

    foreach ($target in $targets) {
        Write-Host "Executing keepalive request: $($target.Label) ($($target.Method))..." -ForegroundColor Cyan
        $res = Invoke-CurlPing -Url $target.Url -Method $target.Method -Body $target.Body -Headers $target.Headers -Key $ApiKey

        if ($res.ExitCode -ne 0) {
            if ($res.ExitCode -eq 6) {
                Write-Host "Network Error: Could not resolve host ($ProjectRef.supabase.co). The Supabase project is likely paused in the dashboard." -ForegroundColor Red
            } else {
                Write-Host "Network Error: curl exited with code $($res.ExitCode). Host could not be reached. Error: $($res.Error)" -ForegroundColor Red
            }
            exit $res.ExitCode
        }

        Write-Host "Supabase API Response Status Code: $($res.HttpCode)" -ForegroundColor Yellow
        $statusCode = 0
        if (-not [int]::TryParse($res.HttpCode, [ref]$statusCode)) {
            Write-Host "ERROR: Non-numeric HTTP response received: $($res.HttpCode)" -ForegroundColor Red
            exit 1
        }

        if ($statusCode -ge 200 -and $statusCode -lt 300) {
            Write-Host "SUCCESS: $($target.Label) confirmed (HTTP $statusCode)." -ForegroundColor Green
        } elseif ($statusCode -eq 401) {
            Write-Host "ERROR: API key was provided but rejected by gateway (HTTP 401 Unauthorized) on $($target.Label). Verify key permissions." -ForegroundColor Red
            exit 1
        } else {
            Write-Host "ERROR: Received unexpected HTTP status code $statusCode on $($target.Label)" -ForegroundColor Red
            exit 1
        }
    }

    Write-Host "SUCCESS: All authenticated database queries and RPC calls confirmed! Project activity timer reset." -ForegroundColor Green
    exit 0
} else {
    Write-Host "Pinging Supabase REST gateway ($ProjectRef)..." -ForegroundColor Cyan
    $Url = "https://$ProjectRef.supabase.co/rest/v1/"
    $res = Invoke-CurlPing -Url $Url -Method "GET" -Headers @{ 'Cache-Control' = 'no-cache' } -Key $null

    if ($res.ExitCode -ne 0) {
        if ($res.ExitCode -eq 6) {
            Write-Host "Network Error: Could not resolve host ($ProjectRef.supabase.co). The Supabase project is likely paused in the dashboard." -ForegroundColor Red
        } else {
            Write-Host "Network Error: curl exited with code $($res.ExitCode). Host could not be reached. Error: $($res.Error)" -ForegroundColor Red
        }
        exit $res.ExitCode
    }

    Write-Host "Supabase API Response Status Code: $($res.HttpCode)" -ForegroundColor Yellow
    $statusCode = 0
    if (-not [int]::TryParse($res.HttpCode, [ref]$statusCode)) {
        Write-Host "ERROR: Non-numeric HTTP response received: $($res.HttpCode)" -ForegroundColor Red
        exit 1
    }

    if ($statusCode -ge 200 -and $statusCode -lt 300) {
        Write-Host "SUCCESS: Gateway ping confirmed (HTTP $statusCode)." -ForegroundColor Green
        exit 0
    } elseif ($statusCode -eq 401) {
        Write-Host "GATEWAY ACTIVE: REST gateway responded (HTTP 401 Unauthorized)." -ForegroundColor Yellow
        Write-Host "Inbound network traffic recorded by Supabase gateway. Set `$env:VITE_SUPABASE_ANON_KEY to perform an authenticated database query." -ForegroundColor Gray
        exit 2
    } else {
        Write-Host "ERROR: Received unexpected HTTP status code $statusCode" -ForegroundColor Red
        exit 1
    }
}
