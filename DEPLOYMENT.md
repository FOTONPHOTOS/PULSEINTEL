# 🚀 PulseIntel Deployment Guide

This guide covers deploying PulseIntel on various cloud platforms including Render (Free), Hetzner, AWS, and Vercel.

## 📋 Prerequisites

Before deploying, ensure you have:
- Git repository with PulseIntel codebase
- API keys for external services (if required)
- Domain name (optional but recommended)

## 🏗️ Architecture Overview

PulseIntel consists of 4 main components:
1. **Go Stream Engine** (Port 8899) - Data ingestion
2. **WebSocket Service** (Port 8000) - Real-time data broadcasting  
3. **REST API Service** (Port 8888) - HTTP API endpoints
4. **React Frontend** (Port 5174) - Web interface

## 🆓 Render (Free Plan) Deployment

### **Advantages:**
- Free tier available
- Easy deployment from Git
- Automatic HTTPS
- Good for development/testing

### **Limitations:**
- Services sleep after 15 minutes of inactivity
- Limited resources on free tier
- No persistent storage

### **Step 1: Prepare Repository**
```bash
# Ensure your repository has these files:
- requirements.txt
- package.json (in frontend/)
- Dockerfile.python
- Dockerfile.go
```

### **Step 2: Deploy Backend Services**

