param(
  [switch]$ResetRenderDatabase,
  [string]$RenderDatabaseUrl,
  [string]$ExistingDumpPath
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
  $databaseUrl = String-Clean $databaseUrl

  if ($databaseUrl -match "sslmode=") {
    return $databaseUrl
  }

  if ($databaseUrl.Contains("?")) {
    return "${databaseUrl}&sslmode=require"
  }

  return "${databaseUrl}?sslmode=require"
}

function String-Clean($value) {
  if ($null -eq $value) {
    return ""
  }

  return [string]$value.Trim().Trim('"').Trim("'")
}

function Convert-DatabaseUrl($databaseUrl) {
  $cleanUrl = String-Clean $databaseUrl
  $match = [regex]::Match($cleanUrl, "^[A-Za-z][A-Za-z0-9+.-]*://(?<user>[^:/?#]+):(?<password>[^@]+)@(?<host>[^:/?#]+)(:(?<port>\d+))?/(?<database>[^?/#]+)")

  if (-not $match.Success) {
    $hasScheme = $cleanUrl -match "^[A-Za-z][A-Za-z0-9+.-]*://"
    $hasAt = $cleanUrl.Contains("@")
    $hasDatabasePath = $cleanUrl -match "/[^/?#]+(\?|$)"
    throw "Render database URL could not be parsed. Check that you copied the External Database URL. Detected scheme: $hasScheme, @ sign: $hasAt, database path: $hasDatabasePath."
  }

  $serverHost = $match.Groups["host"].Value
  $port = "5432"
  if ($match.Groups["port"].Success) {
    $port = $match.Groups["port"].Value
  }

  return @{
    Host = $serverHost
    Port = $port
    User = [System.Uri]::UnescapeDataString($match.Groups["user"].Value)
    Password = [System.Uri]::UnescapeDataString($match.Groups["password"].Value)
    Database = [System.Uri]::UnescapeDataString($match.Groups["database"].Value)
  }
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
$psql = Get-Command psql -ErrorAction SilentlyContinue
$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue

if (-not $psql -or -not $pgRestore -or ((-not $ExistingDumpPath) -and (-not $pgDump))) {
  throw "PostgreSQL tools are required: psql, pg_restore, and pg_dump when creating a new local export."
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
if ($localHost -eq "localhost") { $localHost = "127.0.0.1" }

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

if ($ExistingDumpPath) {
  $dumpPath = (Resolve-Path $ExistingDumpPath).Path
  $dumpFile = Get-Item $dumpPath

  if ($dumpFile.Length -lt 1) {
    throw "Existing dump file is empty: $dumpPath"
  }

  Write-Host "Using existing local database dump $dumpPath"
} else {
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
    throw "Local database export failed. If Windows reports no buffer space, close load tests/dev servers or reboot, then retry. You can also rerun with -ExistingDumpPath using a previous non-empty dump from db-backups."
  }

  Write-Host "Local export complete."
}

if (-not $ResetRenderDatabase) {
  Write-Host ""
Write-Host "Export only. To import into Render, set RENDER_DATABASE_URL and rerun with -ResetRenderDatabase."
  Write-Host "Example:"
  Write-Host '$env:RENDER_DATABASE_URL="paste-render-external-database-url-here"'
  Write-Host '.\scripts\migrate-local-db-to-render.ps1 -ResetRenderDatabase'
  Write-Host 'Or:'
  Write-Host '.\scripts\migrate-local-db-to-render.ps1 -ResetRenderDatabase -RenderDatabaseUrl "paste-render-external-database-url-here"'
  Write-Host 'To reuse a previous dump:'
  Write-Host '.\scripts\migrate-local-db-to-render.ps1 -ResetRenderDatabase -ExistingDumpPath ".\db-backups\sfs-db-YYYYMMDD-HHMMSS.dump" -RenderDatabaseUrl "paste-render-external-database-url-here"'
  exit 0
}

$renderDatabaseUrlRaw = String-Clean $RenderDatabaseUrl
if (-not $renderDatabaseUrlRaw) {
  $renderDatabaseUrlRaw = String-Clean $env:RENDER_DATABASE_URL
}

if (-not $renderDatabaseUrlRaw) {
  throw "Set RENDER_DATABASE_URL to your Render Postgres External Database URL before importing."
}

$renderDatabase = Convert-DatabaseUrl (Add-SslMode $renderDatabaseUrlRaw)

Write-Host ""
Write-Host "WARNING: This will erase the current Render database schema and replace it with your local database dump."
$confirmation = Read-Host "Type MIGRATE to continue"

if ($confirmation -ne "MIGRATE") {
  throw "Import cancelled."
}

Write-Host "Resetting Render public schema..."
$env:PGPASSWORD = $renderDatabase.Password
$env:PGSSLMODE = "require"
& $psql.Source `
  --host $renderDatabase.Host `
  --port $renderDatabase.Port `
  --username $renderDatabase.User `
  --dbname $renderDatabase.Database `
  -v "ON_ERROR_STOP=1" `
  -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

if ($LASTEXITCODE -ne 0) {
  throw "Render database reset failed."
}

Write-Host "Restoring local dump into Render..."
& $pgRestore.Source `
  --host $renderDatabase.Host `
  --port $renderDatabase.Port `
  --username $renderDatabase.User `
  --dbname $renderDatabase.Database `
  --no-owner `
  --no-acl `
  --verbose `
  $dumpPath

if ($LASTEXITCODE -ne 0) {
  throw "Render database import failed."
}

Write-Host "Render database import complete."
