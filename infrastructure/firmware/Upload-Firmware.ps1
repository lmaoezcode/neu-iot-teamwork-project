[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('uno', 'esp32')]
    [string]$Board,

    [ValidatePattern('^COM[1-9][0-9]*$')]
    [string]$Port,

    [switch]$BuildOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$pio = Join-Path $projectRoot 'tools\.pio-venv\Scripts\pio.exe'
$pioCore = Join-Path $projectRoot 'tools\.pio-core'
if (-not (Test-Path -LiteralPath $pio)) {
    throw 'Không tìm thấy PlatformIO cục bộ. Cần khôi phục tools/.pio-venv theo tài liệu firmware trước.'
}

function Invoke-LocalPlatformIo {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [Parameter(Mandatory = $true)]
        [string]$FailureMessage
    )

    $hadPreviousCore = Test-Path Env:PLATFORMIO_CORE_DIR
    $previousCore = $env:PLATFORMIO_CORE_DIR
    try {
        $env:PLATFORMIO_CORE_DIR = $pioCore
        & $pio @Arguments
        if ($LASTEXITCODE -ne 0) { throw $FailureMessage }
    }
    finally {
        if (-not $hadPreviousCore) {
            Remove-Item Env:PLATFORMIO_CORE_DIR -ErrorAction SilentlyContinue -WhatIf:$false -Confirm:$false
        }
        else {
            $env:PLATFORMIO_CORE_DIR = $previousCore
        }
    }
}

$boardName = $Board.ToLowerInvariant()
if ($boardName -eq 'uno') {
    $firmwareRoot = Join-Path $projectRoot 'firmware\uno'
    $environment = 'uno'
    $iniPath = Join-Path $firmwareRoot 'platformio.ini'
    $ini = [System.IO.File]::ReadAllText($iniPath)
    foreach ($flag in @('SMARTROOM_ENABLE_MQ2', 'SMARTROOM_ENABLE_FLAME_SENSOR', 'SMARTROOM_ENABLE_BUZZER')) {
        if ($ini -notmatch ('-D\s+' + [Regex]::Escape($flag) + '=0')) {
            throw "Cờ an toàn $flag không còn bằng 0. Dừng nạp cho tới khi có bằng chứng cổng G5 tương ứng."
        }
    }
}
else {
    $firmwareRoot = Join-Path $projectRoot 'firmware\esp32'
    $environment = 'esp32dev'
    if (-not $BuildOnly) {
        $secretsPath = Join-Path $firmwareRoot 'include\secrets.hpp'
        if (-not (Test-Path -LiteralPath $secretsPath)) {
            throw 'Thiếu firmware/esp32/include/secrets.hpp. Tạo từ secrets.example.hpp và giữ file ngoài quản lý mã nguồn.'
        }
        $secrets = [System.IO.File]::ReadAllText($secretsPath)
        if ($secrets -match 'TEN_WIFI|MAT_KHAU_WIFI|MAT_KHAU_MQTT') {
            throw 'secrets.hpp vẫn chứa giá trị mẫu; không nạp ESP32.'
        }
    }
}

Write-Host "Đang build firmware $boardName bằng môi trường $environment..." -ForegroundColor Cyan
Invoke-LocalPlatformIo `
    -Arguments @('run', '-d', $firmwareRoot, '-e', $environment) `
    -FailureMessage "Build firmware $boardName thất bại."
if ($BuildOnly) {
    Write-Host "Build firmware $boardName đã đạt; chưa nạp board." -ForegroundColor Green
    return
}

if (-not $Port) { throw 'Phải truyền -Port COMx khi không dùng -BuildOnly.' }
$normalizedPort = $Port.ToUpperInvariant()
$availablePorts = @([System.IO.Ports.SerialPort]::GetPortNames())
if ($availablePorts -notcontains $normalizedPort) {
    throw "Không thấy $normalizedPort. Chạy Get-BoardPorts.ps1 và cắm từng board riêng để xác nhận."
}

$target = "$boardName tại $normalizedPort"
$warning = 'Nạp firmware đã build. Chỉ tiếp tục khi board dùng USB riêng, chưa nối tải chưa qua cổng và đã xác nhận đúng cổng COM.'
if (-not $PSCmdlet.ShouldProcess($target, $warning)) { return }

Invoke-LocalPlatformIo `
    -Arguments @('run', '-d', $firmwareRoot, '-e', $environment, '-t', 'upload', '--upload-port', $normalizedPort) `
    -FailureMessage "Nạp firmware $boardName vào $normalizedPort thất bại."
Write-Host "Đã nạp firmware $boardName vào $normalizedPort." -ForegroundColor Green
Write-Host 'Chưa được coi là cổng phần cứng đạt; cần lưu log boot và quan sát board thật.' -ForegroundColor Yellow
