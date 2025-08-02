# 🚀 P9-MicroStream Launch Guide

## **QUICK START - 3 SIMPLE STEPS**

### **1. Health Check**
```powershell
.\LAUNCH_P9_PIPELINE.ps1 -HealthCheck
```

### **2. Test Run (30 seconds)**
```powershell
.\LAUNCH_P9_PIPELINE.ps1 -TestMode
```

### **3. Full Launch**
```powershell
.\LAUNCH_P9_PIPELINE.ps1
```

---

## **📋 LAUNCH OPTIONS**

### **🏥 Health Check Mode**
Verifies all prerequisites without starting the pipeline:
```powershell
.\LAUNCH_P9_PIPELINE.ps1 -HealthCheck
```
**Checks:**
- ✅ Redis connection
- ✅ P9-Pipeline executable exists
- ✅ Configuration file present

### **🧪 Test Mode**
Runs P9-MicroStream for 30 seconds then automatically stops:
```powershell
.\LAUNCH_P9_PIPELINE.ps1 -TestMode
```
**Perfect for:**
- Verifying data flow
- Testing configurations
- Quick validation

### **📊 Monitor Mode**
Runs P9-MicroStream with continuous monitoring:
```powershell
.\LAUNCH_P9_PIPELINE.ps1 -Monitor
```
**Features:**
- Background execution
- Real-time status monitoring
- Automatic health checks
- Graceful shutdown with Ctrl+C

### **🚀 Normal Launch**
Standard production launch:
```powershell
.\LAUNCH_P9_PIPELINE.ps1
```
**For:**
- Production deployment
- Continuous operation
- Full feature access

---

## **🔧 PREREQUISITES**

### **1. Redis Server**
**Installation:**
```powershell
# Download Redis for Windows or use WSL
# Or use Docker:
docker run -d -p 6379:6379 redis:latest
```

**Verification:**
```powershell
redis-cli ping
# Should return: PONG
```

### **2. P9-Pipeline Executable**
**Build Command:**
```powershell
.\go\bin\go.exe build -buildvcs=false -o p9_pipeline.exe ./cmd
```

### **3. Configuration File**
**Location:** `configs/config.yaml`
**Status:** ✅ Already configured for SOL trading

---

## **📡 DATA STREAMS PRODUCED**

### **Real-time Market Data Channels:**
```bash
# Binance Data
binance:solusdt:trade    # Trade data
binance:solusdt:depth    # Order book depth

# Bybit Data  
bybit:solusdt:trade      # Trade data
bybit:solusdt:depth      # Order book depth

# OKX Data
okx:sol-usdt:trade       # Trade data
okx:sol-usdt:depth       # Order book depth
```

### **For Precision9 Bots:**
```python
# Subscribe to data streams
import redis
client = redis.Redis(host='localhost', port=6379, db=0)

# Real-time trade data
pubsub = client.pubsub()
pubsub.subscribe('binance:solusdt:trade')
pubsub.subscribe('bybit:solusdt:trade')
pubsub.subscribe('okx:sol-usdt:trade')

# Process messages
for message in pubsub.listen():
    if message['type'] == 'message':
        trade_data = json.loads(message['data'])
        # Your bot logic here
```

---

## **🎯 PERFORMANCE EXPECTATIONS**

### **Throughput:**
- **Binance**: 100-300 trades/minute
- **Bybit**: 50-150 trades/minute  
- **OKX**: 30-100 trades/minute
- **Total**: 200+ real market events/minute

### **Latency:**
- **WebSocket → Redis**: <2ms
- **Redis → Precision9 Bots**: <3ms
- **End-to-End**: <5ms total latency

### **Data Quality:**
- **100% Real Market Data** - Zero fake data
- **Multi-Exchange Coverage** - Binance, Bybit, OKX
- **Deep Order Books** - Up to 1000 levels
- **Real-time Updates** - Live WebSocket streams

---

## **🚨 TROUBLESHOOTING**

### **❌ Redis Connection Failed**
```powershell
# Start Redis manually
redis-server

# Or check if Redis is installed
redis-cli --version
```

### **❌ Executable Not Found**
```powershell
# Rebuild the pipeline
.\go\bin\go.exe build -buildvcs=false -o p9_pipeline.exe ./cmd
```

### **❌ Configuration Error**
```powershell
# Verify config file exists
ls configs/config.yaml

# Check config syntax
# (YAML syntax validator online)
```

### **❌ WebSocket Connection Issues**
**Common causes:**
- Internet connectivity
- Exchange API rate limits
- Firewall blocking connections

**Solutions:**
- Check internet connection
- Restart pipeline after 5 minutes
- Verify no VPN/proxy interference

---

## **📊 MONITORING & VALIDATION**

### **Redis Channel Monitoring:**
```powershell
# Monitor all channels
redis-cli monitor

# Check specific channel
redis-cli subscribe binance:solusdt:trade
```

### **Log Analysis:**
- Real-time logs displayed in console
- Look for: "🔥 REAL TRADE PROCESSED"
- Error indicators: "❌" symbols

### **Performance Verification:**
- Trade counts should increase continuously
- Multiple exchanges should show activity
- No error messages in logs

---

## **🔄 INTEGRATION WITH PRECISION9**

### **Enhanced V2 MDB Integration:**
1. **Start P9-MicroStream**: `.\LAUNCH_P9_PIPELINE.ps1`
2. **Start Enhanced V2 MDB**: (in MDB directory)
3. **Connect Enhanced V2 Bots**: WebSocket endpoints ready
4. **Monitor Data Flow**: Redis channels active

### **Direct Bot Integration:**
```python
# Direct Redis access in your bots
import redis
import json

client = redis.Redis(host='localhost', port=6379, db=0)
pubsub = client.pubsub()

# Subscribe to real-time data
pubsub.subscribe('binance:solusdt:trade')

# Process real market data
for message in pubsub.listen():
    if message['type'] == 'message':
        data = json.loads(message['data'])
        # Your sophisticated bot logic here
```

---

## **✅ SUCCESS INDICATORS**

### **✅ Healthy Launch:**
- Pre-flight checks all pass
- WebSocket connections established
- Trade data flowing in console
- Redis channels active

### **✅ Operational Status:**
- Continuous trade processing
- Multiple exchanges active
- No connection errors
- Stable performance metrics

### **✅ Precision9 Ready:**
- Redis channels publishing data
- Enhanced V2 MDB receiving data
- Bots can subscribe to channels
- End-to-end data flow confirmed

---

**🎯 You now have institutional-grade market data flowing to your Precision9 ecosystem!** 