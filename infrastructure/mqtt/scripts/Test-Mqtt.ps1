[CmdletBinding()]
param(
    [string]$MosquittoHome,
    [string]$HostName = '127.0.0.1',
    [ValidateRange(1, 65535)][int]$Port = 1883,
    [Security.SecureString]$DevicePassword,
    [Security.SecureString]$BackendPassword
)

. (Join-Path $PSScriptRoot 'Common-Mqtt.ps1')

$homePath = Resolve-MosquittoHome -RequestedHome $MosquittoHome
$publisher = Join-Path $homePath 'mosquitto_pub.exe'
$subscriber = Join-Path $homePath 'mosquitto_sub.exe'
foreach ($required in @($publisher, $subscriber)) {
    if (-not (Test-Path -LiteralPath $required)) { throw "Thiếu công cụ: $required" }
}

$deviceSecret = $DevicePassword
$backendSecret = $BackendPassword
if (-not $deviceSecret) { $deviceSecret = Read-Host 'Mật khẩu room-01-device' -AsSecureString }
if (-not $backendSecret) { $backendSecret = Read-Host 'Mật khẩu smartroom-backend' -AsSecureString }
$paths = Get-MqttProjectPaths
New-Item -ItemType Directory -Force -Path $paths.Runtime | Out-Null
$temporary = Join-Path $paths.Runtime ("test-temp-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporary | Out-Null
$failures = New-Object System.Collections.Generic.List[string]
$passes = New-Object System.Collections.Generic.List[string]

function Invoke-Client {
    param([string]$Executable, [string[]]$Arguments)
    $captured = & $Executable @Arguments 2>&1 | Out-String
    return [pscustomobject]@{ ExitCode = $LASTEXITCODE; Output = $captured.Trim() }
}

function Add-Result {
    param([string]$Name, [bool]$Passed, [string]$Detail)
    if ($Passed) {
        $script:passes.Add($Name)
        Write-Host "[ĐẠT] $Name" -ForegroundColor Green
    }
    else {
        $script:failures.Add("$Name — $Detail")
        Write-Host "[KHÔNG ĐẠT] $Name — $Detail" -ForegroundColor Red
    }
}

try {
    $deviceConfig = New-MqttClientConfig -Directory $temporary -Name 'device' -Username 'room-01-device' -Password $deviceSecret
    $backendConfig = New-MqttClientConfig -Directory $temporary -Name 'backend' -Username 'smartroom-backend' -Password $backendSecret
    $wrongSecret = ConvertTo-SecureString ("wrong-" + [Guid]::NewGuid().ToString('N')) -AsPlainText -Force
    $wrongConfig = New-MqttClientConfig -Directory $temporary -Name 'wrong-password' -Username 'room-01-device' -Password $wrongSecret

    $base = @('-h', $HostName, '-p', [string]$Port)
    $root = 'smartroom/v1/devices'
    $ownAvailability = "$root/room-01/availability"
    $ownDesired = "$root/room-01/config/desired"
    $otherAvailability = "$root/room-02/availability"
    $nonce = [Guid]::NewGuid().ToString('N')

    $anonymous = Invoke-Client $publisher ($base + @('-V', 'mqttv311', '-t', $ownAvailability, '-m', 'anonymous-denied', '-q', '1'))
    Add-Result 'Kết nối ẩn danh bị từ chối' ($anonymous.ExitCode -ne 0) "exit=$($anonymous.ExitCode)"

    $wrongAuthentication = Invoke-Client $publisher (@('-o', $wrongConfig) + $base + @('-t', $ownAvailability, '-m', 'wrong-password-denied', '-q', '1'))
    Add-Result 'Mật khẩu sai bị từ chối' ($wrongAuthentication.ExitCode -ne 0) "exit=$($wrongAuthentication.ExitCode)"

    foreach ($topic in @($ownAvailability, $ownDesired, $otherAvailability)) {
        $clear = Invoke-Client $publisher (@('-o', $backendConfig) + $base + @('-t', $topic, '-n', '-r', '-q', '1'))
        if ($clear.ExitCode -ne 0) { throw "Không xóa được retained topic ${topic}: $($clear.Output)" }
    }

    $availabilityPayload = "{`"test_id`":`"$nonce`",`"status`":`"online`"}"
    $ownWrite = Invoke-Client $publisher (@('-o', $deviceConfig) + $base + @('-t', $ownAvailability, '-m', $availabilityPayload, '-r', '-q', '1'))
    Add-Result 'Thiết bị được ghi availability của chính nó' ($ownWrite.ExitCode -eq 0) $ownWrite.Output

    $backendRead = Invoke-Client $subscriber (@('-o', $backendConfig) + $base + @('-t', $ownAvailability, '-C', '1', '-W', '3'))
    Add-Result 'Máy chủ đọc được retained state của thiết bị' (($backendRead.ExitCode -eq 0) -and ($backendRead.Output -eq $availabilityPayload)) "exit=$($backendRead.ExitCode), payload=$($backendRead.Output)"

    $unauthorizedDesired = Invoke-Client $publisher (@('-o', $deviceConfig) + $base + @('-t', $ownDesired, '-m', 'device-must-not-write', '-r', '-q', '1'))
    $checkDesiredEmpty = Invoke-Client $subscriber (@('-o', $backendConfig) + $base + @('--quiet', '-t', $ownDesired, '-C', '1', '-W', '2'))
    Add-Result 'Thiết bị không thể ghi config/desired' (($checkDesiredEmpty.ExitCode -ne 0) -and [string]::IsNullOrWhiteSpace($checkDesiredEmpty.Output)) "publish_exit=$($unauthorizedDesired.ExitCode), observed=$($checkDesiredEmpty.Output)"

    $desiredPayload = "{`"test_id`":`"$nonce`",`"config_version`":1}"
    $backendWrite = Invoke-Client $publisher (@('-o', $backendConfig) + $base + @('-t', $ownDesired, '-m', $desiredPayload, '-r', '-q', '1'))
    $deviceRead = Invoke-Client $subscriber (@('-o', $deviceConfig) + $base + @('-t', $ownDesired, '-C', '1', '-W', '3'))
    Add-Result 'Máy chủ ghi và thiết bị đọc config/desired' (($backendWrite.ExitCode -eq 0) -and ($deviceRead.ExitCode -eq 0) -and ($deviceRead.Output -eq $desiredPayload)) "pub_exit=$($backendWrite.ExitCode), sub_exit=$($deviceRead.ExitCode), payload=$($deviceRead.Output)"

    $unauthorizedOther = Invoke-Client $publisher (@('-o', $deviceConfig) + $base + @('-t', $otherAvailability, '-m', 'cross-device-denied', '-r', '-q', '1'))
    $checkOtherEmpty = Invoke-Client $subscriber (@('-o', $backendConfig) + $base + @('--quiet', '-t', $otherAvailability, '-C', '1', '-W', '2'))
    Add-Result 'Thiết bị không thể ghi topic phòng khác' (($checkOtherEmpty.ExitCode -ne 0) -and [string]::IsNullOrWhiteSpace($checkOtherEmpty.Output)) "publish_exit=$($unauthorizedOther.ExitCode), observed=$($checkOtherEmpty.Output)"

    $otherPayload = "{`"test_id`":`"$nonce`",`"status`":`"other-room`"}"
    [void](Invoke-Client $publisher (@('-o', $backendConfig) + $base + @('-t', $otherAvailability, '-m', $otherPayload, '-r', '-q', '1')))
    $unauthorizedOtherRead = Invoke-Client $subscriber (@('-o', $deviceConfig) + $base + @('--quiet', '-t', $otherAvailability, '-C', '1', '-W', '2'))
    Add-Result 'Thiết bị không thể đọc topic phòng khác' (($unauthorizedOtherRead.ExitCode -ne 0) -and ($unauthorizedOtherRead.Output -ne $otherPayload)) "exit=$($unauthorizedOtherRead.ExitCode), observed=$($unauthorizedOtherRead.Output)"

    foreach ($topic in @($ownAvailability, $ownDesired, $otherAvailability)) {
        [void](Invoke-Client $publisher (@('-o', $backendConfig) + $base + @('-t', $topic, '-n', '-r', '-q', '1')))
    }
}
finally {
    if (Test-Path -LiteralPath $temporary) {
        Remove-Item -LiteralPath $temporary -Recurse -Force
    }
    $deviceSecret = $null
    $backendSecret = $null
    $wrongSecret = $null
}

Write-Host ''
Write-Host "Kết quả: $($passes.Count) đạt, $($failures.Count) không đạt."
if ($failures.Count -gt 0) {
    $failures | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
    exit 1
}
exit 0
