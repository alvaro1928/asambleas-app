<#
.SYNOPSIS
  Copia el starter next-supabase-auth-starter a un nuevo directorio e instala dependencias.

.EXAMPLE
  .\templates\scripts\bootstrap-new-project.ps1 -TargetPath "C:\dev\mi-nuevo-sitio"
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$TargetPath,

  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$templateDir = Join-Path (Split-Path -Parent $scriptDir) 'next-supabase-auth-starter'

if (-not (Test-Path $templateDir)) {
  throw "No se encontró el template en: $templateDir"
}

if (Test-Path $TargetPath) {
  $items = Get-ChildItem -Force $TargetPath -ErrorAction SilentlyContinue
  if ($items -and $items.Count -gt 0) {
    throw "El directorio destino no está vacío: $TargetPath"
  }
} else {
  New-Item -ItemType Directory -Force -Path $TargetPath | Out-Null
}

Write-Host "Copiando template desde $templateDir ..."
Copy-Item -Path (Join-Path $templateDir '*') -Destination $TargetPath -Recurse -Force

$envExample = Join-Path $TargetPath '.env.local.example'
$envLocal = Join-Path $TargetPath '.env.local'
if ((Test-Path $envExample) -and -not (Test-Path $envLocal)) {
  Copy-Item $envExample $envLocal
  Write-Host "Creado .env.local desde .env.local.example — edítalo con tus credenciales."
}

$mcpExample = Join-Path $TargetPath '.cursor\mcp.json.example'
$mcpFile = Join-Path $TargetPath '.cursor\mcp.json'
if ((Test-Path $mcpExample) -and -not (Test-Path $mcpFile)) {
  Copy-Item $mcpExample $mcpFile
  Write-Host "Creado .cursor\mcp.json desde ejemplo — edita project-ref y token."
}

if (-not $SkipInstall) {
  Write-Host "Instalando dependencias (npm install)..."
  Push-Location $TargetPath
  try {
    npm install
  } finally {
    Pop-Location
  }
}

Write-Host ""
Write-Host "Listo: $TargetPath"
Write-Host "Siguiente:"
Write-Host "  1. Edita .env.local con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY"
Write-Host "  2. Configura Supabase (ver docs/auth/AUTH-RESUMEN-COMPLETO.md)"
Write-Host "  3. cd '$TargetPath' && npm run dev"
