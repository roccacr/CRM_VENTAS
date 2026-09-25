$ErrorActionPreference = "Stop"

if ($args.Count -gt 0) {
    throw "check-all no acepta argumentos. Ejecuta .\check-all.cmd sin parametros."
}

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

$Projects = @(
    @{
        Name = "API"
        Path = Join-Path $ProjectRoot "apps\api"
    },
    @{
        Name = "Frontend"
        Path = Join-Path $ProjectRoot "apps\frontend"
    }
)

function Invoke-ProjectCheck {
    param (
        [Parameter(Mandatory = $true)]
        [string] $Name,

        [Parameter(Mandatory = $true)]
        [string] $Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "No existe la ruta del proyecto ${Name}: $Path"
    }

    Write-Host ""
    Write-Host "=== CRM TINK :: validando $Name ==="
    Push-Location -LiteralPath $Path

    try {
        pnpm check

        if ($LASTEXITCODE -ne 0) {
            throw "Fallo la validacion de ${Name} con codigo $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

foreach ($Project in $Projects) {
    Invoke-ProjectCheck -Name $Project.Name -Path $Project.Path
}

Write-Host ""
Write-Host "=== CRM TINK :: validacion completa ==="
