<#
.SYNOPSIS
  Launch MediaDL in local dev mode (hot-reload) with a dynamic, configurable port.

.DESCRIPTION
  Runs the Next.js frontend (`next dev`) and the Express backend (`tsx watch`) on the
  host, while MySQL / Redis / Kafka / python-service keep running in Docker. All URLs are
  derived from the chosen port, so nothing is hard-coded — handy when 3000/3001 are taken
  by other projects.

  Secrets are read from the repo-root .env via DOTENV_CONFIG_PATH (so you keep one source
  of truth). Only the host<->Docker connection vars are overridden to point at localhost,
  because the code otherwise defaults to Docker service names (mysql, redis) that don't
  resolve from the host.

.PARAMETER FrontendPort
  Port for the frontend. 0 (default) = auto-pick the first free port at/above -PortBase.

.PARAMETER BackendPort
  Port for the backend API. Default 4000.

.PARAMETER PortBase
  Where auto-discovery starts scanning when FrontendPort is 0. Default 3000.

.PARAMETER EnvFile
  Path to the env file with secrets. Default: the repo-root .env.

.EXAMPLE
  ./scripts/dev.ps1                       # auto port, backend 4000
  ./scripts/dev.ps1 -FrontendPort 3005    # pin the frontend to 3005
  ./scripts/dev.ps1 -BackendPort 4100     # move the backend too
#>
[CmdletBinding()]
param(
  [int]$FrontendPort = 0,
  [int]$BackendPort  = 4000,
  [int]$PortBase     = 3000,
  [string]$EnvFile
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot          # repo root (scripts/..)
if (-not $EnvFile) { $EnvFile = Join-Path $Root '.env' }

function Test-PortFree([int]$Port) {
  -not (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Find-FreePort([int]$Start) {
  for ($p = $Start; $p -lt ($Start + 200); $p++) { if (Test-PortFree $p) { return $p } }
  throw "No free port found in range $Start..$($Start + 200)"
}

# ── Resolve ports ─────────────────────────────────────────────────────────────
if ($FrontendPort -eq 0) {
  $FrontendPort = Find-FreePort $PortBase
  Write-Host "[dev] auto-selected free frontend port: $FrontendPort" -ForegroundColor Cyan
} elseif (-not (Test-PortFree $FrontendPort)) {
  $alt = Find-FreePort ($FrontendPort + 1)
  Write-Warning "[dev] port $FrontendPort is busy; using $alt instead"
  $FrontendPort = $alt
}
if (-not (Test-PortFree $BackendPort)) {
  throw "[dev] backend port $BackendPort is busy. Pass -BackendPort <free port>."
}

if (-not (Test-Path $EnvFile)) { throw "[dev] env file not found: $EnvFile" }

$SiteUrl = "http://localhost:$FrontendPort"
$ApiUrl  = "http://localhost:$BackendPort"

Write-Host "[dev] frontend : $SiteUrl" -ForegroundColor Green
Write-Host "[dev] backend  : $ApiUrl"  -ForegroundColor Green
Write-Host "[dev] env file : $EnvFile" -ForegroundColor DarkGray

# ── Backend: secrets from $EnvFile + localhost overrides for Docker infra ───────
$backendCmd = @"
`$env:DOTENV_CONFIG_PATH='$EnvFile'
`$env:NODE_ENV='development'
`$env:PORT='$BackendPort'
`$env:MYSQL_HOST='127.0.0.1'; `$env:MYSQL_PORT='3306'
`$env:MYSQL_USER='mediadl'; `$env:MYSQL_DATABASE='mediadl'; `$env:MYSQL_PASSWORD='mediadlpass'
`$env:REDIS_URL='redis://localhost:6379'
`$env:PYTHON_SERVICE_URL='http://localhost:8000'
Set-Location '$(Join-Path $Root 'backend')'
Write-Host '== MediaDL backend ($ApiUrl) ==' -ForegroundColor Magenta
npm run dev
"@

# ── Frontend: all public URLs derived from the chosen port ──────────────────────
$frontendCmd = @"
`$env:NEXT_PUBLIC_SITE_URL='$SiteUrl'
`$env:NEXT_PUBLIC_API_URL='$ApiUrl'
`$env:BACKEND_INTERNAL_URL='$ApiUrl'
Set-Location '$(Join-Path $Root 'frontend')'
Write-Host '== MediaDL frontend ($SiteUrl) ==' -ForegroundColor Magenta
npm run dev -- --port $FrontendPort
"@

Start-Process powershell -ArgumentList '-NoExit', '-Command', $backendCmd  | Out-Null
Start-Process powershell -ArgumentList '-NoExit', '-Command', $frontendCmd | Out-Null

Write-Host ""
Write-Host "[dev] launched in two new PowerShell windows. Close them (or Ctrl-C) to stop." -ForegroundColor Cyan
Write-Host "[dev] open $SiteUrl" -ForegroundColor Yellow
