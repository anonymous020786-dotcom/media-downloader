<#
.SYNOPSIS
  Lean dev mode — start only the containers the host dev frontend needs.

.DESCRIPTION
  On an 8 GB host, running the full 7-container stack AND a host dev server
  exhausts RAM. This starts only mysql + redis + python-service + backend in
  Docker (skipping nginx, the frontend container, and the optional Kafka),
  disables Kafka in the backend (KAFKA_BROKER=""), and launches the Next.js
  dev server on the host with hot reload.

  Frees ~1.3 GB vs the full stack. Use ./scripts/dev-lean.ps1 to start,
  -Stop to tear the lean stack down.

.EXAMPLE
  ./scripts/dev-lean.ps1          # start lean dev
  ./scripts/dev-lean.ps1 -Stop    # stop the lean containers
#>
[CmdletBinding()]
param([switch]$Stop)

# Native tools (docker) write progress to stderr; under 'Stop' PowerShell 5.1
# treats that as a fatal error. Keep it non-terminating and gate on exit codes.
$ErrorActionPreference = 'Continue'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

# Base + lean override (the override sets KAFKA_BROKER: "" so the backend skips Kafka).
$Lean = @('-f', 'docker-compose.yml', '-f', 'docker-compose.lean.yml')

if ($Stop) {
  Write-Host '[dev-lean] stopping lean containers…' -ForegroundColor Cyan
  docker compose stop backend python-service redis mysql
  Write-Host '[dev-lean] done. (host dev server, if any, keeps running)' -ForegroundColor Green
  return
}

# ── Make sure Docker is up ──────────────────────────────────────────────────────
docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Error '[dev-lean] Docker engine not reachable — start Docker Desktop first.'; return }

# ── Stop the containers a host dev session does NOT need (frees RAM) ─────────────
Write-Host '[dev-lean] stopping unused containers (nginx, frontend, kafka)…' -ForegroundColor Cyan
docker compose stop nginx frontend kafka

# ── Start the infra, then the backend without pulling Kafka back in ─────────────
Write-Host '[dev-lean] starting mysql + redis + python-service…' -ForegroundColor Cyan
docker compose up -d mysql redis python-service
Write-Host '[dev-lean] starting backend (Kafka disabled)…' -ForegroundColor Cyan
docker compose @Lean up -d --no-deps backend

# ── Host frontend dev server (hot reload) ───────────────────────────────────────
$devUp = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($devUp) {
  Write-Host '[dev-lean] frontend dev server already running on :3000' -ForegroundColor DarkGray
} else {
  Write-Host '[dev-lean] launching frontend dev server on :3000…' -ForegroundColor Cyan
  Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c', 'npm run dev > dev.log 2>&1' `
    -WorkingDirectory (Join-Path $Root 'frontend') -WindowStyle Hidden
}

Write-Host ''
Write-Host '[dev-lean] ready:' -ForegroundColor Green
Write-Host '  Frontend (dev) : http://localhost:3000' -ForegroundColor Yellow
Write-Host '  Backend  (API) : http://localhost:4000'
Write-Host '  Running: mysql, redis, python-service, backend  (nginx/frontend/kafka stopped)'
