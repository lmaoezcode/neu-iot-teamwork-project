[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,

    [string]$OutputPath,

    [switch]$KeepLanIp
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$source = [System.IO.Path]::GetFullPath($InputPath)
if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Không tìm thấy log: $source" }

$leaf = [System.IO.Path]::GetFileName($source)
if ($leaf -match '^(?:secrets\.hpp|server\.local\.env|\.env(?:\..*)?)$') {
    throw 'Không dùng công cụ này để chia sẻ file bí mật. Chỉ xử lý log chẩn đoán đã xuất.'
}

if (-not $OutputPath) {
    $outputDirectory = Join-Path $projectRoot 'data\logs\hardware'
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($source)
    $OutputPath = Join-Path $outputDirectory "$baseName.redacted.log"
}
$target = [System.IO.Path]::GetFullPath($OutputPath)
if ($source -eq $target) { throw 'OutputPath phải khác InputPath để giữ nguyên log gốc.' }

$content = [System.IO.File]::ReadAllText($source)
$content = [Regex]::Replace(
    $content,
    '(?is)-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----',
    '[PRIVATE_KEY_REDACTED]'
)
$content = [Regex]::Replace(
    $content,
    '(?im)(\bauthorization\b\s*[:=]\s*)(?:Basic|Bearer)\s+[^\r\n,;]+',
    '$1[REDACTED]'
)
$content = [Regex]::Replace($content, '(?i)\bBearer\s+[A-Za-z0-9._~+/=-]+', 'Bearer [REDACTED]')
$content = [Regex]::Replace($content, '(?i)(smartroom_session=)[^;\s]+', '$1[REDACTED]')
$content = [Regex]::Replace(
    $content,
    '(?im)(\b(?:password|passwd|token|secret|cookie|ssid)\b\s*[:=]\s*)(?:"[^"]*"|''[^'']*''|[^\s,;]+)',
    '$1[REDACTED]'
)
$content = [Regex]::Replace($content, '(?i)(mqtts?://)[^/@\s]+@', '$1[USERINFO_REDACTED]@')
$content = [Regex]::Replace($content, '(?i)\b(?:[0-9A-F]{2}[:-]){5}[0-9A-F]{2}\b', '[MAC_REDACTED]')
if (-not $KeepLanIp) {
    $content = [Regex]::Replace(
        $content,
        '\b(?:\d{1,3}\.){3}\d{1,3}\b',
        { param($match) if ($match.Value.StartsWith('127.')) { $match.Value } else { '[IP_REDACTED]' } }
    )
}

if ($content -match '-----BEGIN [A-Z ]*PRIVATE KEY-----') {
    throw 'Không che được toàn bộ private key; không tạo bản chia sẻ.'
}

if ($PSCmdlet.ShouldProcess($target, 'Ghi bản log đã che thông tin nhạy cảm')) {
    $directory = Split-Path -Parent $target
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    [System.IO.File]::WriteAllText($target, $content, [Text.UTF8Encoding]::new($false))
    Write-Host "Đã tạo bản log để rà soát trước khi chia sẻ: $target" -ForegroundColor Green
    Write-Host 'Vẫn phải mở bản đã che và kiểm tra thủ công trước khi gửi.' -ForegroundColor Yellow
}
