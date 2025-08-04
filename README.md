# PulseIntel - Real-Time Crypto Market Intelligence Platform
https://app.precision9bot.com

# NB: I'm running the web locally using cloudflare and it won't be up all the time 
# Dashboard Preview

![Dashboard video](frontend/src/assets/Pulseintel_Preview.mp4)

**PulseIntel** is a professional-grade, real-time cryptocurrency market intelligence platform designed for traders, analysts, and institutions. It provides comprehensive market data, advanced analytics, and actionable insights.

## Features

###  **Real-Time Market Data**
- **Live Price Feeds**: WebSocket-powered real-time price updates with 2-decimal precision
- **Global Market Metrics**: Live global market cap and 24h volume from CoinGecko API
- **Multi-Exchange Data**: Aggregated data from major cryptocurrency exchanges
- **VWAP & CVD**: Real-time Volume Weighted Average Price and Cumulative Volume Delta

### 📱 **Mobile-Responsive Design**
- **Adaptive Layout**: Optimized for desktop, tablet, and mobile devices
- **Collapsible Navigation**: Mobile-friendly sidebar with organized sections
- **Touch-Optimized**: Proper touch targets and smooth animations
- **Real-Time Price Display**: Always-visible live price updates in header

### **Advanced Analytics**
- **Market Microstructure**: Deep order book analysis and liquidity tracking
- **Smart Money Tracking**: Institutional flow detection and whale movements
- **Cross-Exchange Arbitrage**: Real-time arbitrage opportunities
- **Funding Rate Analysis**: Comprehensive funding rate monitoring across exchanges
- **Sentiment Analysis**: Market sentiment indicators and fear/greed index

###  **Professional Tools**
- **Advanced Orderbook**: Multi-level order book visualization with heatmaps
- **Volatility Matrix**: Real-time volatility analysis across timeframes
- **Liquidation Analytics**: Liquidation cascade detection and analysis
- **News Integration**: Real-time crypto news feed with RSS aggregation

##  Architecture

PulseIntel follows a modern microservices architecture:

```
┌──────────────────┐                 ┌─────────────────────┐
│    Go Stream     │─(gzip data)───▶ │   Python WebSocket  │
│ (BTC/ETH/SOL     │                 │   Service           │
│  Feed from       │                 │   (Normalization)   │
│  Binance/Bybit/  │                 │   Port: 8000        │
│  Okx, Port: 8899)│                 └─────────┬───────────┘
└──────────────────┘                           │
                                               │
                                               ▼
                                       ┌───────────────┐
                                       │   Frontend    │
                                       │   (React,     │
                                       │   Port: 5174) │
                                       └───────────────┘

┌─────────────────────┐
│  Python REST API    │
│  Service            │
│  (RSS, OI, Funding  │
│  Rate, etc.)        │
│  Port: 8080         │
└─────────┬───────────┘
          │
          ▼
   ┌───────────────┐
   │   Frontend    │
   └───────────────┘
```

#### **How Data Flows:**
- **Go Stream** ingests BTC, ETH, and SOL data from Binance, Bybit, and Okx, compresses with gzip, and sends to the **Python WebSocket Service** for normalization. The WebSocket then sends this data to the **React Frontend**.
- The **REST API** is an isolated Python service (not connected to the WebSocket) to avoid latency bottlenecks. It pulls anything REST (RSS news, OI, funding rate, etc.) and sends directly to the frontend.
- **WebSocket and REST API services do NOT communicate directly**. Both independently send data to the frontend.

#### **Why This Design?**
The REST API is kept completely independent from the WebSocket service to avoid latency bottlenecks. This ensures that REST data (such as news, funding rates, OI) is delivered to the frontend without being delayed by real-time streaming traffic handled by the WebSocket service.

## Quick Start
Prerequisites
Python 3.8+
Node.js 16+
Go 1.19+
1. Start the Go Stream Engine
cd go_Stream
.\pulseintel_engine.exe
2. Start the WebSocket Service
# Activate virtual environment
.\..\myenv_fixed\Scripts\Activate.ps1

# Run WebSocket service
python pulseintel_websocket_service.py
3. Start the REST API Service
# In a new terminal, activate virtual environment
.\..\myenv_fixed\Scripts\Activate.ps1

# Run API service
python pulseintel_api_service.py
4. Start the Frontend
cd frontend
npm run dev
5. Access the Platform
Open your browser and navigate to: http://localhost:5174

Data Sources & APIs
External Data Sources
CoinGecko API: Global market cap and volume data
Binance API: Real-time price feeds and market data
Multiple Exchange APIs: Comprehensive market coverage
RSS News Feeds: Crypto news aggregation
Data Disclaimer
Important: This platform aggregates data from various external sources including:

CoinGecko API for global market statistics
Exchange APIs for real-time trading data
RSS feeds for news content
Third-party market data providers
Data Accuracy: While we strive for accuracy, external data sources may experience delays, outages, or inaccuracies. Users should verify critical information through multiple sources before making trading decisions.

No Financial Advice: This platform is for informational purposes only and does not constitute financial advice. Trading cryptocurrencies involves substantial risk of loss.

Configuration
API Configuration (frontend/src/apiConfig.ts)
export const apiConfig = {
  WEBSOCKET_SERVICE: 'ws://localhost:8000',
  REST_API_SERVICE: 'http://localhost:8080'
};
Go Stream Configuration (go_Stream/configs/)
Exchange API keys and endpoints
Data feed configurations
Rate limiting settings
📱 Mobile Support
PulseIntel is fully optimized for mobile devices:

Responsive Breakpoints: Mobile (<768px), Tablet (<1024px), Desktop (>1024px)
Touch Interface: Optimized for touch interactions
Collapsible Navigation: Space-efficient mobile menu
Adaptive Components: Charts and tables adjust to screen size
🛠️ Development
Project Structure
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
Key Technologies
Frontend: React 18, TypeScript, Tailwind CSS, Recharts
Backend: Python FastAPI, WebSockets, asyncio
Data Engine: Go, WebSocket clients, JSON processing
Real-time: WebSocket connections, Server-Sent Events
🔒 Security & Performance
Rate Limiting: Built-in protection against API abuse
CORS Configuration: Secure cross-origin resource sharing
WebSocket Security: Connection validation and cleanup
Performance Optimization: Efficient data streaming and caching
📈 Monitoring & Logging
The platform includes comprehensive monitoring:

Real-time connection status indicators
WebSocket connection health monitoring
API response time tracking
Error logging and reporting
🤝 Contributing
Fork the repository
Create a feature branch
Make your changes
Test thoroughly
Submit a pull request
📄 License
This project is proprietary software. All rights reserved.

Support
For technical support or questions:

Check the logs in each service for error messages
Ensure all services are running on correct ports
Verify API keys and configurations
Monitor WebSocket connection status in the frontend
Built with ❤️ for the crypto trading community
contact: fotonphotos1@gmail.com for more inquiry 