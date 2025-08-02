#!/usr/bin/env powershell
# Simple Build Script for PulseIntel Go Engine

Write-Host "Building PulseIntel Go Engine..." -ForegroundColor Green

# Navigate to the correct directory
Set-Location "G:\python files\precision9\pulseintel\go_Stream"

# Build the executable
go build -o pulseintel_engine.exe ./cmd/main.go

if (Test-Path "pulseintel_engine.exe") {
    Write-Host "Build successful! Created: pulseintel_engine.exe" -ForegroundColor Green
} else {
    Write-Host "Build failed!" -ForegroundColor Red
}