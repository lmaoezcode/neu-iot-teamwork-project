[CmdletBinding()]
param(
    [string]$MosquittoHome,
    [ValidateRange(1, 65535)][int]$Port = 1883,
    [string]$BindAddress = '0.0.0.0',
    [switch]$Force
)

. (Join-Path $PSScriptRoot 'Common-Mqtt.ps1')

$homePath = Resolve-MosquittoHome -RequestedHome $MosquittoHome
$paths = Get-MqttProjectPaths
$passwordTool = Join-Path $homePath 'mosquitto_passwd.exe'
$broker = Join-Path $homePath 'mosquitto.exe'

foreach ($required in @($passwordTool, $broker)) {
    if (-not (Test-Path -LiteralPath $required)) { throw "Thiếu công cụ: $required" }
}
if ((Test-Path -LiteralPath $paths.PasswordFile) -and -not $Force) {
    throw "File tài khoản đã tồn tại: $($paths.PasswordFile). Dùng -Force nếu thật sự muốn tạo lại toàn bộ mật khẩu."
}

foreach ($directory in @($paths.Runtime, $paths.Data, $paths.Logs)) {
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
}
if ($Force -and (Test-Path -LiteralPath $paths.PasswordFile)) {
    Remove-Item -LiteralPath $paths.PasswordFile -Force
}

Write-Host 'Tạo mật khẩu cho tài khoản thiết bị room-01-device.' -ForegroundColor Cyan
Write-Host 'Mosquitto sẽ yêu cầu nhập lại mật khẩu; ký tự nhập không được hiển thị.'
& $passwordTool -H sha512-pbkdf2 -c $paths.PasswordFile 'room-01-device'
if ($LASTEXITCODE -ne 0) { throw 'Không tạo được tài khoản thiết bị.' }

Write-Host 'Tạo mật khẩu riêng cho tài khoản dịch vụ smartroom-backend.' -ForegroundColor Cyan
& $passwordTool -H sha512-pbkdf2 $paths.PasswordFile 'smartroom-backend'
if ($LASTEXITCODE -ne 0) { throw 'Không tạo được tài khoản máy chủ.' }

$paths = Write-MqttGeneratedConfig -MosquittoHome $homePath -Port $Port -BindAddress $BindAddress
& $broker -c $paths.GeneratedConfig --test-config
if ($LASTEXITCODE -ne 0) { throw 'Mosquitto từ chối cấu hình vừa tạo.' }

Write-Host ''
Write-Host 'Khởi tạo MQTT hoàn tất.' -ForegroundColor Green
Write-Host "Cấu hình chạy: $($paths.GeneratedConfig)"
Write-Host "ACL: $($paths.Acl)"
Write-Host 'Mật khẩu chỉ được lưu dạng băm trong thư mục runtime bị loại khỏi quản lý mã nguồn.'
