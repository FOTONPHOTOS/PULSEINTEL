# 🚂 PulseIntel Railway Deployment Guide

This guide covers deploying PulseIntel on Railway with the updated 3-service architecture: Go Stream Engine + 2 Python services + React Frontend.

## 🏗️ Architecture Overview

PulseIntel consists of 4 main services:
1. **Go Stream Engine** (Port 8899) - High-performance data ingestion
2. **WebSocket Service** (Port 8000) - Real-time data broadcasting  
3. **REST API Service** (Port 8888) - HTTP API endpoints
4. **React Frontend** (Port 80) - Web interface

## 📋 Prerequisites

- Railway account (https://railway.app)
- GitHub repository with PulseIntel code
- Basic understanding of Railway deployment

## 🚀 Railway Deployment Steps

### **Step 1: Create Railway Project**

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your PulseIntel repository

### **Step 2: Deploy Go Stream Engine**

1. **Create Service**: Click "Add Service" → "GitHub Repo"
2. **Configure Service**:
   - **Name**: `pulseintel-stream`
   - **Dockerfile**: `Dockerfile.go`
   - **Port**: `8899`
3. **Environment Variables**:
   ```
   GO_ENV=production
   LOG_LEVEL=info
   PORT=8899
   ```
4. **Deploy**: Click "Deploy"

### **Step 3: Deploy WebSocket Service**

1. **Create Service**: Click "Add Service" → "GitHub Repo"
2. **Configure Service**:
   - **Name**: `pulseintel-websocket`
   - **Dockerfile**: `Dockerfile.websocket`
   - **Port**: `8000`
3. **Environment Variables**:
   ```
   PYTHON_ENV=production
   GO_STREAM_URL=ws://pulseintel-stream.railway.internal:8899/ws
   FRONTEND_HOST=0.0.0.0
   FRONTEND_PORT=8000
   PORT=8000
   ```
4. **Deploy**: Click "Deploy"

### **Step 4: Deploy REST API Service**

1. **Create Service**: Click "Add Service" → "GitHub Repo"
2. **Configure Service**:
   - **Name**: `pulseintel-api`
   - **Dockerfile**: `Dockerfile.python`
   - **Port**: `8888`
3. **Environment Variables**:
   ```
   PYTHON_ENV=production
   API_HOST=0.0.0.0
   API_PORT=8888
   WEBSOCKET_SERVICE_URL=ws://pulseintel-websocket.railway.internal:8000
   PORT=8888
   ```
4. **Deploy**: Click "Deploy"

### **Step 5: Deploy React Frontend**

1. **Create Service**: Click "Add Service" → "GitHub Repo"
2. **Configure Service**:
   - **Name**: `pulseintel-frontend`
   - **Dockerfile**: `Dockerfile.frontend`
   - **Port**: `80`
3. **Environment Variables**:
   ```
   NODE_ENV=production
   VITE_API_URL=https://pulseintel-api.railway.app
   VITE_WEBSOCKET_URL=wss://pulseintel-websocket.railway.app
   PORT=80
   ```
4. **Deploy**: Click "Deploy"

## 🔧 Service Configuration

### **Railway Service Settings**

For each service, configure:

#### **Go Stream Engine**
```json
{
  "name": "pulseintel-stream",
  "dockerfile": "Dockerfile.go",
  "port": 8899,
  "healthcheck": "/health"
}
```

#### **WebSocket Service**
```json
{
  "name": "pulseintel-websocket", 
  "dockerfile": "Dockerfile.websocket",
  "port": 8000,
  "healthcheck": "/health"
}
```

#### **REST API Service**
```json
{
  "name": "pulseintel-api",
  "dockerfile": "Dockerfile.python", 
  "port": 8888,
  "healthcheck": "/health"
}
```

#### **React Frontend**
```json
{
  "name": "pulseintel-frontend",
  "dockerfile": "Dockerfile.frontend",
  "port": 80,
  "healthcheck": "/"
}
```

## 🌐 Domain Configuration

### **Custom Domains (Optional)**

1. **Go to Service Settings** → "Domains"
2. **Add Custom Domain**:
   - **Stream**: `stream.pulseintel.com`
   - **WebSocket**: `ws.pulseintel.com`
   - **API**: `api.pulseintel.com`
   - **Frontend**: `pulseintel.com`

### **Railway Generated URLs**
- **Stream**: `https://pulseintel-stream.railway.app`
- **WebSocket**: `https://pulseintel-websocket.railway.app`
- **API**: `https://pulseintel-api.railway.app`
- **Frontend**: `https://pulseintel-frontend.railway.app`

## 🔗 Service Communication

### **Internal Communication**
Services communicate using Railway's internal networking:
```
pulseintel-stream.railway.internal:8899
pulseintel-websocket.railway.internal:8000
pulseintel-api.railway.internal:8888
```

### **External Access**
Frontend connects to services via public URLs:
```javascript
// frontend/src/apiConfig.ts
export const apiConfig = {
  WEBSOCKET_SERVICE: 'wss://pulseintel-websocket.railway.app',
  REST_API_SERVICE: 'https://pulseintel-api.railway.app'
};
```

## 📊 Monitoring & Logs

### **Railway Dashboard**
- **Metrics**: CPU, Memory, Network usage
- **Logs**: Real-time application logs
- **Deployments**: Deployment history and status

### **Health Checks**
Each service includes health check endpoints:
- **Stream**: `GET /health`
- **WebSocket**: `GET /health`
- **API**: `GET /health`
- **Frontend**: `GET /` (nginx status)

## 🚨 Troubleshooting

### **Common Issues**

#### **Service Not Starting**
1. Check logs in Railway dashboard
2. Verify Dockerfile paths
3. Check environment variables
4. Ensure ports are correctly configured

#### **Service Communication Issues**
1. Verify internal URLs use `.railway.internal`
2. Check environment variables
3. Ensure services are deployed in correct order
4. Test health endpoints

#### **Frontend Not Loading**
1. Check if API and WebSocket services are running
2. Verify CORS configuration
3. Check nginx configuration in Dockerfile.frontend
4. Test API endpoints directly

### **Debugging Commands**

#### **Check Service Status**
```bash
# Railway CLI
railway status

# Check specific service
railway logs --service pulseintel-stream
```

#### **Test Endpoints**
```bash
# Test Go Stream Engine
curl https://pulseintel-stream.railway.app/health

# Test WebSocket Service  
curl https://pulseintel-websocket.railway.app/health

# Test REST API
curl https://pulseintel-api.railway.app/health
```

## 💰 Cost Optimization

### **Railway Pricing**
- **Starter Plan**: $5/month per service
- **Pro Plan**: Usage-based pricing
- **Resource Limits**: CPU, Memory, Network

### **Optimization Tips**
1. **Right-size containers**: Adjust CPU/Memory limits
2. **Use health checks**: Prevent unnecessary restarts
3. **Monitor usage**: Track resource consumption
4. **Scale appropriately**: Start with minimal resources

## 🔄 CI/CD Pipeline

### **Automatic Deployments**
Railway automatically deploys on git push:

1. **Push to main branch**
2. **Railway detects changes**
3. **Builds Docker images**
4. **Deploys services**
5. **Health checks pass**
6. **Traffic routes to new version**

### **Manual Deployment**
```bash
# Railway CLI
railway login
railway link [project-id]
railway deploy --service pulseintel-stream
```

## 📈 Scaling

### **Horizontal Scaling**
- **Multiple replicas** per service
- **Load balancing** across instances
- **Auto-scaling** based on metrics

### **Vertical Scaling**
- **Increase CPU/Memory** per instance
- **Optimize Docker images**
- **Database connection pooling**

## 🔐 Security

### **Environment Variables**
- Store sensitive data in Railway environment variables
- Never commit API keys or secrets
- Use Railway's secret management

### **Network Security**
- Internal service communication
- HTTPS/WSS for external connections
- Proper CORS configuration

---

## 🎯 Quick Deployment Checklist

- [ ] Repository connected to Railway
- [ ] Go Stream Engine deployed (Port 8899)
- [ ] WebSocket Service deployed (Port 8000)
- [ ] REST API Service deployed (Port 8888)
- [ ] React Frontend deployed (Port 80)
- [ ] Environment variables configured
- [ ] Health checks passing
- [ ] Services communicating properly
- [ ] Frontend loading correctly
- [ ] Real-time data flowing

**🎉 Your PulseIntel platform is now live on Railway!**