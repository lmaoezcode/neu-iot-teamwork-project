[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$BaselineSnapshot,
    [Parameter(Mandatory = $true)][string]$UnoSnapshot,
    [Parameter(Mandatory = $true)][string]$Esp32Snapshot,
    [Parameter(Mandatory = $true)][ValidateRange(0.0, 30.0)][double]$UnoRailV,
    [Parameter(Mandatory = $true)][ValidateRange(0.0, 30.0)][double]$Esp32RailV,
    [Parameter(Mandatory = $true)][ValidateRange(-30.0, 30.0)][double]$GroundDeltaV,
    [string[]]$PhotoPath = @(),
    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if (-not $OutputPath) {
    $OutputPath = Join-Path $projectRoot 'data\logs\hardware\checkpoint1-user-report.json'
}

function Read-PortSnapshot([string]$Path, [string]$Label) {
    $resolved = [System.IO.Path]::GetFullPath($Path)
    if (-not (Test-Path -LiteralPath $resolved -PathType Leaf)) {
        throw "Không tìm thấy snapshot $Label`: $resolved"
    }
    $snapshot = Get-Content -LiteralPath $resolved -Raw | ConvertFrom-Json
    if ($snapshot.schema -ne 'smartroom.board-port-snapshot' -or $snapshot.schema_version -ne 1) {
        throw "Snapshot $Label không đúng schema smartroom.board-port-snapshot phiên bản 1."
    }
    if ($snapshot.hardware_evidence -ne $false) {
        throw "Snapshot $Label phải giữ hardware_evidence=false."
    }
    return [PSCustomObject]@{
        Label = $Label
        Path = $resolved
        Ports = @($snapshot.ports | ForEach-Object { [string]$_.port })
        CapturedAt = [string]$snapshot.captured_at
    }
}

function Find-SingleAddedPort($Baseline, $Candidate) {
    $baselineSet = @{}
    foreach ($port in $Baseline.Ports) { $baselineSet[$port] = $true }
    $added = @($Candidate.Ports | Where-Object { -not $baselineSet.ContainsKey($_) })
    if ($added.Count -ne 1) {
        throw "Snapshot $($Candidate.Label) phải có đúng một cổng mới so với baseline; tìm thấy $($added.Count): $($added -join ', ')."
    }
    return $added[0]
}

function New-Measurement([string]$Id, [double]$Value, [double]$Minimum, [double]$Maximum, [bool]$UseAbsolute) {
    $evaluated = if ($UseAbsolute) { [Math]::Abs($Value) } else { $Value }
    return [ordered]@{
        id = $Id
        reported_value_v = $Value
        evaluated_value_v = $evaluated
        minimum_v = $Minimum
        maximum_v = $Maximum
        reported_within_range = ($evaluated -ge $Minimum -and $evaluated -le $Maximum)
    }
}

$baseline = Read-PortSnapshot $BaselineSnapshot 'baseline'
$uno = Read-PortSnapshot $UnoSnapshot 'UNO'
$esp32 = Read-PortSnapshot $Esp32Snapshot 'ESP32'
$unoPort = Find-SingleAddedPort $baseline $uno
$esp32Port = Find-SingleAddedPort $baseline $esp32
if ($unoPort -eq $esp32Port) {
    throw "UNO và ESP32 cùng ánh xạ tới $unoPort. Phải rút/cắm lại từng board và chụp snapshot riêng."
}

$measurements = @(
    (New-Measurement 'G17-HW-PWR-01A' $UnoRailV 4.75 5.25 $false),
    (New-Measurement 'G17-HW-PWR-01B' $Esp32RailV 4.75 5.25 $false),
    (New-Measurement 'G17-HW-PWR-01C' $GroundDeltaV 0.0 0.1 $true)
)
$allWithinRange = @($measurements | Where-Object { -not $_.reported_within_range }).Count -eq 0
$photos = @($PhotoPath | ForEach-Object {
    $resolved = [System.IO.Path]::GetFullPath($_)
    [ordered]@{
        path = $resolved
        exists = Test-Path -LiteralPath $resolved -PathType Leaf
    }
})
$allPhotosExist = $photos.Count -gt 0 -and @($photos | Where-Object { -not $_.exists }).Count -eq 0

$report = [ordered]@{
    schema = 'smartroom.stage17-checkpoint1-user-report'
    schema_version = 1
    generated_at = [DateTimeOffset]::UtcNow.ToString('o')
    scope = 'DỮ LIỆU DO NGƯỜI DÙNG BÁO CÁO — CHỜ GPT ĐỐI CHIẾU'
    result = if ($allWithinRange) { 'REPORTED_VALUES_WITHIN_RANGE' } else { 'STOP_OUT_OF_RANGE' }
    review_status = 'PENDING_GPT_REVIEW'
    gate_decision = 'CHƯA ĐÁNH GIÁ'
    hardware_evidence = $false
    user_reported_physical_data_present = $true
    acceptance_updates_allowed = $false
    upload_performed = $false
    port_mapping = [ordered]@{
        uno = $unoPort
        esp32 = $esp32Port
        method = 'single_added_port_against_unplugged_baseline'
        snapshots = [ordered]@{
            baseline = [System.IO.Path]::GetFileName($baseline.Path)
            uno = [System.IO.Path]::GetFileName($uno.Path)
            esp32 = [System.IO.Path]::GetFileName($esp32.Path)
        }
    }
    measurements = $measurements
    photos = $photos
    evidence_complete_for_review = ($allWithinRange -and $allPhotosExist)
    warnings = @(
        'reported_within_range chỉ là kiểm tra số học, không phải quyết định ĐẠT',
        'GPT phải đối chiếu ảnh, vị trí que đo và snapshot trước khi quyết định cổng',
        'không dùng báo cáo này để nạp board nếu chưa được duyệt'
    )
}

$target = [System.IO.Path]::GetFullPath($OutputPath)
$directory = Split-Path -Parent $target
if ($directory) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
[System.IO.File]::WriteAllText(
    $target,
    (($report | ConvertTo-Json -Depth 10) + "`n"),
    [System.Text.UTF8Encoding]::new($false)
)

Write-Host "UNO ứng viên: $unoPort; ESP32 ứng viên: $esp32Port"
foreach ($measurement in $measurements) {
    $label = if ($measurement.reported_within_range) { '[TRONG DẢI BÁO CÁO]' } else { '[CẦN DỪNG]' }
    Write-Host "$label $($measurement.id): $($measurement.reported_value_v) V"
}
Write-Host "Biên bản chờ duyệt: $target"
Write-Host 'Không có cổng nào được tự đánh dấu ĐẠT; review_status=PENDING_GPT_REVIEW.' -ForegroundColor Yellow
if (-not $allWithinRange) { exit 2 }

