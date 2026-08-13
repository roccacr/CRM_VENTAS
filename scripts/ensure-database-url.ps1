$ErrorActionPreference = 'Stop'

$envPath = Join-Path (Split-Path -Parent $PSScriptRoot) '.env'

if (-not (Test-Path -LiteralPath $envPath)) {
  throw '.env file not found'
}

$values = @{}

foreach ($line in Get-Content -Path $envPath) {
  if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
    $values[$matches[1]] = $matches[2]
  }
}

if ($values.ContainsKey('DATABASE_URL') -and -not [string]::IsNullOrWhiteSpace($values['DATABASE_URL'])) {
  Write-Output 'DATABASE_URL already configured'
  exit 0
}

$required = @('MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_USER', 'MYSQL_PASSWORD', 'MYSQL_DATABASE')

foreach ($key in $required) {
  if (-not $values.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($values[$key])) {
    throw "Missing required key to build DATABASE_URL: $key"
  }
}

$user = [uri]::EscapeDataString($values['MYSQL_USER'])
$password = [uri]::EscapeDataString($values['MYSQL_PASSWORD'])
$database = [uri]::EscapeDataString($values['MYSQL_DATABASE'])
$databaseUrl = "mysql://${user}:${password}@$($values['MYSQL_HOST']):$($values['MYSQL_PORT'])/${database}"

Add-Content -Path $envPath -Value ''
Add-Content -Path $envPath -Value '# Prisma'
Add-Content -Path $envPath -Value "DATABASE_URL=$databaseUrl"

Write-Output 'DATABASE_URL added from MYSQL_* values'
