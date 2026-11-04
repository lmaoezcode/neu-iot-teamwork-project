[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^COM[1-9][0-9]*$')]
    [string]$Port,

    [ValidateSet(115200)]
    [int]$Baud = 115200,

    [ValidateRange(5, 600)]
    [int]$DurationSeconds = 60,

    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$normalizedPort = $Port.ToUpperInvariant()
if (-not $OutputPath) {
    $stamp = [DateTimeOffset]::Now.ToString('yyyyMMdd-HHmmss')
    $OutputPath = Join-Path $projectRoot "data\logs\hardware\serial-$($normalizedPort.ToLowerInvariant())-$stamp.log"
}
$target = [System.IO.Path]::GetFullPath($OutputPath)
$leaf = [System.IO.Path]::GetFileName($target)
if ($leaf -match '^(?:secrets\.hpp|server\.local\.env|\.env(?:\..*)?)$') {
    throw 'Tên file output trùng tên file bí mật; hãy chọn tên log chẩn đoán.'
}

$action = "Thu log $Baud baud trong $DurationSeconds giây. Mở serial có thể làm board reset; chỉ dùng sau khi đã xác nhận đúng COM."
# Cho phép kiểm tra dry-run trên máy không có cổng COM, nhưng vẫn kiểm tra cổng thật
# trước mọi lần mở serial. Nhánh này không tạo thư mục, file hoặc đối tượng SerialPort.
if ($WhatIfPreference) {
    $null = $PSCmdlet.ShouldProcess("$normalizedPort → $target", $action)
    return
}

$available = @([System.IO.Ports.SerialPort]::GetPortNames())
if ($available -notcontains $normalizedPort) {
    throw "Không thấy $normalizedPort. Hãy xác nhận bằng snapshot/diff COM trước khi thu log."
}

if (-not $PSCmdlet.ShouldProcess("$normalizedPort → $target", $action)) { return }

$directory = Split-Path -Parent $target
if ($directory) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
$serial = [System.IO.Ports.SerialPort]::new(
    $normalizedPort,
    $Baud,
    [System.IO.Ports.Parity]::None,
    8,
    [System.IO.Ports.StopBits]::One
)
$serial.DtrEnable = $false
$serial.RtsEnable = $false
$serial.ReadTimeout = 250
$serial.Encoding = [System.Text.Encoding]::UTF8
$writer = [System.IO.StreamWriter]::new($target, $false, [System.Text.UTF8Encoding]::new($false))
$receivedCharacters = 0
$startedAt = [DateTimeOffset]::UtcNow
$timer = [System.Diagnostics.Stopwatch]::StartNew()

try {
    $writer.WriteLine("# smartroom serial capture")
    $writer.WriteLine("# port=$normalizedPort baud=$Baud started_utc=$($startedAt.ToString('o'))")
    $writer.WriteLine('# status=RAW_UNREVIEWED; capture alone is not hardware PASS evidence')
    $serial.Open()
    while ($timer.Elapsed.TotalSeconds -lt $DurationSeconds) {
        $chunk = $serial.ReadExisting()
        if ($chunk.Length -gt 0) {
            $writer.Write($chunk)
            $writer.Flush()
            $receivedCharacters += $chunk.Length
        }
        Start-Sleep -Milliseconds 50
    }
    if ($receivedCharacters -eq 0) {
        $writer.WriteLine('# no serial characters observed during capture window')
    }
    $writer.WriteLine("# ended_utc=$([DateTimeOffset]::UtcNow.ToString('o')) characters=$receivedCharacters")
}
finally {
    $timer.Stop()
    if ($serial.IsOpen) { $serial.Close() }
    $serial.Dispose()
    $writer.Dispose()
}

Write-Host "Đã thu log thô: $target"
Write-Host "Số ký tự nhận: $receivedCharacters. Hãy chạy Redact-IntegrationLog.ps1 trước khi chia sẻ." -ForegroundColor Yellow
