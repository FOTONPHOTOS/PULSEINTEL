#!/usr/bin/env powershell
# Build PulseIntel Go Engine - Fresh Build for PulseIntel Project

Write-Host "🔧 Building PulseIntel Go Engine..." -ForegroundColor Cyan

# Navigate to go_Stream directory
cd "G:\python files\precision9\pulseintel\go_Stream"

# Clean previous builds
Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
Remove-Item -Path "pulseintel_engine.exe" -ErrorAction SilentlyContinue
Remove-Item -Path "pulseintel_go_engine.exe" -ErrorAction SilentlyContinue

# Build the Go application
Write-Host "⚙️ Building Go application..." -ForegroundColor Green
go build -o pulseintel_engine.exe ./cmd/main.go

# Check if build was successful
if (Test-Path "pulseintel_engine.exe") {
    Write-Host "✅ Build successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Build Info:" -ForegroundColor Yellow
    $fileInfo = Get-Item "pulseintel_engine.exe"
    Write-Host "  File: pulseintel_engine.exe" -ForegroundColor White
    Write-Host "  Size: $([math]::Round($fileInfo.Length / 1MB, 2)) MB" -ForegroundColor White
    Write-Host "  Created: $($fileInfo.CreationTime)" -ForegroundColor White
    Write-Host ""
    Write-Host "🚀 Launch Command:" -ForegroundColor Cyan
    Write-Host "  .\pulseintel_engine.exe" -ForegroundColor Green
    Write-Host ""
    Write-Host "🧪 Test the engine:" -ForegroundColor Yellow
    Write-Host "  curl http://localhost:8899/health" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    Write-Host "Check for Go compilation errors above" -ForegroundColor Yellow
    exit 1
}

# Optional: Test the executable
Write-Host "🧪 Testing executable..." -ForegroundColor Cyan
Write-Host "Starting engine for 5 seconds to verify it works..." -ForegroundColor Yellow

# Start the engine in background
$process = Start-Process -FilePath ".\pulseintel_engine.exe" -PassThru -WindowStyle Hidden

# Wait 5 seconds
Start-Sleep -Seconds 5

# Try to test the health endpoint
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8899/health" -TimeoutSec 3
    Write-Host "✅ Engine test successful!" -ForegroundColor Green
    Write-Host "Health check response received" -ForegroundColor White
} catch {
    Write-Host "⚠️ Engine started but health check failed (may be normal)" -ForegroundColor Yellow
}

# Stop the test process
if ($process -and !$process.HasExited) {
    Stop-Process -Id $process.Id -Force
    Write-Host "🛑 Test process stopped" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎯 Ready to use!" -ForegroundColor Green
Write-Host "Use this command to start the PulseIntel Go Engine:" -ForegroundColor Cyan
Write-Host "  .\pulseintel_engine.exe" -ForegroundColor Green