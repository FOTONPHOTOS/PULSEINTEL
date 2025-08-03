# 🚀 PulseIntel Local Development with Ngrok

## Overview
Since Railway burned through your free credits, we'll run everything locally and use ngrok to expose services publicly.

## Architecture
```
Local Go Engine (8899) → ngrok tunnel → Public URL
Local WebSocket Service (8000) → ngrok tunnel → Public URL  
Local API Service (8001) → ngrok tunnel → Public URL
Local Frontend (3000) → ngrok tunnel → Public URL
```

## Prerequisites
1. **Install ngrok**: Download from https://ngrok.com/download
2. **Sign up for ngrok**: Get your auth token from https://dashboard.ngrok.com/get-started/your-authtoken
3. **Configure ngrok**: `ngrok config add-authtoken YOUR_TOKEN`

## Step-by-Step Setup

### 1. Start the Go Engine
```powershell
cd "G:\python files\precision9\pulseintel\go_Stream"
.\pulseintel_engine.exe
```
**Expected output**: Server running on port 8899

### 2. Expose Go Engine with ngrok (Terminal 1)
```bash
ngrok http 8899 --subdomain=pulseintel-go
```
**Note the public URL**: `https://pulseintel-go.ngrok.io`

### 3. Start WebSocket Service (Terminal 2)
```powershell
cd "G:\python files\precision9\pulseintel"
& "G:\python files\precision9\myenv\Scripts\Activate.ps1"

# Set environment variable to connect to ngrok Go engine
$env:GO_STREAM_URL = "wss://pulseintel-go.ngrok.io/ws"

python pulseintel_websocket_service.py
```

### 4. Expose WebSocket Service with ngrok (Terminal 3)
```bash
ngrok http 8000 --subdomain=pulseintel-ws
```
**Note the public URL**: `https://pulseintel-ws.ngrok.io`

### 5. Start API Service (Terminal 4)
```powershell
cd "G:\python files\precision9\pulseintel"
& "G:\python files\precision9\myenv\Scripts\Activate.ps1"
python pulseintel_api_service.py
```

### 6. Expose API Service with ngrok (Terminal 5)
```bash
ngrok http 8001 --subdomain=pulseintel-api
```
**Note the public URL**: `https://pulseintel-api.ngrok.io`

### 7. Configure Frontend Environment
Create `pulseintel/frontend/.env.local`:
```env
REACT_APP_WEBSOCKET_URL=https://pulseintel-ws.ngrok.io
REACT_APP_API_URL=https://pulseintel-api.ngrok.io
```

### 8. Start Frontend (Terminal 6)
```powershell
cd "G:\python files\precision9\pulseintel\frontend"
npm start
```

### 9. Expose Frontend with ngrok (Terminal 7)
```bash
ngrok http 3000 --subdomain=pulseintel-app
```
**Access your app**: `https://pulseintel-app.ngrok.io`

## Quick Launch Script
Save this as `launch_local_with_ngrok.ps1`:

```powershell
# Kill any existing processes
taskkill /F /IM pulseintel_engine.exe /T 2>$null
taskkill /F /IM python.exe /T 2>$null
taskkill /F /IM node.exe /T 2>$null

Write-Host "🚀 Starting PulseIntel Local Development Environment" -ForegroundColor Cyan

# Start Go Engine
Write-Host "1. Starting Go Engine..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'G:\python files\precision9\pulseintel\go_Stream'; .\pulseintel_engine.exe"

# Wait for Go engine to start
Start-Sleep -Seconds 5

# Start ngrok for Go engine
Write-Host "2. Starting ngrok for Go Engine..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k", "ngrok http 8899 --subdomain=pulseintel-go"

# Wait for ngrok to establish tunnel
Start-Sleep -Seconds 10

# Start WebSocket Service
Write-Host "3. Starting WebSocket Service..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'G:\python files\precision9\pulseintel'; & 'G:\python files\precision9\myenv\Scripts\Activate.ps1'; `$env:GO_STREAM_URL = 'wss://pulseintel-go.ngrok.io/ws'; python pulseintel_websocket_service.py"

# Start ngrok for WebSocket
Write-Host "4. Starting ngrok for WebSocket..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k", "ngrok http 8000 --subdomain=pulseintel-ws"

# Start API Service
Write-Host "5. Starting API Service..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'G:\python files\precision9\pulseintel'; & 'G:\python files\precision9\myenv\Scripts\Activate.ps1'; python pulseintel_api_service.py"

# Start ngrok for API
Write-Host "6. Starting ngrok for API..." -ForegroundColor Yellow
Start-Process cmd -ArgumentList "/k", "ngrok http 8001 --subdomain=pulseintel-api"

Write-Host ""
Write-Host "✅ All services starting up!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Wait 30 seconds for all services to initialize"
Write-Host "2. Create frontend/.env.local with ngrok URLs"
Write-Host "3. Start frontend: cd frontend && npm start"
Write-Host "4. Start ngrok for frontend: ngrok http 3000 --subdomain=pulseintel-app"
Write-Host ""
Write-Host "🌐 Your URLs will be:" -ForegroundColor Yellow
Write-Host "  Go Engine: https://pulseintel-go.ngrok.io"
Write-Host "  WebSocket: https://pulseintel-ws.ngrok.io"
Write-Host "  API: https://pulseintel-api.ngrok.io"
Write-Host "  Frontend: https://pulseintel-app.ngrok.io"
```

## Troubleshooting

### Go Engine Won't Start
- Check if port 8899 is in use: `netstat -an | findstr 8899`
- Kill existing processes: `taskkill /F /IM pulseintel_engine.exe`

### WebSocket Connection Issues
- Verify GO_STREAM_URL environment variable
- Check ngrok tunnel status: `curl https://pulseintel-go.ngrok.io/health`

### Frontend Not Loading
- Clear browser cache
- Check console for CORS errors
- Verify .env.local file exists with correct URLs

## Benefits of This Setup
✅ **Free**: No cloud costs, unlimited usage
✅ **Fast**: Local development speed
✅ **Public**: Accessible from anywhere via ngrok URLs
✅ **Flexible**: Easy to modify and test
✅ **Scalable**: Can add more services easily

## Production Migration
When ready for production, simply:
1. Replace ngrok URLs with your domain
2. Deploy to your preferred cloud provider
3. Update environment variables