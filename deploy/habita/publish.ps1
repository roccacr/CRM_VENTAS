param([Parameter(Mandatory)][string]$SshKeyPath)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$branch = (& git -C $repo branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -notmatch '^[A-Za-z0-9._/-]+$') { throw 'Rama no valida.' }
$commit = (& git -C $repo rev-parse HEAD).Trim()
$releaseId = (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss') + '-' + $commit.Substring(0, 7) + '-local'
$scratch = Join-Path ([IO.Path]::GetTempPath()) ('habita-publish-' + [guid]::NewGuid().ToString('N'))
[void](New-Item -ItemType Directory -Path $scratch)
$permissions = [Security.AccessControl.DirectorySecurity]::new()
$permissions.SetAccessRuleProtection($true, $false)
$permissions.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.WindowsIdentity]::GetCurrent().Name, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
Set-Acl -LiteralPath $scratch -AclObject $permissions
$privateKey = Join-Path $scratch 'deploy.pem'
$payload = Join-Path $scratch 'release'
[void](New-Item -ItemType Directory -Path $payload)
$oldOrigin = $env:VITE_API_ORIGIN
$oldRelease = $env:VITE_HABITA_RELEASE
$junctions = @()
try {
    Copy-Item -LiteralPath (Resolve-Path -LiteralPath $SshKeyPath).Path -Destination $privateKey
    $sources = [ordered]@{}
    $artifacts = [ordered]@{}
    $names = @(& git -C $repo -c core.quotePath=false ls-files --cached --others --exclude-standard) | Sort-Object -Unique
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo enumerar el proyecto.' }
    foreach ($name in $names) {
        $source = Join-Path $repo $name
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { continue }
        $leaf = [IO.Path]::GetFileName($name)
        if (($leaf -like '.env*' -and $leaf -ne '.env.example') -or ($name -match '\.(key|pfx|p12)$') -or ($name -match '\.pem$' -and $name -ne 'apps/api/certs/rds-global-bundle.pem')) { continue }
        if ((Get-Item -LiteralPath $source).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "No se empaquetan enlaces: $name" }
        $sources[$name] = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
        $target = Join-Path $payload $name
        [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target))
        Copy-Item -LiteralPath $source -Destination $target
        if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sources[$name]) { throw "El archivo cambio al copiarlo: $name" }
    }

    # Compilar una copia fija evita mezclar cambios concurrentes del checkout.
    foreach ($app in @('api', 'frontend')) {
        $junction = Join-Path $payload "apps/$app/node_modules"
        [void](New-Item -ItemType Junction -Path $junction -Target (Join-Path $repo "apps/$app/node_modules"))
        $junctions += $junction
    }
    & pnpm --dir (Join-Path $payload 'apps/api') build
    if ($LASTEXITCODE -ne 0) { throw 'Fallo el build del API.' }
    $env:VITE_API_ORIGIN = 'https://habita.roccacr.com'
    $env:VITE_HABITA_RELEASE = $releaseId
    & pnpm --dir (Join-Path $payload 'apps/frontend') build
    if ($LASTEXITCODE -ne 0) { throw 'Fallo el build del frontend.' }

    foreach ($app in @('api', 'frontend')) {
        $dist = Join-Path $payload "apps/$app/dist"
        foreach ($file in Get-ChildItem -LiteralPath $dist -File -Recurse) {
            $name = [IO.Path]::GetRelativePath($payload, $file.FullName).Replace('\', '/')
            $artifacts[$name] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }
    foreach ($junction in $junctions) {
        if (-not ((Get-Item -LiteralPath $junction).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Enlace de build inesperado.' }
        [IO.Directory]::Delete($junction)
    }
    $junctions = @()
    @{ branch = $branch; baseCommit = $commit; sourceFiles = $sources; artifactFiles = $artifacts; deletedFiles = @() } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $payload 'deployment-manifest.json') -Encoding utf8NoBOM
    $archive = Join-Path $scratch "$releaseId.tar.gz"
    & tar -czf $archive -C $payload .
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo empaquetar el release.' }
    $digest = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    $sshOptions = @('-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-i', $privateKey)
    & scp @sshOptions $archive 'ubuntu@3.12.74.187:/var/www/habita-crm/shared/'
    if ($LASTEXITCODE -ne 0) { throw 'Fallo la transferencia.' }
    & scp @sshOptions (Join-Path $PSScriptRoot 'activate-release.sh') 'ubuntu@3.12.74.187:/var/www/habita-crm/shared/activate-release.sh'
    if ($LASTEXITCODE -ne 0) { throw 'Fallo la transferencia del activador.' }
    & ssh @sshOptions 'ubuntu@3.12.74.187' "bash /var/www/habita-crm/shared/activate-release.sh '$releaseId' '$digest' '$branch'"
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo activar el release. Revisar el rollback informado.' }
    Write-Output "Publicado y verificado: $releaseId | SHA256 $digest"
} finally {
    $env:VITE_API_ORIGIN = $oldOrigin
    $env:VITE_HABITA_RELEASE = $oldRelease
    foreach ($junction in $junctions) {
        if ((Test-Path -LiteralPath $junction) -and ((Get-Item -LiteralPath $junction).Attributes -band [IO.FileAttributes]::ReparsePoint)) { [IO.Directory]::Delete($junction) }
    }
    # Solo se elimina la copia temporal de la llave; nunca la original ni carpetas recursivamente.
    if (Test-Path -LiteralPath $privateKey) { Remove-Item -LiteralPath $privateKey }
}
