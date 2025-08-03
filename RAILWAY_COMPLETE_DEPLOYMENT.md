# 🚀 Complete Railway Deployment Guide - PulseIntel System

## 📋 **Prerequisites**
- Railway CLI installed: `npm install -g @railway/cli`
- Railway account connected: `railway login`
- GitHub repo: https://github.com/FOTONPHOTOS/PULSEINTEL

## 🎯 **Deployment Strategy**

You'll deploy **4 separate Railway services** from the same GitHub repo using different configurations:

1. **pulseintel-go** (Already deployed ✅)
2. **pulseintel-websocket** (WebSocket service)
3. **pulseintel-api** (REST API service)
4. **pulseintel-frontend** (React frontend)

---

## 🚀 **Step-by-Step Deployment**

### **Step 1: Connect Railway to Your GitHub Repo**

```bash
# Navigate to your project
cd pulseintel

# Initialize Railway project (if not already done)
railway login
railway init

# Link to your GitHub repo
railway link
```

### **Step 2: Deploy Python WebSocket Service**

```bash
# Create WebSocket service
railway service create pulseintel-websocket

# Deploy with WebSocket configuration
railway up --service pulseintel-websocket --config railway-websocket.json

# Set environment variables (replace with your actual Go engine URL)
railway variables set GO_STREAM_URL="wss://pulseintel-go-production.up.railway.app/ws" --service pulseintel-websocket
```

### **Step 3: Deploy Python API Service**

```bash
# Create API service
railway service create pulseintel-api

# Deploy with API configuration
railway up --service pulseintel-api --config railway-api.json
```

### **Step 4: Deploy React Frontend**

```bash
# Create frontend service
railway service create pulseintel-frontend

# Get the URLs of your deployed services
WEBSOCKET_URL=$(railway service show pulseintel-websocket --json | jq -r '.url')
API_URL=$(railway service show pulseintel-api --json | jq -r '.url')

# Set frontend environment variables
railway variables set REACT_APP_WEBSOCKET_URL="$WEBSOCKET_URL" --service pulseintel-frontend
railway variables set REACT_APP_API_URL="$API_URL" --service pulseintel-frontend

# Deploy frontend
railway up --service pulseintel-frontend --config railway-frontend.json
```

---

## 🔧 **Alternative: Railway Dashboard Method**

If CLI doesn't work, use Railway Dashboard:

### **1. Go to Railway Dashboard**
- Visit: https://railway.app/dashboard
- Click "New Project" → "Deploy from GitHub repo"
- Select: `FOTONPHOTOS/PULSEINTEL`

### **2. Create Each Service:**

#### **WebSocket Service:**
- Service Name: `pulseintel-websocket`
- Build Command: Use `Dockerfile.websocket`
- Environment Variables:
  - `GO_STREAM_URL`: `wss://your-go-engine.up.railway.app/ws`

#### **API Service:**
- Service Name: `pulseintel-api`  
- Build Command: Use `Dockerfile.python`
- Port: `8001`

#### **Frontend Service:**
- Service Name: `pulseintel-frontend`
- Build Command: Use `Dockerfile.frontend`
- Environment Variables:
  - `REACT_APP_WEBSOCKET_URL`: `https://pulseintel-websocket.up.railway.app`
  - `REACT_APP_API_URL`: `https://pulseintel-api.up.railway.app`

---

## 🔍 **Service Configuration Details**

### **Service 1: pulseintel-websocket**
```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.websocket"
  },
  "deploy": {
    "numReplicas": 1,
    "sleepApplication": false,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### **Service 2: pulseintel-api**
```json
{
  "build": {
    "builder": "DOCKERFILE", 
    "dockerfilePath": "Dockerfile.python"
  },
  "deploy": {
    "numReplicas": 1,
    "sleepApplication": false,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### **Service 3: pulseintel-frontend**
```json
{
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile.frontend"  
  },
  "deploy": {
    "numReplicas": 1,
    "sleepApplication": false,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

---

## 🎯 **Environment Variables Setup**

### **Critical Environment Variables:**

#### **pulseintel-websocket:**
- `GO_STREAM_URL`: WebSocket URL of your Go engine
- `PORT`: `8000` (Railway sets this automatically)

#### **pulseintel-api:**
- `PORT`: `8001` (Railway sets this automatically)

#### **pulseintel-frontend:**
- `REACT_APP_WEBSOCKET_URL`: URL of WebSocket service
- `REACT_APP_API_URL`: URL of API service

---

## 🔍 **Verification Steps**

### **1. Check Service Health:**
```bash
# Check logs
railway logs --service pulseintel-websocket
railway logs --service pulseintel-api  
railway logs --service pulseintel-frontend

# Check service status
railway status --service pulseintel-websocket
railway status --service pulseintel-api
railway status --service pulseintel-frontend
```

### **2. Test Endpoints:**
```bash
# Test API service
curl https://pulseintel-api-production.up.railway.app/docs
curl https://pulseintel-api-production.up.railway.app/api/market-overview

# Test WebSocket service (should return upgrade error for HTTP)
curl https://pulseintel-websocket-production.up.railway.app/health

# Test frontend
curl https://pulseintel-frontend-production.up.railway.app
```

---

## 🎉 **Expected Final Architecture**

```
┌─────────────────────────────────────┐
│ pulseintel-go-production            │ ✅ DEPLOYED
│ https://xxx.up.railway.app          │
└─────────────────┬───────────────────┘
                  │ WebSocket
                  ▼
┌─────────────────────────────────────┐
│ pulseintel-websocket-production     │ 🔄 TO DEPLOY
│ https://xxx.up.railway.app          │
└─────────────────┬───────────────────┘
                  │ WebSocket
                  ▼
┌─────────────────────────────────────┐    ┌─────────────────────────────────────┐
│ pulseintel-frontend-production      │◄───┤ pulseintel-api-production           │
│ https://xxx.up.railway.app          │    │ https://xxx.up.railway.app          │
└─────────────────────────────────────┘    └─────────────────────────────────────┘
```

---

## 🚨 **Troubleshooting**

### **Common Issues:**

1. **Build Failures:**
   - Check Dockerfile paths in railway configs
   - Verify requirements.txt has all dependencies

2. **Connection Errors:**
   - Verify environment variables are set correctly
   - Check service URLs are accessible

3. **WebSocket Connection Failed:**
   - Ensure GO_STREAM_URL uses `wss://` not `ws://`
   - Verify Go engine is accessible

### **Debug Commands:**
```bash
# Check environment variables
railway variables --service pulseintel-websocket
railway variables --service pulseintel-frontend

# Restart services
railway redeploy --service pulseintel-websocket
railway redeploy --service pulseintel-api
```

---

## ✅ **Success Indicators**

- ✅ All 4 services show "Deployed" status in Railway dashboard
- ✅ Go engine continues receiving exchange data
- ✅ WebSocket service connects to Go engine successfully  
- ✅ API service serves REST endpoints
- ✅ Frontend loads with live data from both services

**Your complete PulseIntel system will be live! 🎉**