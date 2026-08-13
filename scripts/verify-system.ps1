$ErrorActionPreference = 'Stop'

$checks = @(
  @{ Name = 'lint'; Command = 'npm.cmd'; Arguments = @('run', 'lint') },
  @{ Name = 'typecheck'; Command = 'npm.cmd'; Arguments = @('run', 'typecheck') },
  @{ Name = 'unit tests'; Command = 'npm.cmd'; Arguments = @('run', 'test', '--', '--runInBand') },
  @{ Name = 'e2e tests'; Command = 'npm.cmd'; Arguments = @('run', 'test:e2e', '--', '--runInBand') },
  @{ Name = 'build'; Command = 'npm.cmd'; Arguments = @('run', 'build') },
  @{ Name = 'format check'; Command = 'npm.cmd'; Arguments = @('run', 'format:check') },
  @{ Name = 'production audit'; Command = 'npm.cmd'; Arguments = @('audit', '--omit=dev') },
  @{ Name = 'database read check'; Command = 'npm.cmd'; Arguments = @('run', 'db:check') },
  @{ Name = 'playwright smoke'; Command = 'npm.cmd'; Arguments = @('run', 'test:playwright') },
  @{ Name = 'start dev health'; Command = 'npm.cmd'; Arguments = @('run', 'verify:start:dev') }
)

$startedAt = Get-Date
Write-Output "API Kapso verification started: $($startedAt.ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Output ''

foreach ($check in $checks) {
  $name = $check['Name']
  $command = $check['Command']
  $argumentList = $check['Arguments']
  $commandText = "$command $($argumentList -join ' ')"
  Write-Output "==> ${name}: $commandText"

  & $command @argumentList

  if ($LASTEXITCODE -ne 0) {
    Write-Output ''
    Write-Output "FAILED: $name"
    exit $LASTEXITCODE
  }

  Write-Output "OK: $name"
  Write-Output ''
}

$finishedAt = Get-Date
$duration = New-TimeSpan -Start $startedAt -End $finishedAt

Write-Output "All verification checks passed."
Write-Output "Finished: $($finishedAt.ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Output "Duration: $([math]::Round($duration.TotalSeconds, 2)) seconds"
