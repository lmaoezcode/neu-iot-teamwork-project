[CmdletBinding()]
param(
    [string]$OutputPath,
    [string]$OwnerUsername = 'chu-phong',
    [string]$MqttUsername = 'smartroom-backend',
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if (-not $OutputPath) { $OutputPath = Join-Path $projectRoot 'config\server.local.env' }
$target = [System.IO.Path]::GetFullPath($OutputPath)
if ((Test-Path -LiteralPath $target) -and -not $Force) {
    throw "File đã tồn tại: $target. Dùng -Force nếu muốn thay thế."
}

$tsx = Join-Path $projectRoot 'server\node_modules\.bin\tsx.CMD'
if (-not (Test-Path -LiteralPath $tsx)) {
    throw 'Chưa có thư viện máy chủ. Hãy chạy pnpm install ở thư mục gốc trước.'
}

function Convert-SecureToPlain {
    param([Parameter(Mandatory = $true)][Security.SecureString]$Value)
    return [System.Net.NetworkCredential]::new('', $Value).Password
}

function Convert-ToEnvValue {
    param([Parameter(Mandatory = $true)][string]$Value)
    if ($Value -match '[\r\n]') { throw 'Giá trị bí mật không được chứa ký tự xuống dòng.' }
    return '"' + ($Value.Replace('\', '\\').Replace('"', '\"')) + '"'
}

$ownerSecure = Read-Host 'Nhập mật khẩu chủ phòng (tối thiểu 12 ký tự)' -AsSecureString
$ownerRepeat = Read-Host 'Nhập lại mật khẩu chủ phòng' -AsSecureString
$mqttSecure = Read-Host 'Nhập mật khẩu MQTT của tài khoản smartroom-backend đã tạo ở Giai đoạn 13' -AsSecureString
$ownerPlain = Convert-SecureToPlain $ownerSecure
$ownerRepeatPlain = Convert-SecureToPlain $ownerRepeat
$mqttPlain = Convert-SecureToPlain $mqttSecure

try {
    if ($ownerPlain -cne $ownerRepeatPlain) { throw 'Hai lần nhập mật khẩu chủ phòng không khớp.' }
    if ($ownerPlain.Length -lt 12) { throw 'Mật khẩu chủ phòng phải có ít nhất 12 ký tự.' }
    if (-not $mqttPlain) { throw 'Mật khẩu MQTT không được để trống.' }

    $previousPassword = $env:OWNER_PASSWORD
    try {
        $env:OWNER_PASSWORD = $ownerPlain
        $passwordHash = (& $tsx (Join-Path $projectRoot 'server\scripts\hash-password.ts')) -join ''
        if ($LASTEXITCODE -ne 0 -or -not $passwordHash.StartsWith('scrypt$')) {
            throw 'Không tạo được mã băm mật khẩu chủ phòng.'
        }
    }
    finally {
        if ($null -eq $previousPassword) { Remove-Item Env:OWNER_PASSWORD -ErrorAction SilentlyContinue }
        else { $env:OWNER_PASSWORD = $previousPassword }
    }

    $sessionBytes = New-Object byte[] 48
    $randomNumberGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $randomNumberGenerator.GetBytes($sessionBytes)
    }
    finally {
        $randomNumberGenerator.Dispose()
    }
    $sessionSecret = [Convert]::ToBase64String($sessionBytes)
    $content = @(
        'NODE_ENV=development',
        'HTTP_HOST=127.0.0.1',
        'HTTP_PORT=3000',
        'WEB_DEV_PORT=5173',
        'WEB_ORIGIN=http://localhost:5173',
        'DEVICE_ID=room-01',
        'DB_FILE=./data/smartroom.sqlite3',
        'RETENTION_DAYS=30',
        'RETENTION_INTERVAL_SECONDS=3600',
        'RETENTION_BATCH_SIZE=500',
        'MQTT_ENABLED=true',
        'MQTT_URL=mqtt://localhost:1883',
        'MQTT_DEVICE_ROOT=smartroom/v1/devices',
        'MQTT_CLIENT_ID=smartroom-backend',
        "MQTT_USERNAME=$MqttUsername",
        ('MQTT_PASSWORD=' + (Convert-ToEnvValue $mqttPlain)),
        "OWNER_USERNAME=$OwnerUsername",
        ('OWNER_PASSWORD_HASH=' + (Convert-ToEnvValue $passwordHash)),
        ('SESSION_SECRET=' + (Convert-ToEnvValue $sessionSecret)),
        'SESSION_TTL_SECONDS=28800',
        'SESSION_COOKIE_NAME=smartroom_session',
        'COOKIE_SECURE=false',
        'SSE_REPLAY_SIZE=256',
        'LOG_LEVEL=info'
    ) -join "`n"
    $directory = Split-Path -Parent $target
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    [System.IO.File]::WriteAllText($target, $content + "`n", [Text.UTF8Encoding]::new($false))
    Write-Host "Đã tạo cấu hình cục bộ: $target" -ForegroundColor Green
    Write-Host 'File này chứa bí mật và đã được .gitignore loại khỏi quản lý mã nguồn.'
}
finally {
    $ownerPlain = $null
    $ownerRepeatPlain = $null
    $mqttPlain = $null
}
