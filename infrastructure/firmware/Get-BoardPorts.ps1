[CmdletBinding()]
param(
    [ValidateNotNullOrEmpty()]
    [string]$SaveSnapshot,

    [ValidateNotNullOrEmpty()]
    [string]$CompareSnapshot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-PortInventory {
    $portNames = @([System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object)
    $entities = @(Get-CimInstance Win32_PnPEntity -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '\(COM[0-9]+\)' })

    foreach ($port in $portNames) {
        $escaped = [Regex]::Escape($port)
        $entity = $entities | Where-Object { $_.Name -match "\($escaped\)" } | Select-Object -First 1
        $name = if ($entity) { [string]$entity.Name } else { 'Không đọc được mô tả thiết bị' }
        $hint = if ($name -match 'CH340|CH341|USB-SERIAL') {
            'Có thể là UNO hoặc ESP32 dùng CH340; chỉ xác nhận bằng chênh lệch rút/cắm.'
        }
        elseif ($name -match 'CP210|Silicon Labs') {
            'Có thể là ESP32 dùng CP210x; vẫn phải xác nhận bằng chênh lệch rút/cắm.'
        }
        elseif ($name -match 'Arduino') {
            'Windows nhận diện là Arduino; vẫn phải xác nhận đúng board đang cắm.'
        }
        else {
            'Chưa xác định; rút/cắm từng board để đối chiếu.'
        }

        [PSCustomObject]@{
            Port = $port
            Name = $name
            Hint = $hint
        }
    }
}

$current = @(Get-PortInventory)
$prior = @()
if ($CompareSnapshot) {
    $comparePath = [System.IO.Path]::GetFullPath($CompareSnapshot)
    if (-not (Test-Path -LiteralPath $comparePath -PathType Leaf)) {
        throw "Không tìm thấy snapshot để so sánh: $comparePath"
    }
    $snapshot = Get-Content -LiteralPath $comparePath -Raw | ConvertFrom-Json
    if ($snapshot.schema -ne 'smartroom.board-port-snapshot' -or $snapshot.schema_version -ne 1) {
        throw 'Snapshot COM không đúng schema smartroom.board-port-snapshot phiên bản 1.'
    }
    $prior = @($snapshot.ports)
}

$priorByPort = @{}
foreach ($item in $prior) { $priorByPort[[string]$item.port] = $item }
$currentByPort = @{}
$result = @()
foreach ($item in $current) {
    $currentByPort[$item.Port] = $item
    $change = if ($CompareSnapshot) {
        if ($priorByPort.ContainsKey($item.Port)) { 'Không đổi' } else { 'Mới xuất hiện' }
    }
    else { 'Hiện có' }
    $result += [PSCustomObject]@{
        Port = $item.Port
        Change = $change
        Name = $item.Name
        Hint = $item.Hint
    }
}
foreach ($item in $prior) {
    $port = [string]$item.port
    if (-not $currentByPort.ContainsKey($port)) {
        $result += [PSCustomObject]@{
            Port = $port
            Change = 'Đã biến mất'
            Name = [string]$item.name
            Hint = 'Cổng có trong snapshot trước nhưng không còn ở lần chụp hiện tại.'
        }
    }
}

if ($SaveSnapshot) {
    $savePath = [System.IO.Path]::GetFullPath($SaveSnapshot)
    $directory = Split-Path -Parent $savePath
    if ($directory) { New-Item -ItemType Directory -Force -Path $directory | Out-Null }
    $payload = [ordered]@{
        schema = 'smartroom.board-port-snapshot'
        schema_version = 1
        captured_at = [DateTimeOffset]::UtcNow.ToString('o')
        scope = 'ẢNH CHỤP COM — cần người dùng xác nhận board bằng thao tác rút/cắm'
        hardware_evidence = $false
        ports = @($current | ForEach-Object {
            [ordered]@{ port = $_.Port; name = $_.Name; hint = $_.Hint }
        })
    }
    [System.IO.File]::WriteAllText(
        $savePath,
        (($payload | ConvertTo-Json -Depth 5) + "`n"),
        [System.Text.UTF8Encoding]::new($false)
    )
    Write-Host "Đã lưu snapshot COM: $savePath" -ForegroundColor Green
    Write-Host 'Snapshot chỉ là dữ liệu hỗ trợ; hardware_evidence=false và không tự nhận diện board.' -ForegroundColor Yellow
}

if ($current.Count -eq 0) {
    Write-Warning 'Không phát hiện cổng COM. Snapshot rỗng vẫn có thể dùng làm mốc trước khi cắm board.'
}

$result | Sort-Object Port, Change
