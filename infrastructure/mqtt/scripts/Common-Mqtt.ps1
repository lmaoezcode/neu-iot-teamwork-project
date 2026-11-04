Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-MosquittoHome {
    param([string]$RequestedHome)

    $candidates = @()
    if ($RequestedHome) { $candidates += $RequestedHome }
    if ($env:MOSQUITTO_HOME) { $candidates += $env:MOSQUITTO_HOME }
    $candidates += @(
        'C:\Program Files\Mosquitto',
        'C:\Program Files\mosquitto',
        (Join-Path $PSScriptRoot '..\..\..\tools\.mosquitto')
    )

    $fromPath = Get-Command mosquitto.exe -ErrorAction SilentlyContinue
    if ($fromPath) { $candidates += (Split-Path -Parent $fromPath.Source) }

    foreach ($candidate in $candidates) {
        if (-not $candidate) { continue }
        $resolved = [System.IO.Path]::GetFullPath($candidate)
        if (Test-Path -LiteralPath (Join-Path $resolved 'mosquitto.exe')) {
            return $resolved
        }
    }

    throw 'Không tìm thấy Mosquitto. Cài Mosquitto 2.1.x hoặc truyền -MosquittoHome.'
}

function Get-MqttProjectPaths {
    $mqttRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
    $runtime = Join-Path $mqttRoot 'runtime'
    return [ordered]@{
        Root = $mqttRoot
        Runtime = $runtime
        Data = Join-Path $runtime 'data'
        Logs = Join-Path $runtime 'logs'
        PasswordFile = Join-Path $runtime 'passwords'
        GeneratedConfig = Join-Path $runtime 'mosquitto.generated.conf'
        Template = Join-Path $mqttRoot 'mosquitto.conf.template'
        Acl = Join-Path $mqttRoot 'acl'
        LogFile = Join-Path $runtime 'logs\mosquitto.log'
    }
}

function ConvertTo-MosquittoPath {
    param([Parameter(Mandatory = $true)][string]$Path)
    return ([System.IO.Path]::GetFullPath($Path) -replace '\\', '/')
}

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Write-MqttGeneratedConfig {
    param(
        [Parameter(Mandatory = $true)][string]$MosquittoHome,
        [int]$Port = 1883,
        [string]$BindAddress = '0.0.0.0'
    )

    if ($Port -lt 1 -or $Port -gt 65535) { throw 'Port phải nằm trong 1..65535.' }
    if (-not $BindAddress) { throw 'BindAddress không được để trống.' }

    $paths = Get-MqttProjectPaths
    foreach ($directory in @($paths.Runtime, $paths.Data, $paths.Logs)) {
        New-Item -ItemType Directory -Force -Path $directory | Out-Null
    }

    $passwordPlugin = Join-Path $MosquittoHome 'mosquitto_password_file.dll'
    $aclPlugin = Join-Path $MosquittoHome 'mosquitto_acl_file.dll'
    foreach ($required in @($passwordPlugin, $aclPlugin, $paths.Template, $paths.Acl)) {
        if (-not (Test-Path -LiteralPath $required)) {
            throw "Thiếu file bắt buộc: $required. Cần Mosquitto 2.1.x bản chính thức."
        }
    }

    $dataDir = (ConvertTo-MosquittoPath $paths.Data).TrimEnd('/') + '/'
    $content = [System.IO.File]::ReadAllText($paths.Template)
    $replacements = [ordered]@{
        '{{PASSWORD_PLUGIN}}' = ConvertTo-MosquittoPath $passwordPlugin
        '{{PASSWORD_FILE}}' = ConvertTo-MosquittoPath $paths.PasswordFile
        '{{ACL_PLUGIN}}' = ConvertTo-MosquittoPath $aclPlugin
        '{{ACL_FILE}}' = ConvertTo-MosquittoPath $paths.Acl
        '{{PORT}}' = [string]$Port
        '{{BIND_ADDRESS}}' = $BindAddress
        '{{DATA_DIR}}' = $dataDir
        '{{LOG_FILE}}' = ConvertTo-MosquittoPath $paths.LogFile
    }
    foreach ($entry in $replacements.GetEnumerator()) {
        $content = $content.Replace($entry.Key, $entry.Value)
    }
    if ($content -match '\{\{[A-Z_]+\}\}') { throw 'Cấu hình còn token chưa được thay thế.' }
    Write-Utf8NoBom -Path $paths.GeneratedConfig -Content $content
    return $paths
}

function New-MqttClientConfig {
    param(
        [Parameter(Mandatory = $true)][string]$Directory,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Username,
        [Parameter(Mandatory = $true)][Security.SecureString]$Password
    )

    $plain = [System.Net.NetworkCredential]::new('', $Password).Password
    try {
        if ($plain -match '[\r\n]') { throw 'Mật khẩu không được chứa ký tự xuống dòng.' }
        $path = Join-Path $Directory "$Name.conf"
        Write-Utf8NoBom -Path $path -Content "-u $Username`n-P $plain`n-V mqttv311`n"
        return $path
    }
    finally {
        $plain = $null
    }
}

