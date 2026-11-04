[CmdletBinding()]
param(
    [ValidateNotNullOrEmpty()]
    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if (-not $OutputPath) {
    $OutputPath = Join-Path $projectRoot 'data\logs\hardware\stage17-hardware-preparation.json'
}
$reportPath = [System.IO.Path]::GetFullPath($OutputPath)
$checks = [System.Collections.Generic.List[object]]::new()

function Add-Check {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][bool]$Ready,
        [Parameter(Mandatory = $true)][string]$Detail
    )
    $checks.Add([ordered]@{
        id = $Id
        label = $Label
        ready = $Ready
        detail = $Detail
    })
}

function Project-Path([string]$RelativePath) {
    return Join-Path $projectRoot $RelativePath
}

function Get-Sha256([string]$Path) {
    $stream = [System.IO.File]::OpenRead($Path)
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        return ([System.BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $algorithm.Dispose()
        $stream.Dispose()
    }
}

$pio = Project-Path 'tools\.pio-venv\Scripts\pio.exe'
$pioCore = Project-Path 'tools\.pio-core'
$unoHex = Project-Path 'firmware\uno\.pio\build\uno\firmware.hex'
$espBin = Project-Path 'firmware\esp32\.pio\build\esp32dev\firmware.bin'
$mosquittoRoot = Project-Path 'tools\.mosquitto'
$unoIniPath = Project-Path 'firmware\uno\platformio.ini'
$unoIni = if (Test-Path -LiteralPath $unoIniPath) { [System.IO.File]::ReadAllText($unoIniPath) } else { '' }

Add-Check 'local-platformio' 'PlatformIO cục bộ' ((Test-Path -LiteralPath $pio -PathType Leaf) -and (Test-Path -LiteralPath $pioCore -PathType Container)) 'Cần pio.exe và kho tools/.pio-core trong dự án.'
Add-Check 'uno-build' 'Binary UNO đã build' (Test-Path -LiteralPath $unoHex -PathType Leaf) 'Cần firmware.hex; kết quả build không đồng nghĩa đã nạp board.'
Add-Check 'esp32-build' 'Binary ESP32 đã build' (Test-Path -LiteralPath $espBin -PathType Leaf) 'Cần firmware.bin; kết quả build không đồng nghĩa đã nạp board.'

$safeFlags = @('SMARTROOM_ENABLE_MQ2', 'SMARTROOM_ENABLE_FLAME_SENSOR', 'SMARTROOM_ENABLE_BUZZER')
$safeFlagsReady = $safeFlags | ForEach-Object { $unoIni -match ('-D\s+' + [Regex]::Escape($_) + '=0') } | Where-Object { -not $_ }
Add-Check 'safe-flags' 'Ba cờ tải chưa qua cổng vẫn tắt' (@($safeFlagsReady).Count -eq 0) 'MQ-2, flame và còi phải giữ bằng 0.'

$firmwareTools = @(
    'infrastructure\firmware\Get-BoardPorts.ps1',
    'infrastructure\firmware\Record-HardwareCheckpoint1.ps1',
    'infrastructure\firmware\Capture-SerialLog.ps1',
    'infrastructure\firmware\Upload-Firmware.ps1',
    'infrastructure\firmware\Redact-IntegrationLog.ps1'
)
Add-Check 'firmware-tools' 'Công cụ COM/upload/che log' ($firmwareTools | ForEach-Object { Test-Path -LiteralPath (Project-Path $_) -PathType Leaf } | Where-Object { -not $_ } | Measure-Object | Select-Object -ExpandProperty Count | ForEach-Object { $_ -eq 0 }) 'Chỉ kiểm tra hiện diện; không chạy upload.'

$mqttTools = @('mosquitto.exe', 'mosquitto_passwd.exe', 'mosquitto_pub.exe', 'mosquitto_sub.exe')
$mqttReady = @($mqttTools | Where-Object { -not (Test-Path -LiteralPath (Join-Path $mosquittoRoot $_) -PathType Leaf) }).Count -eq 0
Add-Check 'mqtt-tools' 'Mosquitto portable và client' $mqttReady 'Cần broker, passwd, pub và sub cục bộ.'

$failedChecks = @($checks | Where-Object { -not $_.ready })
$ports = @([System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object)
$builds = [ordered]@{}
foreach ($entry in @(
    @{ Name = 'uno'; Path = $unoHex },
    @{ Name = 'esp32'; Path = $espBin }
)) {
    if (Test-Path -LiteralPath $entry.Path -PathType Leaf) {
        $file = Get-Item -LiteralPath $entry.Path
        $relativePath = $entry.Path.Substring($projectRoot.Length).TrimStart('\', '/').Replace('\', '/')
        $builds[$entry.Name] = [ordered]@{
            path = $relativePath
            size_bytes = $file.Length
            sha256 = Get-Sha256 $entry.Path
            last_write_utc = $file.LastWriteTimeUtc.ToString('o')
        }
    }
}

$report = [ordered]@{
    schema = 'smartroom.stage17-hardware-preparation'
    schema_version = 1
    generated_at = [DateTimeOffset]::UtcNow.ToString('o')
    scope = 'TIỀN KIỂM MÁY PHÁT TRIỂN — CHƯA THAO TÁC PHẦN CỨNG'
    result = if ($failedChecks.Count -eq 0) { 'PREPARATION_READY' } else { 'PREPARATION_BLOCKED' }
    hardware_evidence = $false
    physical_measurements = $false
    upload_performed = $false
    acceptance_updates_allowed = $false
    checks = $checks
    builds = $builds
    local_state = [ordered]@{
        detected_com_ports = $ports
        board_mapping = 'waiting_human_unplug_replug'
        mqtt_runtime_present = Test-Path -LiteralPath (Project-Path 'infrastructure\mqtt\runtime\mosquitto.generated.conf')
        server_local_env_present = Test-Path -LiteralPath (Project-Path 'config\server.local.env')
        esp32_secrets_present = Test-Path -LiteralPath (Project-Path 'firmware\esp32\include\secrets.hpp')
    }
    human_gates = @(
        [ordered]@{ id = 'photos'; status = 'CHƯA THỰC HIỆN' },
        [ordered]@{ id = 'com_mapping'; status = 'CHƯA THỰC HIỆN' },
        [ordered]@{ id = 'power_measurements'; status = 'CHƯA THỰC HIỆN' },
        [ordered]@{ id = 'logic_level_measurements'; status = 'CHƯA THỰC HIỆN' },
        [ordered]@{ id = 'board_upload_and_boot'; status = 'CHƯA THỰC HIỆN' },
        [ordered]@{ id = 'physical_uart_network_e2e'; status = 'CHƯA THỰC HIỆN' }
    )
}

$directory = Split-Path -Parent $reportPath
if ($directory) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
[System.IO.File]::WriteAllText(
    $reportPath,
    (($report | ConvertTo-Json -Depth 10) + "`n"),
    [System.Text.UTF8Encoding]::new($false)
)

foreach ($check in $checks) {
    $prefix = if ($check.ready) { '[SẴN SÀNG]' } else { '[THIẾU]' }
    Write-Host "$prefix $($check.label): $($check.detail)" -ForegroundColor $(if ($check.ready) { 'Green' } else { 'Red' })
}
Write-Host "Biên bản: $reportPath"
Write-Host "Kết quả: $($report.result); hardware_evidence=false; không có thao tác upload." -ForegroundColor Yellow
if ($failedChecks.Count -gt 0) { exit 1 }
