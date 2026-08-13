$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root 'logs'
$stdout = Join-Path $logDir 'start-dev-verify.out.log'
$stderr = Join-Path $logDir 'start-dev-verify.err.log'

New-Item -ItemType Directory -Path $logDir -Force | Out-Null

$process = Start-Process `
  -FilePath 'npm.cmd' `
  -ArgumentList 'run start:dev' `
  -PassThru `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdout `
  -RedirectStandardError $stderr

try {
  $isHealthy = $false

  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Seconds 1

    try {
      $response = Invoke-RestMethod -Uri 'http://127.0.0.1:8002/api/v1/health' -TimeoutSec 2

      if ($response.status -eq 'ok') {
        $isHealthy = $true
        break
      }
    } catch {
      # The watch server may still be compiling.
    }
  }

  if (-not $isHealthy) {
    Write-Output 'start:dev health FAILED'
    Get-Content -Path $stdout -Tail 40 -ErrorAction SilentlyContinue
    Get-Content -Path $stderr -Tail 40 -ErrorAction SilentlyContinue
    exit 1
  }

  Write-Output 'start:dev health OK'
} finally {
  $allProcesses = Get-CimInstance Win32_Process
  $processIds = @($process.Id)

  for ($index = 0; $index -lt $processIds.Count; $index++) {
    $parentId = $processIds[$index]
    $childIds = @(
      $allProcesses |
        Where-Object { $_.ParentProcessId -eq $parentId } |
        Select-Object -ExpandProperty ProcessId
    )

    foreach ($childId in $childIds) {
      if ($processIds -notcontains $childId) {
        $processIds += $childId
      }
    }
  }

  foreach ($processId in ($processIds | Sort-Object -Descending)) {
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}
