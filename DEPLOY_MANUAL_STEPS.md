# 🚀 PulseIntel Complete System Deployment Guide

## Current Status
✅ **Go Engine** - DEPLOYED & WORKING (receiving BYBIT-HEARTBEAT)
❌ **Python WebSocket Service** - NOT DEPLOYED  
❌ **Python API Service** - NOT DEPLOYED
❌ **React Frontend** - NOT DEPLOYED

## Architecture Overview
```
Go Engine (Port 8899) → pulseintel_websocket_service.py (Port 8000) → React Frontend
                                                                    ↗
pulseintel_api_service.py (Port 8001) → REST APIs (CoinGecko, etc.) → React Frontend
```

**Key Points:**
- `pulseintel_websocket_service.py` connects to Go engine, processes real-time data (VWAP, CVD)
- `pulseintel_api_service.py` is independent, pulls external REST API data to avoid bottlenecks

## Manual Deployment Steps

### Step 1: Deploy Python WebSocket Service
```bash
# Create the service
railway service create --name pulseintel-websocket

# Get your Go Engine URL (replace with your actual URL)
# Example: https://pulseintel-go-production.up.railway.app
GO_ENGINE_URL="https://your-go-engine-url.up.railway.app"
WEBSOCKET_URL="${GO_ENGINE_URL/https:/wss:}/ws"

# Set environment variable
railway variables set GO_STREAM_URL="$WEBSOCKET_URL" --service pulseintel-websocket

# Deploy
railway deploy --service pulseintel-websocket --config railway-websocket.json
```

### Step 2: Deploy Python API Service
```bash
# Create the service
railway service create --name pulseintel-api

# Deploy
railway deploy --service pulseintel-api --config railway-api.json
```

### Step 3: Deploy React Frontend
```bash
# Create the service
railway service create --name pulseintel-frontend

# Get service URLs (replace with your actual URLs)
WEBSOCKET_SERVICE_URL="https://your-websocket-service.up.railway.app"
API_SERVICE_URL="https://your-api-service.up.railway.app"

# Set environment variables
railway variables set REACT_APP_WEBSOCKET_URL="$WEBSOCKET_SERVICE_URL" --service pulseintel-frontend
railway variables set REACT_APP_API_URL="$API_SERVICE_URL" --service pulseintel-frontend

# Deploy
railway deploy --service pulseintel-frontend --config railway-frontend.json
```

## Verification Steps

### 1. Check Go Engine
- URL: `https://your-go-engine.up.railway.app/health`
- Should return: `{"status": "healthy", "service": "pulseintel-go-engine"}`

### 2. Check Python WebSocket Service
- URL: `https://your-websocket-service.up.railway.app/health`
- Should connect to Go engine WebSocket

### 3. Check Python API Service  
- URL: `https://your-api-service.up.railway.app/health`
- Should return API health status

### 4. Check React Frontend
- URL: `https://your-frontend.up.railway.app`
- Should load the dashboard

## Troubleshooting

### Common Issues:
1. **WebSocket Connection Failed**: Check GO_STREAM_URL environment variable
2. **CORS Errors**: Ensure API service allows frontend origin
3. **Build Failures**: Check Dockerfile configurations

### Debug Commands:
```bash
# Check service logs
railway logs --service pulseintel-websocket
railway logs --service pulseintel-api
railway logs --service pulseintel-frontend

# Check environment variables
railway variables --service pulseintel-websocket
railway variables --service pulseintel-frontend
```

## Expected Final Architecture
```
┌─────────────────┐    WebSocket    ┌──────────────────────┐
│   Go Engine     │◄───────────────►│ Python WebSocket     │
│   (Port 8899)   │                 │ Service (Port 8000)  │
└─────────────────┘                 └──────────────────────┘
                                              │
                                              │ WebSocket
                                              ▼
┌─────────────────┐    HTTP API     ┌──────────────────────┐
│ Python API      │◄───────────────►│   React Frontend     │
│ Service (8001)  │                 │                      │
└─────────────────┘                 └──────────────────────┘
```

## Success Indicators
- ✅ Go Engine: Receiving exchange data
- ✅ Python WebSocket: Connected to Go engine  
- ✅ Python API: Serving REST endpoints
- ✅ React Frontend: Loading dashboard with live data

Your system will be **100% deployed** when all 4 services are running and connected!