#### **WebSocket Service**
1. Go to [render.com](https://render.com) and create account
2. Click "New" → "Web Service"
3. Connect your Git repository
4. Configure:
   - **Name**: `pulseintel-websocket`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python pulseintel_websocket_service.py`
   - **Port**: `8000`

#### **REST API Service**
1. Create another Web Service
2. Configure:
   - **Name**: `pulseintel-api`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python pulseintel_api_service.py`
   - **Port**: `8888`

#### **Go Stream Engine**
1. Create another Web Service
2. Configure:
   - **Name**: `pulseintel-stream`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `Dockerfile.go`
   - **Port**: `8899`

### **Step 3: Deploy Frontend**
1. Create a new "Static Site"
2. Configure:
   - **Name**: `pulseintel-frontend`
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/dist`

### **Step 4: Update Configuration**
Update `frontend/src/apiConfig.ts`:
```typescript
export const apiConfig = {
  WEBSOCKET_SERVICE: 'wss://pulseintel-websocket.onrender.com',
  REST_API_SERVICE: 'https://pulseintel-api.onrender.com'
};
```

---

## 🖥️ Hetzner Cloud Deployment

### **Advantages:**
- Excellent price/performance ratio
- Full control over server
- Persistent storage
- European data centers

### **Step 1: Create Server**
1. Go to [hetzner.com](https://hetzner.com)
2. Create a new Cloud Server:
   - **Image**: Ubuntu 22.04
   - **Type**: CPX11 (2 vCPU, 4GB RAM) - minimum
   - **Location**: Choose nearest to your users

### **Step 2: Server Setup**
```bash
# Connect to server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install dependencies
apt install -y python3 python3-pip nodejs npm golang-go nginx certbot python3-certbot-nginx

# Create application user
useradd -m -s /bin/bash pulseintel
su - pulseintel

# Clone repository
git clone https://github.com/yourusername/pulseintel.git
cd pulseintel
```

### **Step 3: Setup Python Environment**
```bash
# Create virtual environment
python3 -m venv myenv_fixed
source myenv_fixed/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### **Step 4: Build Go Stream Engine**
```bash
cd go_Stream
go mod tidy
go build -o pulseintel_engine ./cmd/main.go
cd ..
```

### **Step 5: Build Frontend**
```bash
cd frontend
npm install
npm run build
cd ..
```

### **Step 6: Create Systemd Services**

#### **WebSocket Service**
```bash
sudo tee /etc/systemd/system/pulseintel-websocket.service > /dev/null <<EOF
[Unit]
Description=PulseIntel WebSocket Service
After=network.target

[Service]
Type=simple
User=pulseintel
WorkingDirectory=/home/pulseintel/pulseintel
Environment=PATH=/home/pulseintel/pulseintel/myenv_fixed/bin
ExecStart=/home/pulseintel/pulseintel/myenv_fixed/bin/python pulseintel_websocket_service.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF
```

#### **REST API Service**
```bash
sudo tee /etc/systemd/system/pulseintel-api.service > /dev/null <<EOF
[Unit]
Description=PulseIntel REST API Service
After=network.target

[Service]
Type=simple
User=pulseintel
WorkingDirectory=/home/pulseintel/pulseintel
Environment=PATH=/home/pulseintel/pulseintel/myenv_fixed/bin
ExecStart=/home/pulseintel/pulseintel/myenv_fixed/bin/python pulseintel_api_service.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF
```

#### **Go Stream Service**
```bash
sudo tee /etc/systemd/system/pulseintel-stream.service > /dev/null <<EOF
[Unit]
Description=PulseIntel Go Stream Engine
After=network.target

[Service]
Type=simple
User=pulseintel
WorkingDirectory=/home/pulseintel/pulseintel/go_Stream
ExecStart=/home/pulseintel/pulseintel/go_Stream/pulseintel_engine
Restart=always

[Install]
WantedBy=multi-user.target
EOF
```

### **Step 7: Configure Nginx**
```bash
sudo tee /etc/nginx/sites-available/pulseintel > /dev/null <<EOF
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /home/pulseintel/pulseintel/frontend/dist;
        try_files \$uri \$uri/ /index.html;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:8888/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://localhost:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/pulseintel /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### **Step 8: Start Services**
```bash
# Enable and start services
sudo systemctl enable pulseintel-websocket pulseintel-api pulseintel-stream
sudo systemctl start pulseintel-websocket pulseintel-api pulseintel-stream

# Check status
sudo systemctl status pulseintel-websocket pulseintel-api pulseintel-stream
```

### **Step 9: Setup SSL (Optional)**
```bash
sudo certbot --nginx -d your-domain.com
```

---

## ☁️ AWS Deployment

### **Advantages:**
- Highly scalable
- Global infrastructure
- Comprehensive services
- Enterprise-grade security

### **Architecture:**
- **EC2**: Application servers
- **ALB**: Load balancer
- **RDS**: Database (if needed)
- **CloudFront**: CDN for frontend
- **Route 53**: DNS management

### **Step 1: Create EC2 Instance**
1. Launch EC2 instance (t3.medium recommended)
2. Configure security groups:
   - Port 22 (SSH)
   - Port 80 (HTTP)
   - Port 443 (HTTPS)
   - Port 8000 (WebSocket)
   - Port 8888 (API)
   - Port 8899 (Stream)

### **Step 2: Setup Application**
Follow similar steps as Hetzner deployment for application setup.

### **Step 3: Create Application Load Balancer**
1. Create ALB in AWS Console
2. Configure target groups for each service
3. Setup health checks
4. Configure SSL certificate

### **Step 4: Setup CloudFront (Optional)**
1. Create CloudFront distribution
2. Point to ALB as origin
3. Configure caching rules
4. Setup custom domain

### **Step 5: Auto Scaling (Optional)**
1. Create launch template
2. Setup Auto Scaling Group
3. Configure scaling policies
4. Setup CloudWatch alarms

---

## ▲ Vercel Deployment (Frontend Only)

### **Advantages:**
- Excellent for frontend deployment
- Global CDN
- Automatic deployments
- Serverless functions support

### **Limitations:**
- Frontend only (backend needs separate hosting)
- Serverless functions have execution limits

### **Step 1: Deploy Frontend**
1. Go to [vercel.com](https://vercel.com)
2. Import your Git repository
3. Configure:
   - **Framework**: React
   - **Build Command**: `cd frontend && npm run build`
   - **Output Directory**: `frontend/dist`

### **Step 2: Configure Environment Variables**
Add environment variables in Vercel dashboard:
```
VITE_WEBSOCKET_SERVICE=wss://your-backend-domain.com
VITE_REST_API_SERVICE=https://your-backend-domain.com
```

### **Step 3: Update API Configuration**
Update `frontend/src/apiConfig.ts`:
```typescript
export const apiConfig = {
  WEBSOCKET_SERVICE: import.meta.env.VITE_WEBSOCKET_SERVICE || 'ws://localhost:8000',
  REST_API_SERVICE: import.meta.env.VITE_REST_API_SERVICE || 'http://localhost:8888'
};
```

---

## 🔧 Configuration for Production

### **Environment Variables**
Create `.env` file for production:
```bash
# API Configuration
WEBSOCKET_PORT=8000
API_PORT=8888
STREAM_PORT=8899

# External APIs
COINGECKO_API_URL=https://api.coingecko.com/api/v3
BINANCE_API_URL=https://api.binance.com

# CORS Settings
ALLOWED_ORIGINS=https://your-domain.com

# Logging
LOG_LEVEL=INFO
```

### **Performance Optimization**
```python
# In your Python services, add:
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        workers=4,  # Adjust based on CPU cores
        log_level="info"
    )
