# PowerShell Host Telemetry Agent for Windows
# Feeds real physical hardware telemetry (CPU, RAM, Disks, Battery, OS) into containerized Homelab
param (
    [string]$Server = "http://localhost:9876",
    [int]$IntervalSeconds = 5,
    [switch]$Once
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  Homelab Physical Host Telemetry Agent (Windows) " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "Target Server: $Server" -ForegroundColor Green
Write-Host "Sync Interval: $IntervalSeconds second(s)" -ForegroundColor Green

$endpoint = "$($Server.TrimEnd('/'))/api/v1/host/telemetry"

function Get-HostTelemetryPayload {
    $os = Get-CimInstance Win32_OperatingSystem
    $cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
    $bat = Get-CimInstance Win32_Battery | Select-Object -First 1
    $disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3"

    # Memory
    $totalRamBytes = [uint64]($os.TotalVisibleMemorySize * 1024)
    $freeRamBytes = [uint64]($os.FreePhysicalMemory * 1024)
    $usedRamBytes = $totalRamBytes - $freeRamBytes
    $ramUsagePct = 0.0
    if ($totalRamBytes -gt 0) {
        $ramUsagePct = [Math]::Round(($usedRamBytes / $totalRamBytes) * 100, 1)
    }

    # CPU
    $cpuUsage = 0.0
    if ($cpu.LoadPercentage -ne $null) {
        $cpuUsage = [double]$cpu.LoadPercentage
    }

    # Battery
    $batteryInfo = @{
        present = ($bat -ne $null)
        capacity = if ($bat) { [int]$bat.EstimatedChargeRemaining } else { 0 }
        status = if ($bat) {
            switch ($bat.BatteryStatus) {
                1 { "Discharging" }
                2 { "AC Connected (Unknown)" }
                3 { "Fully Charged" }
                4 { "Low" }
                5 { "Critical" }
                6 { "Charging" }
                7 { "Charging and High" }
                8 { "Charging and Low" }
                9 { "Charging and Critical" }
                default { "Discharging" }
            }
        } else { "Unknown" }
        power_source = if ($bat -and ($bat.BatteryStatus -in 2,3,6,7,8,9)) { "AC" } else { "Battery" }
    }

    # Storage Mounts
    $mounts = @()
    [uint64]$totalStorageBytes = 0
    [uint64]$usedStorageBytes = 0
    [uint64]$freeStorageBytes = 0

    foreach ($d in $disks) {
        [uint64]$dSize = [uint64]$d.Size
        [uint64]$dFree = [uint64]$d.FreeSpace
        [uint64]$dUsed = $dSize - $dFree
        $dPct = 0.0
        if ($dSize -gt 0) {
            $dPct = [Math]::Round(($dUsed / $dSize) * 100, 1)
        }
        $mounts += @{
            device = $d.DeviceID
            mount = "$($d.DeviceID)\"
            filesystem = if ($d.FileSystem) { $d.FileSystem } else { "NTFS" }
            total = $dSize
            used = $dUsed
            available = $dFree
            usage_percent = $dPct
            read_only = $false
            type = "user"
        }
        $totalStorageBytes += $dSize
        $usedStorageBytes += $dUsed
        $freeStorageBytes += $dFree
    }

    $totalStoragePct = 0.0
    if ($totalStorageBytes -gt 0) {
        $totalStoragePct = [Math]::Round(($usedStorageBytes / $totalStorageBytes) * 100, 1)
    }

    # Uptime in seconds
    $uptimeSeconds = [uint64]0
    if ($os.LastBootUpTime) {
        $uptimeSeconds = [uint64]([DateTime]::UtcNow - $os.LastBootUpTime.ToUniversalTime()).TotalSeconds
    }

    return @{
        system = @{
            os = $os.Caption
            hostname = $env:COMPUTERNAME
            uptime = $uptimeSeconds
        }
        cpu = @{
            model = $cpu.Name
            usage_percent = $cpuUsage
            logical_cores = [int]$cpu.NumberOfLogicalProcessors
            physical_cores = [int]$cpu.NumberOfCores
            frequency_mhz = [int]$cpu.MaxClockSpeed
        }
        memory = @{
            total = $totalRamBytes
            free = $freeRamBytes
            available = $freeRamBytes
            used = $usedRamBytes
            usage_percent = $ramUsagePct
        }
        battery = $batteryInfo
        storage = @{
            total = $totalStorageBytes
            used = $usedStorageBytes
            free = $freeStorageBytes
            available = $freeStorageBytes
            usage_percent = $totalStoragePct
            percentage = $totalStoragePct
            summary = @{
                total_capacity = $totalStorageBytes
                used = $usedStorageBytes
                free = $freeStorageBytes
                physical_volumes = $mounts.Count
            }
            mounts = $mounts
        }
    }
}

Write-Host "Telemetry collection active. Press Ctrl+C to terminate." -ForegroundColor Yellow

while ($true) {
    try {
        $payload = Get-HostTelemetryPayload
        $json = $payload | ConvertTo-Json -Depth 6
        $res = Invoke-RestMethod -Uri $endpoint -Method Post -Body $json -ContentType "application/json" -Headers @{ "X-Host-Agent" = "windows-powershell-agent" } -TimeoutSec 3
        Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] Telemetry synced: RAM $([Math]::Round($payload.memory.used/1GB, 1))/$([Math]::Round($payload.memory.total/1GB, 1)) GB, CPU $($payload.cpu.usage_percent)%, Disks: $($payload.storage.mounts.Count)" -ForegroundColor Green
    }
    catch {
        Write-Warning "[$((Get-Date).ToString('HH:mm:ss'))] Failed to push telemetry: $_"
    }

    if ($Once) {
        break
    }
    Start-Sleep -Seconds $IntervalSeconds
}
