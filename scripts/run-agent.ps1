# PowerShell Host Telemetry Agent Launcher for Windows
param (
    [string]$Server = "ws://localhost:9876/api/v1/kuro/ws/node",
    [string]$Secret = ""
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Homelab Host Telemetry Agent (Windows)  " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Connecting to containerized Homelab server at: $Server" -ForegroundColor Green

if (-not (Test-Path "..\backend")) {
    Write-Warning "Backend source directory not found. Please run this script from the docker directory."
}

# Run the native Go collector on Windows
Write-Host "Starting native Windows system collector..." -ForegroundColor Yellow
$env:KURO_NODE_SERVER = $Server
if ($Secret) { $env:KURO_NODE_SECRET = $Secret }

go run ..\backend\cmd\poco-console