```

### **Security Considerations**
1. **HTTPS Only**: Always use HTTPS in production
2. **CORS Configuration**: Restrict origins to your domain
3. **Rate Limiting**: Implement rate limiting for APIs
4. **API Keys**: Store sensitive keys in environment variables
5. **Firewall**: Configure firewall rules appropriately

---

## 📊 Monitoring & Maintenance

### **Health Checks**
Implement health check endpoints:
```python
@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": time.time()}
```

### **Logging**
Configure structured logging:
```python
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

### **Monitoring Tools**
- **Uptime monitoring**: UptimeRobot, Pingdom
- **Performance monitoring**: New Relic, DataDog
- **Error tracking**: Sentry
- **Log aggregation**: ELK Stack, Splunk

---

## 🚨 Troubleshooting

### **Common Issues:**

#### **Services Not Starting**
```bash
# Check logs
sudo journalctl -u pulseintel-websocket -f
sudo journalctl -u pulseintel-api -f
sudo journalctl -u pulseintel-stream -f
```

#### **WebSocket Connection Issues**
- Check firewall settings
- Verify proxy configuration
- Test WebSocket endpoint directly

#### **API Not Responding**
- Check service status
- Verify port bindings
- Check application logs

#### **Frontend Not Loading**
- Check build process
- Verify API endpoints
- Check browser console for errors

### **Performance Issues:**
- Monitor CPU and memory usage
- Check database connections
- Analyze network latency
- Review application logs

---

## 📈 Scaling Considerations

### **Horizontal Scaling:**
- Use load balancers
- Deploy multiple instances
- Implement session management
- Use Redis for shared state

### **Vertical Scaling:**
- Increase server resources
- Optimize database queries
- Implement caching
- Use CDN for static assets

---

## 🔄 Continuous Deployment

### **GitHub Actions Example:**
```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v2
    
    - name: Deploy to server
      uses: appleboy/ssh-action@v0.1.5
      with:
        host: ${{ secrets.HOST }}
        username: ${{ secrets.USERNAME }}
        key: ${{ secrets.KEY }}
        script: |
          cd /home/pulseintel/pulseintel
          git pull origin main
          source myenv_fixed/bin/activate
          pip install -r requirements.txt
          cd frontend && npm install && npm run build
          sudo systemctl restart pulseintel-websocket pulseintel-api pulseintel-stream
```

---

## 📞 Support

For deployment issues:
1. Check service logs first
2. Verify all dependencies are installed
3. Ensure ports are not blocked by firewall
4. Test each service individually
5. Check external API connectivity

**Remember**: Always test deployments in a staging environment before production!