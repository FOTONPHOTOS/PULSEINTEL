// PulseIntel Split Architecture Configuration
// Defines which service to use for different types of data

export const SERVICES = {
  // WebSocket Service (Port 8000) - Real-time data
  WEBSOCKET: {
    BASE_URL: 'http://localhost:8000',
    WS_URL: 'ws://localhost:8000/ws',
    ENDPOINTS: {
      // Fast, real-time data from Go engine
      TICKER: '/api/ticker',
      ORDERBOOK: '/api/orderbook', 
      LIQUIDATIONS: '/api/liquidations',
      WHALE_ALERTS: '/api/whale-alerts',
      STATUS: '/api/status'
    },
    WEBSOCKETS: {
      REALTIME: '/realtime',
      TICKER: '/ticker',
      ORDERBOOK: '/orderbook', 
      LIQUIDATIONS: '/liquidations',
      WHALE_ALERTS: '/whale-alerts'
    }
  },

  // REST API Service (Port 8001) - External APIs with caching
  REST_API: {
    BASE_URL: 'http://localhost:8001',
    ENDPOINTS: {
      // Cached external API data
      MARKET_OVERVIEW: '/api/market-overview',
      TOTAL_MARKET_CAP: '/api/total-market-cap',
      NEWS: '/api/news',
      HISTORICAL_PRICE: '/api/historical-price',
      FEAR_GREED_INDEX: '/api/fear-greed-index',
      CACHE_STATUS: '/api/cache-status'
    }
  }
};

// Helper functions for service URLs
export const getWebSocketUrl = (endpoint: string, symbol?: string) => {
  const baseUrl = SERVICES.WEBSOCKET.BASE_URL;
  if (symbol) {
    return `${baseUrl}${endpoint}/${symbol}`;
  }
  return `${baseUrl}${endpoint}`;
};

export const getRestApiUrl = (endpoint: string, symbol?: string) => {
  const baseUrl = SERVICES.REST_API.BASE_URL;
  if (symbol) {
    return `${baseUrl}${endpoint}/${symbol}`;
  }
  return `${baseUrl}${endpoint}`;
};

export const getWebSocketConnection = (endpoint: string, symbol?: string) => {
  const wsUrl = SERVICES.WEBSOCKET.WS_URL;
  if (symbol) {
    return `${wsUrl}${endpoint}/${symbol}`;
  }
  return `${wsUrl}${endpoint}`;
};

// Data refresh intervals (in milliseconds)
export const REFRESH_INTERVALS = {
  // Real-time data (WebSocket) - no polling needed
  REALTIME: 0,
  
  // Cached external data (REST API) - longer intervals
  MARKET_OVERVIEW: 60000,    // 1 minute
  TOTAL_MARKET_CAP: 60000,   // 1 minute  
  NEWS: 300000,              // 5 minutes
  HISTORICAL: 1800000,       // 30 minutes
  FEAR_GREED: 3600000        // 1 hour
};

// Cache configuration
export const CACHE_CONFIG = {
  // Enable client-side caching to reduce API calls
  ENABLE_CLIENT_CACHE: true,
  
  // Cache TTL (time to live) in milliseconds
  TTL: {
    MARKET_OVERVIEW: 300000,   // 5 minutes
    TOTAL_MARKET_CAP: 300000,  // 5 minutes
    NEWS: 600000,              // 10 minutes
    HISTORICAL: 1800000,       // 30 minutes
    FEAR_GREED: 3600000        // 1 hour
  }
};