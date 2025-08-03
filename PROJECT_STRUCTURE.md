# 📁 PulseIntel Project Structure

```
pulseintel/
├── 📋 PROJECT FILES
│   ├── README.md                           # Project documentation
│   ├── .gitignore                          # Git ignore rules
│   ├── requirements.txt                    # Python dependencies
│   └── PROJECT_STRUCTURE.md               # This file
│
├── 🚀 DEPLOYMENT CONFIGURATION
│   ├── railway.json                        # Go engine Railway config
│   ├── railway-websocket.json             # WebSocket service Railway config
│   ├── railway-api.json                   # API service Railway config
│   ├── railway-frontend.json              # Frontend Railway config
│   ├── docker-compose.yml                 # Local development compose
│   ├── .dockerignore                      # Docker ignore rules
│   ├── Dockerfile.go                      # Go engine Dockerfile
│   ├── Dockerfile.websocket               # WebSocket service Dockerfile
│   ├── Dockerfile.python                  # API service Dockerfile
│   └── Dockerfile.frontend                # Frontend Dockerfile
│
├── 📚 DEPLOYMENT GUIDES
│   ├── DEPLOYMENT_READY.md                # Deployment readiness checklist
│   ├── RAILWAY_COMPLETE_DEPLOYMENT.md     # Complete Railway deployment guide
│   ├── DEPLOY_MANUAL_STEPS.md             # Manual deployment steps
│   ├── RAILWAY_DEPLOYMENT.md              # Railway deployment documentation
│   ├── DEPLOYMENT.md                      # General deployment info
│   └── deploy_complete_system.ps1         # PowerShell deployment script
│
├── 🐍 PYTHON SERVICES
│   ├── pulseintel_websocket_service.py    # WebSocket service (connects to Go engine)
│   ├── pulseintel_api_service.py          # REST API service (external data)
│   └── real_news_fetcher.py               # News fetching module
│
├── 🔧 GO ENGINE (go_Stream/)
│   ├── cmd/
│   │   └── main.go                         # Go engine entry point
│   ├── internal/
│   │   ├── analytics/
│   │   │   ├── order_flow_analyzer.go      # Order flow analysis
│   │   │   ├── orderbook_analyzer.go       # Orderbook analysis
│   │   │   ├── ohlcv_candle_generator.go   # Candle generation
│   │   │   ├── multi_timeframe_coordinator.go # Multi-timeframe coordination
│   │   │   ├── historical_data_fetcher.go  # Historical data fetching
│   │   │   └── historical_realtime_fusion.go # Real-time data fusion
│   │   ├── detectors/
│   │   │   ├── momentum.go                 # Momentum detection
│   │   │   └── mean_reversion.go           # Mean reversion detection
│   │   ├── exchanges/                      # Exchange connectors
│   │   ├── config/                         # Configuration management
│   │   └── supervisor/                     # Process supervision
│   ├── pkg/
│   │   ├── broadcaster/
│   │   │   └── broadcaster.go              # WebSocket broadcasting
│   │   └── batcher/
│   │       └── message_batcher.go          # Message batching
│   ├── configs/                            # Configuration files
│   ├── go.mod                              # Go module definition
│   ├── go.sum                              # Go module checksums
│   ├── build_pulseintel_engine.ps1         # Build script
│   ├── GAP_DETECTION_ACHIEVEMENT_SUMMARY.md # Gap detection documentation
│   └── GO_MODULE_FIX_SUMMARY.md           # Go module fix documentation
│
└── 🌐 REACT FRONTEND (frontend/)
    ├── public/                             # Static assets
    ├── src/
    │   ├── components/                     # React components
    │   │   ├── AdvancedAlertSystem.tsx     # Alert system
    │   │   ├── AdvancedOrderbook.tsx       # Advanced orderbook
    │   │   ├── ArbitrageDashboard.tsx      # Arbitrage dashboard
    │   │   ├── CrossExchangeArbitrage.tsx  # Cross-exchange arbitrage
    │   │   ├── CryptoNewsSlider.tsx        # News slider
    │   │   ├── DeFiAnalytics.tsx           # DeFi analytics
    │   │   ├── ExchangeTable.tsx           # Exchange table
    │   │   ├── ExchangeVolumeRankings.tsx  # Volume rankings
    │   │   ├── ExchangeRankingTable.tsx    # Exchange rankings
    │   │   ├── FundingRateTable.tsx        # Funding rate table
    │   │   ├── FundingRateHeatmap.tsx      # Funding rate heatmap
    │   │   ├── FundingRateMatrix.tsx       # Funding rate matrix
    │   │   ├── GenericHeatmap.tsx          # Generic heatmap component
    │   │   ├── GlobalLiquidityFlow.tsx     # Global liquidity flow
    │   │   ├── InstitutionalMarketOverview.tsx # Institutional overview
    │   │   ├── LiquidationAnalytics.tsx    # Liquidation analytics
    │   │   ├── LiquidationFeed.tsx         # Liquidation feed
    │   │   ├── LiquidityHeatmap.tsx        # Liquidity heatmap
    │   │   ├── MarketMicrostructure.tsx    # Market microstructure
    │   │   ├── MarketOverviewPanel.tsx     # Market overview
    │   │   ├── MarketSentimentWidget.tsx   # Sentiment widget
    │   │   ├── OpenInterestTracker.tsx     # Open interest tracker
    │   │   ├── OrderbookHeatmap.tsx        # Orderbook heatmap
    │   │   ├── OrderbookDepthChart.tsx     # Orderbook depth chart
    │   │   ├── OrderFlowAnalytics.tsx      # Order flow analytics
    │   │   ├── OrderFlowImbalance.tsx      # Order flow imbalance
    │   │   ├── RealTimeDashboard.tsx       # Real-time dashboard
    │   │   ├── RealTimeMetricsGrid.tsx     # Real-time metrics
    │   │   ├── SentimentIndex.tsx          # Sentiment index
    │   │   ├── SmartMoneyTracker.tsx       # Smart money tracker
    │   │   ├── TopMoversTable.tsx          # Top movers table
    │   │   ├── VolatilityMatrix.tsx        # Volatility matrix
    │   │   ├── VolumeComparisonChart.tsx   # Volume comparison
    │   │   ├── WebSocketTest.tsx           # WebSocket testing
    │   │   └── WhaleTracker.tsx            # Whale tracker
    │   ├── pages/                          # React pages
    │   │   ├── Dashboard.tsx               # Main dashboard
    │   │   ├── AdvancedDelta.tsx           # Advanced delta page
    │   │   ├── Analysis.tsx                # Analysis page
    │   │   ├── Alerts.tsx                  # Alerts page
    │   │   ├── Arbitrage.tsx               # Arbitrage page
    │   │   ├── CorrelationMatrix.tsx       # Correlation matrix
    │   │   ├── CVD.tsx                     # CVD page
    │   │   ├── Exchanges.tsx               # Exchanges page
    │   │   ├── FundingRates.tsx            # Funding rates page
    │   │   ├── News.tsx                    # News page
    │   │   └── Sentiment.tsx               # Sentiment page
    │   ├── services/
    │   │   └── WebSocketService.ts         # WebSocket service
    │   ├── hooks/
    │   │   └── useWebSocket.ts             # WebSocket hook
    │   ├── config/
    │   │   └── services.ts                 # Service configuration
    │   ├── styles/
    │   │   └── mobile.css                  # Mobile styles
    │   ├── api.ts                          # API utilities
    │   └── apiConfig.ts                    # API configuration
    ├── package.json                        # Node.js dependencies
    ├── package-lock.json                   # Dependency lock file
    ├── tsconfig.json                       # TypeScript configuration
    └── vite.config.ts                      # Vite configuration
```

