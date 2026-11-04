[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$firmwareTools = Join-Path $projectRoot 'infrastructure\firmware'
$fixtures = Join-Path $PSScriptRoot 'fixtures'
$portTool = Join-Path $firmwareTools 'Get-BoardPorts.ps1'
$checkpointTool = Join-Path $firmwareTools 'Record-HardwareCheckpoint1.ps1'
$serialTool = Join-Path $firmwareTools 'Capture-SerialLog.ps1'
$redactTool = Join-Path $firmwareTools 'Redact-IntegrationLog.ps1'
$tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$tempDirectory = Join-Path $tempRoot ("smartroom-hardware-tooling-" + [Guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $tempDirectory

$inventoryPath = Join-Path $tempDirectory 'ports-current.json'
$nominalPath = Join-Path $tempDirectory 'checkpoint-nominal.json'
$outOfRangePath = Join-Path $tempDirectory 'checkpoint-out-of-range.json'
$ambiguousPath = Join-Path $tempDirectory 'checkpoint-ambiguous.json'
$serialPath = Join-Path $tempDirectory 'serial-whatif.log'
$redactionPath = Join-Path $tempDirectory 'redacted.log'
$passes = 0

function Assert-True([bool]$Condition, [string]$Label) {
    if (-not $Condition) { throw "[KHÔNG ĐẠT] $Label" }
    $script:passes += 1
    Write-Host "[ĐẠT] $Label"
}

function Read-Json([string]$Path) {
    return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Invoke-CheckpointChild([string[]]$Arguments) {
    $allArguments = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', $checkpointTool
    ) + $Arguments
    $previousPreference = $ErrorActionPreference
    try {
        # Các ca âm cố ý ghi stderr; thu mã thoát mà không để PowerShell 5.1
        # chuyển stderr của tiến trình con thành lỗi dừng của runner.
        $ErrorActionPreference = 'SilentlyContinue'
        $null = & powershell.exe @allArguments 2>&1
        return $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
}

try {
    $null = & $portTool -SaveSnapshot $inventoryPath *>&1
    $inventory = Read-Json $inventoryPath
    Assert-True ($inventory.schema -eq 'smartroom.board-port-snapshot' -and $inventory.schema_version -eq 1) 'Snapshot COM giữ đúng schema'
    Assert-True ($inventory.hardware_evidence -eq $false) 'Snapshot COM không tự nhận là bằng chứng phần cứng'

    $null = & $checkpointTool `
        -BaselineSnapshot (Join-Path $fixtures 'ports-baseline.fixture.json') `
        -UnoSnapshot (Join-Path $fixtures 'ports-uno.fixture.json') `
        -Esp32Snapshot (Join-Path $fixtures 'ports-esp32.fixture.json') `
        -UnoRailV 5.01 `
        -Esp32RailV 4.98 `
        -GroundDeltaV 0.02 `
        -OutputPath $nominalPath *>&1
    $nominal = Read-Json $nominalPath
    Assert-True ($nominal.port_mapping.uno -eq 'COM7' -and $nominal.port_mapping.esp32 -eq 'COM8') 'Ánh xạ đúng một COM mới cho từng fixture'
    Assert-True ($nominal.result -eq 'REPORTED_VALUES_WITHIN_RANGE') 'Ba giá trị danh định được phân loại trong dải'
    Assert-True (
        $nominal.review_status -eq 'PENDING_GPT_REVIEW' -and
        $nominal.gate_decision -eq 'CHƯA ĐÁNH GIÁ' -and
        $nominal.hardware_evidence -eq $false -and
        $nominal.acceptance_updates_allowed -eq $false
    ) 'Biên bản danh định vẫn chờ GPT và không mở cập nhật chấp nhận'
    Assert-True (
        @($nominal.measurements).Count -eq 3 -and
        @($nominal.measurements | Where-Object { -not $_.reported_within_range }).Count -eq 0
    ) 'Biên bản ghi đủ ba phép đo nguồn'
    Assert-True ($nominal.evidence_complete_for_review -eq $false) 'Thiếu ảnh thì hồ sơ chưa đủ để duyệt'

    $outOfRangeExit = Invoke-CheckpointChild @(
        '-BaselineSnapshot', (Join-Path $fixtures 'ports-baseline.fixture.json'),
        '-UnoSnapshot', (Join-Path $fixtures 'ports-uno.fixture.json'),
        '-Esp32Snapshot', (Join-Path $fixtures 'ports-esp32.fixture.json'),
        '-UnoRailV', '5.50',
        '-Esp32RailV', '4.98',
        '-GroundDeltaV', '0.02',
        '-OutputPath', $outOfRangePath
    )
    Assert-True ($outOfRangeExit -eq 2) 'Giá trị ngoài dải trả mã dừng 2'
    $outOfRange = Read-Json $outOfRangePath
    Assert-True (
        $outOfRange.result -eq 'STOP_OUT_OF_RANGE' -and
        @($outOfRange.measurements | Where-Object { -not $_.reported_within_range }).id -contains 'G17-HW-PWR-01A'
    ) 'Biên bản ngoài dải chỉ đúng phép đo vi phạm'

    $ambiguousExit = Invoke-CheckpointChild @(
        '-BaselineSnapshot', (Join-Path $fixtures 'ports-baseline.fixture.json'),
        '-UnoSnapshot', (Join-Path $fixtures 'ports-uno.fixture.json'),
        '-Esp32Snapshot', (Join-Path $fixtures 'ports-ambiguous.fixture.json'),
        '-UnoRailV', '5.01',
        '-Esp32RailV', '4.98',
        '-GroundDeltaV', '0.02',
        '-OutputPath', $ambiguousPath
    )
    Assert-True ($ambiguousExit -ne 0) 'Snapshot có hai COM mới bị từ chối'
    Assert-True (-not (Test-Path -LiteralPath $ambiguousPath)) 'COM mơ hồ không tạo biên bản'

    $null = & $serialTool -Port COM999 -DurationSeconds 5 -OutputPath $serialPath -WhatIf *>&1
    Assert-True (-not (Test-Path -LiteralPath $serialPath)) 'Serial WhatIf không cần board và không tạo log'

    $redactionInput = Join-Path $fixtures 'stage17-redaction-input.fixture'
    $redactionExpected = Join-Path $fixtures 'stage17-redaction-expected.fixture'
    $originalBefore = [System.IO.File]::ReadAllText($redactionInput)
    $null = & $redactTool -InputPath $redactionInput -OutputPath $redactionPath -Confirm:$false *>&1
    Assert-True (
        [System.IO.File]::ReadAllText($redactionPath) -ceq [System.IO.File]::ReadAllText($redactionExpected)
    ) 'Công cụ che log khớp chính xác fixture kỳ vọng'
    Assert-True (
        [System.IO.File]::ReadAllText($redactionInput) -ceq $originalBefore
    ) 'Công cụ che log không sửa file nguồn'

    Write-Host "`nTóm tắt hồi quy công cụ phần cứng: $passes đạt, 0 không đạt."
}
finally {
    foreach ($path in @($inventoryPath, $nominalPath, $outOfRangePath, $ambiguousPath, $serialPath, $redactionPath)) {
        if (Test-Path -LiteralPath $path -PathType Leaf) {
            Remove-Item -LiteralPath $path -Force
        }
    }
    if ((Test-Path -LiteralPath $tempDirectory -PathType Container) -and
        @(Get-ChildItem -LiteralPath $tempDirectory -Force).Count -eq 0) {
        Remove-Item -LiteralPath $tempDirectory -Force
    }
}
