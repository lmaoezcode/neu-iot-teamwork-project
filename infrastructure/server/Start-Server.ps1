[CmdletBinding()]
param([string]$EnvironmentFile)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if (-not $EnvironmentFile) { $EnvironmentFile = Join-Path $projectRoot 'config\server.local.env' }
$resolvedEnvironment = [System.IO.Path]::GetFullPath($EnvironmentFile)
if (-not (Test-Path -LiteralPath $resolvedEnvironment)) {
    throw "Thiếu $resolvedEnvironment. Chạy Initialize-Server.ps1 trước."
}
$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpm) { throw 'Không tìm thấy pnpm trong PATH.' }

$previous = $env:SERVER_ENV_FILE
try {
    $env:SERVER_ENV_FILE = $resolvedEnvironment
    Push-Location $projectRoot
    try { & $pnpm.Source --filter super-iot-server start }
    finally { Pop-Location }
}
finally {
    if ($null -eq $previous) { Remove-Item Env:SERVER_ENV_FILE -ErrorAction SilentlyContinue }
    else { $env:SERVER_ENV_FILE = $previous }
}

