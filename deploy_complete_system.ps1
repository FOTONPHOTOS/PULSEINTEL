#!/usr/bin/env pwsh
# Complete PulseIntel System Deployment Script

Write-Host "🚀 DEPLOYING COMPLETE PULSEINTEL SYSTEM" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Check if Railway CLI is installed
if (-not (Get-Command railway -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Railway CLI not found. Please install it first:" -ForegroundColor Red
    Write-Host "npm install -g @railway/cli" -ForegroundColor Yellow
    exit 1
}

# Login check
Write-Host "🔐 Checking Railway authentication..." -ForegroundColor Blue
railway auth

# Get current project info
$projectInfo = railway status --json | ConvertFrom-Json
$projectId = $projectInfo.project.id
Write-Host "📋 Project ID: $projectId" -ForegroundColor Cyan

# Step 1: Deploy Go Engine (if not already deployed)
Write-Host "`n🔧 Step 1: Checking Go Engine deployment..." -ForegroundColor Blue
$goService = railway service list --json | ConvertFrom-Json | Where-Object { $_.name -eq "pulseintel-go" }

if (-not $goService) {
    Write-Host "📦 Deploying Go Engine..." -ForegroundColor Yellow
    railway service create --name pulseintel-go
    railway deploy --service pulseintel-go --config railway.json
    Write-Host "✅ Go Engine deployed" -ForegroundColor Green
} else {
    Write-Host "✅ Go Engine already deployed" -ForegroundColor Green
}

# Get Go Engine URL
$goServiceUrl = railway service show pulseintel-go --json | ConvertFrom-Json | Select-Object -ExpandProperty url
$goWebSocketUrl = $goServiceUrl -replace "https://", "wss://" -replace "http://", "ws://"
$goWebSocketUrl = "$goWebSocketUrl/ws"

Write-Host "🔗 Go Engine WebSocket URL: $goWebSocketUrl" -ForegroundColor Cyan

# Step 2: Deploy Python WebSocket Service
Write-Host "`n🔧 Step 2: Deploying Python WebSocket Service..." -ForegroundColor Blue
railway service create --name pulseintel-websocket
railway variables set GO_STREAM_URL="$goWebSocketUrl" --service pulseintel-websocket
railway deploy --service pulseintel-websocket --config railway-websocket.json
Write-Host "✅ Python WebSocket Service deployed" -ForegroundColor Green

# Step 3: Deploy Python API Service
Write-Host "`n🔧 Step 3: Deploying Python API Service..." -ForegroundColor Blue
railway service create --name pulseintel-api
railway deploy --service pulseintel-api --config railway-api.json
Write-Host "✅ Python API Service deployed" -ForegroundColor Green

# Step 4: Deploy React Frontend
Write-Host "`n🔧 Step 4: Deploying React Frontend..." -ForegroundColor Blue

# Get service URLs for frontend environment variables
$websocketServiceUrl = railway service show pulseintel-websocket --json | ConvertFrom-Json | Select-Object -ExpandProperty url
$apiServiceUrl = railway service show pulseintel-api --json | ConvertFrom-Json | Select-Object -ExpandProperty url

# Set frontend environment variables
railway service create --name pulseintel-frontend
railway variables set REACT_APP_WEBSOCKET_URL="$websocketServiceUrl" --service pulseintel-frontend
railway variables set REACT_APP_API_URL="$apiServiceUrl" --service pulseintel-frontend
railway deploy --service pulseintel-frontend --config railway-frontend.json
Write-Host "✅ React Frontend deployed" -ForegroundColor Green

# Final Summary
Write-Host "`n🎉 DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green
Write-Host "📊 Go Engine: $goServiceUrl" -ForegroundColor Cyan
Write-Host "🔌 WebSocket Service: $websocketServiceUrl" -ForegroundColor Cyan
Write-Host "🛠️ API Service: $apiServiceUrl" -ForegroundColor Cyan
Write-Host "🌐 Frontend: $(railway service show pulseintel-frontend --json | ConvertFrom-Json | Select-Object -ExpandProperty url)" -ForegroundColor Cyan

Write-Host "`n✅ All services deployed and connected!" -ForegroundColor Green
Write-Host "🚀 Your PulseIntel system is now live!" -ForegroundColor Green