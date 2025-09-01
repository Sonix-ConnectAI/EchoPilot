# EchoPilot AI - PowerShell Startup Script
# Run this script to start all services for local or external access

param(
    [switch]$External = $false,
    [switch]$SkipDependencies = $false
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "EchoPilot AI - Service Startup Script" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "ERROR: .env file not found!" -ForegroundColor Red
    Write-Host "Creating .env from .env.example..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    Write-Host "Please configure .env file and run this script again." -ForegroundColor Yellow
    
    if ($External) {
        Write-Host ""
        Write-Host "IMPORTANT for External Access:" -ForegroundColor Yellow
        Write-Host "1. Edit .env file" -ForegroundColor Yellow
        Write-Host "2. Replace 127.0.0.1 with your server IP in all REACT_APP_* variables" -ForegroundColor Yellow
        Write-Host "3. Example: REACT_APP_API_BASE_URL=http://192.168.1.100:5000" -ForegroundColor Yellow
    }
    
    Read-Host "Press Enter to exit"
    exit 1
}

# Check Python backend .env
if (-not (Test-Path "python_backend\.env")) {
    Write-Host "Creating python_backend\.env from example..." -ForegroundColor Yellow
    Copy-Item "python_backend\.env.example" "python_backend\.env"
}

# Install dependencies unless skipped
if (-not $SkipDependencies) {
    Write-Host "Installing Python dependencies..." -ForegroundColor Green
    Push-Location python_backend
    & python -m pip install -r requirements.txt
    Pop-Location
    
    Write-Host ""
    Write-Host "Checking Node.js dependencies..." -ForegroundColor Green
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing Node.js dependencies..." -ForegroundColor Yellow
        & npm ci
    }
}

Write-Host ""
Write-Host "Starting services..." -ForegroundColor Green
Write-Host ""

# Get local IP address
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.254.*"} | Select-Object -First 1).IPAddress

if ($External) {
    Write-Host "Starting services for EXTERNAL access..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Services will be available at:" -ForegroundColor Green
    Write-Host "  - Frontend: http://${localIP}:3000" -ForegroundColor White
    Write-Host "  - Python Backend: http://${localIP}:5000" -ForegroundColor White
    Write-Host "  - API Proxy: http://${localIP}:5001" -ForegroundColor White
    Write-Host "  - WebSocket: ws://${localIP}:3002" -ForegroundColor White
    Write-Host ""
    Write-Host "Make sure Windows Firewall allows these ports!" -ForegroundColor Yellow
    Write-Host ""
    
    # Set environment variables for external access
    $env:DANGEROUSLY_DISABLE_HOST_CHECK = "true"
    $env:HOST = "0.0.0.0"
    
    & npm run start:all-external
} else {
    Write-Host "Starting services for LOCAL access..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Services will be available at:" -ForegroundColor Green
    Write-Host "  - Frontend: http://localhost:3000" -ForegroundColor White
    Write-Host "  - Python Backend: http://localhost:5000" -ForegroundColor White
    Write-Host "  - API Proxy: http://localhost:5001" -ForegroundColor White
    Write-Host "  - WebSocket: ws://localhost:3002" -ForegroundColor White
    Write-Host ""
    
    & npm run start:all
}

Read-Host "Press Enter to stop all services"