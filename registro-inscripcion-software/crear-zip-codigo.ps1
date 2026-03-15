# Crea codigo-fuente-Asambleas-App.zip para inscripción de software
# Ejecutar desde la raíz del proyecto: .\registro-inscripcion-software\crear-zip-codigo.ps1

$ErrorActionPreference = "Stop"
$carpetaSalida = $PSScriptRoot
$raizProyecto = Split-Path -Parent $carpetaSalida
$zipPath = Join-Path $carpetaSalida "codigo-fuente-Asambleas-App.zip"

$gitDir = Join-Path $raizProyecto ".git"
if (-not (Test-Path $gitDir)) {
    Write-Host "Error: No se encontro el repositorio .git en: $raizProyecto" -ForegroundColor Red
    exit 1
}

Push-Location $raizProyecto
try {
    git archive -o $zipPath HEAD
} finally {
    Pop-Location
}

Write-Host "Listo. ZIP creado: $zipPath" -ForegroundColor Green
Write-Host "Tamano aproximado:" (([math]::Round((Get-Item $zipPath).Length / 1MB, 2)) -as [string]) "MB"
