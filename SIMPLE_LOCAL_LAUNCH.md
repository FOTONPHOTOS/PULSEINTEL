# 🚀 Simple Local Launch Guide

## Current Status: Go Engine ✅ RUNNING!

Your Go engine is successfully streaming live SOLUSDT data from Bybit. Now let's get the rest running.

## Step-by-Step Launch

### 1. Install ngrok (if not already installed)
```bash
# Download from https://ngrok.com/download
# Add to PATH
# Run: ngrok config add-authtoken YOUR_TOKEN
```

### 2. Start WebSocket Service (New Terminal)
```powershell
cd "G:\python files\precision9\pulseintel"
& "G:\python files\precision9\myenv\Scripts\Activate.ps1"
python pulseintel_websocket_service.py
```

### 3. Start API Service (New Terminal)
```powershell
cd "G:\python files\precision9\pulseintel"
& "G:\python files\precision9\myenv\Scripts\Activate.ps1"
python pulseintel_api_service.py
```

### 4. Create ngrok Tunnels (3 New Terminals)

**Terminal 1 - Go Engine:**
```bash
ngrok http 8899
```

**Terminal 2 - WebSocket:**
```bash
ngrok http 8000
```

**Terminal 3 - API:**
```bash
ngrok http 8001
```

### 5. Configure Frontend
Create `frontend/.env.local`:
```env
REACT_APP_WEBSOCKET_URL=https://YOUR-WS-TUNNEL.ngrok.io
REACT_APP_API_URL=https://YOUR-API-TUNNEL.ngrok.io
```

### 6. Start Frontend (New Terminal)
```powershell
cd "G:\python files\precision9\pulseintel\frontend"
npm start
```

### 7. Expose Frontend (New Terminal)
```bash
ngrok http 3000
```

## Quick Test URLs
- Go Engine Health: http://localhost:8899/health
- WebSocket Test: http://localhost:8000
- API Test: http://localhost:8001/docs
- Frontend: http://localhost:3000

## Your Live URLs (after ngrok)
- Go Engine: https://xxxxx.ngrok.io
- WebSocket: https://xxxxx.ngrok.io  
- API: https://xxxxx.ngrok.io
- Frontend: https://xxxxx.ngrok.io

## Next Steps
1. Start the services above
2. Note your ngrok URLs
3. Update frontend/.env.local
4. Access your live PulseIntel dashboard!

Your Go engine is already pumping live market data! 🎉