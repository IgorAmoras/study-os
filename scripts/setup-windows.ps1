# Study OS — first-time setup for Windows PowerShell
# Run from the cloned repository:
# powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
[CmdletBinding()]
param(
    [string]$ResearchPath = (Join-Path $HOME 'data-driven-dynamics-and-control'),
    [switch]$SkipResearchClone
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

function Require-Command([string]$name, [string]$help) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "$name nao encontrado. $help"
    }
}

function Assert-Succeeded([string]$action) {
    if ($LASTEXITCODE -ne 0) {
        throw "$action falhou (exit code $LASTEXITCODE). Veja o erro acima."
    }
}

Write-Host ''
Write-Host '=== Study OS | Instalacao inicial (Windows) ===' -ForegroundColor Cyan
Require-Command 'git.exe' 'Instale Git for Windows: https://git-scm.com/download/win'
Require-Command 'node.exe' 'Instale Node.js (20.19+): https://nodejs.org/'
Require-Command 'npm.cmd' 'Reinstale Node.js incluindo npm.'

$nodeText = (& node.exe --version).Trim()
Assert-Succeeded 'node --version'
$match = [regex]::Match($nodeText, '^v(\d+)\.(\d+)\.(\d+)')
if (-not $match.Success) { throw "Nao foi possivel identificar a versao do Node: $nodeText" }
$major = [int]$match.Groups[1].Value
$minor = [int]$match.Groups[2].Value
if (($major -lt 20) -or ($major -eq 20 -and $minor -lt 19)) {
    throw "Node.js $nodeText incompativel. Necessario >=20.19."
}
Write-Host "Node.js OK: $nodeText" -ForegroundColor Green

$researchFullPath = [System.IO.Path]::GetFullPath($ResearchPath)
if (Test-Path -LiteralPath $researchFullPath -PathType Container) {
    Write-Host "Pesquisa existente: $researchFullPath"
} elseif ($SkipResearchClone) {
    Write-Warning "Pesquisa nao encontrada; acesso a arquivos locais ficara desabilitado."
    $researchFullPath = ''
} else {
    Write-Host "Clonando repositorio cientifico em: $researchFullPath"
    & git.exe clone --depth 1 https://github.com/IgorAmoras/data-driven-dynamics-and-control.git $researchFullPath
    Assert-Succeeded 'git clone da pesquisa'
}

Push-Location $repoRoot
try {
    Write-Host 'Instalando dependencias npm...'
    & npm.cmd install --no-audit --no-fund
    Assert-Succeeded 'npm install'

    Write-Host 'Validando testes, TypeScript e build de producao...'
    & npm.cmd run check
    Assert-Succeeded 'npm run check'

    $dataDir = Join-Path $repoRoot '.studyos-data'
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
    $pathFile = Join-Path $dataDir 'research-path.txt'
    [System.IO.File]::WriteAllText($pathFile, $researchFullPath, (New-Object System.Text.UTF8Encoding($false)))

    Write-Host ''
    Write-Host 'STUDY OS PREPARADO!' -ForegroundColor Green
    Write-Host "Codigo: $repoRoot"
    Write-Host "Pesquisa: $(if ($researchFullPath) { $researchFullPath } else { 'nao configurada' })"
    Write-Host 'Para abrir: execute Start-StudyOS.cmd (duplo clique).'
    Write-Host 'URL local: http://127.0.0.1:4317'
    Write-Host 'Se o Windows perguntar sobre o firewall, nao exponha esta porta em redes publicas.'
}
finally {
    Pop-Location
}