## 🏗️ **Architecture Overview**

### **Service Breakdown:**

#### **🔧 Go Engine (go_Stream/)**
- **Purpose**: High-performance data collection from exchanges
- **Port**: 8899
- **Status**: ✅ DEPLOYED
- **Key Files**: `cmd/main.go`, `internal/analytics/`, `pkg/broadcaster/`

#### **🐍 Python WebSocket Service**
- **File**: `pulseintel_websocket_service.py`
- **Purpose**: Connects to Go engine, processes VWAP/CVD, forwards to frontend
- **Port**: 8000
- **Status**: 🔄 READY TO DEPLOY

#### **🐍 Python API Service**
- **File**: `pulseintel_api_service.py`
- **Purpose**: External REST API data (CoinGecko, news, etc.)
- **Port**: 8001
- **Status**: 🔄 READY TO DEPLOY

#### **🌐 React Frontend**
- **Directory**: `frontend/`
- **Purpose**: User interface dashboard
- **Status**: 🔄 READY TO DEPLOY

### **Data Flow:**
```
Exchanges → Go Engine → WebSocket Service → Frontend
                     ↘ API Service ↗
```

### **Deployment Files:**
- **Railway Configs**: `railway-*.json` files for each service
- **Dockerfiles**: `Dockerfile.*` for containerization
- **Deployment Guides**: Complete step-by-step instructions

### **Key Features:**
- ✅ Real-time market data processing
- ✅ Advanced analytics (VWAP, CVD, order flow)
- ✅ Multi-exchange support
- ✅ Comprehensive trading dashboard
- ✅ News and sentiment analysis
- ✅ Arbitrage detection
- ✅ Institutional-grade features

**Total Files**: ~100+ files across 4 services
**Languages**: Go, Python, TypeScript/React
**Deployment**: Railway (4 separate services)