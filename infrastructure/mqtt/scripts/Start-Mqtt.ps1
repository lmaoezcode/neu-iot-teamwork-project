[CmdletBinding()]
param([string]$MosquittoHome)

. (Join-Path $PSScriptRoot 'Common-Mqtt.ps1')

$homePath = Resolve-MosquittoHome -RequestedHome $MosquittoHome
$paths = Get-MqttProjectPaths
$broker = Join-Path $homePath 'mosquitto.exe'
if (-not (Test-Path -LiteralPath $paths.GeneratedConfig)) {
    throw 'Chưa có cấu hình chạy. Hãy chạy Initialize-Mqtt.ps1 trước.'
}
if (-not (Test-Path -LiteralPath $paths.PasswordFile)) {
    throw 'Chưa có file tài khoản. Hãy chạy Initialize-Mqtt.ps1 trước.'
}

& $broker -c $paths.GeneratedConfig --test-config
if ($LASTEXITCODE -ne 0) { throw 'Cấu hình Mosquitto không hợp lệ.' }

Write-Host 'Mosquitto đang chạy ở tiền cảnh. Nhấn Ctrl+C để dừng.' -ForegroundColor Green
& $broker -c $paths.GeneratedConfig -v
exit $LASTEXITCODE

