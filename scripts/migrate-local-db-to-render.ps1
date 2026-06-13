param(
  [switch]$ResetRenderDatabase
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root "backend\.env"
$backupDir = Join-Path $root "db-backups"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dumpPath = Join-Path $backupDir "sfs-db-$timestamp.dump"

function Read-EnvFile($path) {
  $values = @{}

  if (-not (Test-Path $path)) {
    throw "Missing local backend .env file at $path"
  }

  Get-Content $path | ForEach-Object {
    $line = $_.Trim()

    if (-not $line -or $line.StartsWith("#") -or $line.StartsWith("//")) {
      return
    }

    $parts = $line -split "=", 2
    if ($parts.Count -ne 2) {
      return
    }

    $key = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")
    $values[$key] = $value
  }

  return $values
}

function Add-SslMode($databaseUrl) {
  if ($databaseUrl -match "sslmode=") {
    return $databaseUrl
  }

  if ($databaseUrl.Contains("?")) {
    return "$databaseUrl&sslmode=require"
  }

  return "$databaseUrl?sslmode=require"
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
$psql = Get-Command psql -ErrorAction SilentlyContinue
$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue

if (-not $pgDump -or -not $psql -or -not $pgRestore) {
  throw "PostgreSQL tools are required: pg_dump, psql, and pg_restore."
}

$localEnv = Read-EnvFile $envPath

$localDb = $localEnv["DB_NAME"]
$localUser = $localEnv["DB_USER"]
$localPassword = $localEnv["DB_PASSWORD"]
$localHost = $localEnv["DB_HOST"]
$localPort = $localEnv["DB_PORT"]

if (-not $localDb) { $localDb = "sfs_db" }
if (-not $localUser) { $localUser = "postgres" }
if (-not $localHost) { $localHost = "localhost" }
if (-not $localPort) { $localPort = "5432" }

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$env:PGPASSWORD = $localPassword

Write-Host "Exporting local database '$localDb' to $dumpPath"
& $pgDump.Source `
  --host $localHost `
  --port $localPort `
  --username $localUser `
  --dbname $localDb `
  --format custom `
  --no-owner `
  --no-acl `
  --file $dumpPath

if ($LASTEXITCODE -ne 0) {
  throw "Local database export failed."
}

Write-Host "Local export complete."

if (-not $ResetRenderDatabase) {
  Write-Host ""
  Write-Host "Export only. To import into Render, set RENDER_DATABASE_URL and rerun with -ResetRenderDatabase."
  Write-Host "Example:"
  Write-Host '$env:RENDER_DATABASE_URL="paste-render-external-database-url-here"'
  Write-Host '.\scripts\migrate-local-db-to-render.ps1 -ResetRenderDatabase'
  exit 0
}

if (-not $env:RENDER_DATABASE_URL) {
  throw "Set RENDER_DATABASE_URL to your Render Postgres External Database URL before importing."
}

$renderDatabaseUrl = Add-SslMode $env:RENDER_DATABASE_URL

Write-Host ""
Write-Host "WARNING: This will erase the current Render database schema and replace it with your local database dump."
$confirmation = Read-Host "Type MIGRATE to continue"

if ($confirmation -ne "MIGRATE") {
  throw "Import cancelled."
}

Write-Host "Resetting Render public schema..."
& $psql.Source $renderDatabaseUrl -v "ON_ERROR_STOP=1" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

if ($LASTEXITCODE -ne 0) {
  throw "Render database reset failed."
}

Write-Host "Restoring local dump into Render..."
& $pgRestore.Source `
  --dbname $renderDatabaseUrl `
  --no-owner `
  --no-acl `
  --verbose `
  $dumpPath

if ($LASTEXITCODE -ne 0) {
  throw "Render database import failed."
}

Write-Host "Render database import complete."
