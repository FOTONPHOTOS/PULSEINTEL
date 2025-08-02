# 🚀 PulseIntel - Real-Time Crypto Market Intelligence Platform

**PulseIntel** is a professional-grade, real-time cryptocurrency market intelligence platform designed for traders, analysts, and institutions. It provides comprehensive market data, advanced analytics, and institutional-level insights through a modern, responsive web interface.

## ✨ Features

### 📊 **Real-Time Market Data**
- **Live Price Feeds**: WebSocket-powered real-time price updates with 2-decimal precision
- **Global Market Metrics**: Live global market cap and 24h volume from CoinGecko API
- **Multi-Exchange Data**: Aggregated data from major cryptocurrency exchanges
- **VWAP & CVD**: Real-time Volume Weighted Average Price and Cumulative Volume Delta

### 📱 **Mobile-Responsive Design**
- **Adaptive Layout**: Optimized for desktop, tablet, and mobile devices
- **Collapsible Navigation**: Mobile-friendly sidebar with organized sections
- **Touch-Optimized**: Proper touch targets and smooth animations
- **Real-Time Price Display**: Always-visible live price updates in header

### 🔍 **Advanced Analytics**
- **Market Microstructure**: Deep order book analysis and liquidity tracking
- **Smart Money Tracking**: Institutional flow detection and whale movements
- **Cross-Exchange Arbitrage**: Real-time arbitrage opportunities
- **Funding Rate Analysis**: Comprehensive funding rate monitoring across exchanges
- **Sentiment Analysis**: Market sentiment indicators and fear/greed index

### 📈 **Professional Tools**
- **Advanced Orderbook**: Multi-level order book visualization with heatmaps
- **Volatility Matrix**: Real-time volatility analysis across timeframes
- **Liquidation Analytics**: Liquidation cascade detection and analysis
- **News Integration**: Real-time crypto news feed with RSS aggregation

## 🏗️ Architecture

PulseIntel follows a modern microservices architecture:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Go Stream     │───▶│  WebSocket       │───▶│   React         │
│   (Data Feed)   │    │  Service         │    │   Frontend      │
│   Port: 8899    │    │  Port: 8000      │    │   Port: 5174    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   REST API       │
                       │   Service        │
                       │   Port: 8080     │
                       └──────────────────┘
```

### **Components:**

1. **Go Stream Engine** (`go_Stream/`): High-performance data ingestion from multiple exchanges
2. **WebSocket Service** (`pulseintel_websocket_service.py`): Real-time data broadcasting to frontend
3. **REST API Service** (`pulseintel_api_service.py`): HTTP API for market data and analytics
4. **React Frontend** (`frontend/`): Modern, responsive web interface

## 🚀 Quick Start

### **Prerequisites**
- Python 3.8+
- Node.js 16+
- Go 1.19+

### **1. Start the Go Stream Engine**
```powershell
cd go_Stream
.\pulseintel_engine.exe
```

### **2. Start the WebSocket Service**
```powershell
# Activate virtual environment
.\..\myenv_fixed\Scripts\Activate.ps1

# Run WebSocket service
python pulseintel_websocket_service.py
```

### **3. Start the REST API Service**
```powershell
# In a new terminal, activate virtual environment
.\..\myenv_fixed\Scripts\Activate.ps1

# Run API service
python pulseintel_api_service.py
```

### **4. Start the Frontend**
```powershell
cd frontend
npm run dev
```

### **5. Access the Platform**
Open your browser and navigate to: `http://localhost:5174`

## 📊 Data Sources & APIs

### **External Data Sources**
- **CoinGecko API**: Global market cap and volume data
- **Binance API**: Real-time price feeds and market data
- **Multiple Exchange APIs**: Comprehensive market coverage
- **RSS News Feeds**: Crypto news aggregation

### **Data Disclaimer**
⚠️ **Important**: This platform aggregates data from various external sources including:
- CoinGecko API for global market statistics
- Exchange APIs for real-time trading data  
- RSS feeds for news content
- Third-party market data providers

**Data Accuracy**: While we strive for accuracy, external data sources may experience delays, outages, or inaccuracies. Users should verify critical information through multiple sources before making trading decisions.

**No Financial Advice**: This platform is for informational purposes only and does not constitute financial advice. Trading cryptocurrencies involves substantial risk of loss.

## 🔧 Configuration

### **API Configuration** (`frontend/src/apiConfig.ts`)
```typescript
export const apiConfig = {
  WEBSOCKET_SERVICE: 'ws://localhost:8000',
  REST_API_SERVICE: 'http://localhost:8080'
};
```

### **Go Stream Configuration** (`go_Stream/configs/`)
- Exchange API keys and endpoints
- Data feed configurations
- Rate limiting settings

## 📱 Mobile Support

PulseIntel is fully optimized for mobile devices:

- **Responsive Breakpoints**: Mobile (<768px), Tablet (<1024px), Desktop (>1024px)
- **Touch Interface**: Optimized for touch interactions
- **Collapsible Navigation**: Space-efficient mobile menu
- **Adaptive Components**: Charts and tables adjust to screen size

## 🛠️ Development

### **Project Structure**
```
pulseintel/
├── go_Stream/              # Go data ingestion engine
│   ├── cmd/main.go        # Main Go application
│   ├── pkg/               # Go packages
│   └── configs/           # Configuration files
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API services
│   │   └── styles/        # CSS styles
│   └── package.json
├── pulseintel_websocket_service.py  # WebSocket server
├── pulseintel_api_service.py        # REST API server
└── real_news_fetcher.py             # News aggregation service
```

### **Key Technologies**
- **Frontend**: React 18, TypeScript, Tailwind CSS, Recharts
- **Backend**: Python FastAPI, WebSockets, asyncio
- **Data Engine**: Go, WebSocket clients, JSON processing
- **Real-time**: WebSocket connections, Server-Sent Events

## 🔒 Security & Performance

- **Rate Limiting**: Built-in protection against API abuse
- **CORS Configuration**: Secure cross-origin resource sharing
- **WebSocket Security**: Connection validation and cleanup
- **Performance Optimization**: Efficient data streaming and caching

## 📈 Monitoring & Logging

The platform includes comprehensive monitoring:
- Real-time connection status indicators
- WebSocket connection health monitoring
- API response time tracking
- Error logging and reporting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For technical support or questions:
- Check the logs in each service for error messages
- Ensure all services are running on correct ports
- Verify API keys and configurations
- Monitor WebSocket connection status in the frontend

---

**Built with ❤️ for the crypto trading community**