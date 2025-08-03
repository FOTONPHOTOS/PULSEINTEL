
// =============================================================================
// PulseIntel API Configuration
// =============================================================================
// This file serves as the single source of truth for all backend service
// endpoints. Centralizing this configuration makes it easy to manage
// different environments (development, staging, production) and prevents
// hardcoded URLs from being scattered across the codebase.

// -----------------------------------------------------------------------------
// Environment Detection & Type Safety
// -----------------------------------------------------------------------------
const IS_DEVELOPMENT = import.meta.env.MODE === 'development';

// -----------------------------------------------------------------------------
// Service Base URLs - CORRECT ARCHITECTURE
// -----------------------------------------------------------------------------
// Architecture: Go Engine → pulseintel_websocket_service.py (Real-time WebSocket data)
//              pulseintel_api_service.py (Independent REST API service)

const API_BASE_URLS = {
  // Service 1: WebSocket Service (Connected to Go Engine)
  // Connects to Go engine, processes real-time data (VWAP, CVD), forwards to frontend
  WEBSOCKET_SERVICE: import.meta.env.VITE_WEBSOCKET_URL || 
                     (process.env as any).REACT_APP_WEBSOCKET_URL || 
                     (IS_DEVELOPMENT ? 'ws://localhost:8000' : 'wss://your-production-websocket-service.com'),

  // Service 2: REST API Service (Independent)
  // Pulls external REST API data (CoinGecko, Binance, etc.) to avoid bottlenecks
  REST_API_SERVICE: import.meta.env.VITE_API_URL || 
                    (process.env as any).REACT_APP_API_URL || 
                    (IS_DEVELOPMENT ? 'http://localhost:8001' : 'https://your-production-api.com'),

  // All REST endpoints route through the API service
  ANALYTICS_API_SERVICE: import.meta.env.VITE_API_URL || 
                         (process.env as any).REACT_APP_API_URL || 
                         (IS_DEVELOPMENT ? 'http://localhost:8001' : 'https://your-production-analytics-api.com'),

  EXTERNAL_API_SERVICE: import.meta.env.VITE_API_URL || 
                        (process.env as any).REACT_APP_API_URL || 
                        (IS_DEVELOPMENT ? 'http://localhost:8001' : 'https://your-production-external-api.com'),

  HISTORICAL_API_SERVICE: import.meta.env.VITE_API_URL || 
                          (process.env as any).REACT_APP_API_URL || 
                          (IS_DEVELOPMENT ? 'http://localhost:8001' : 'https://your-production-historical-api.com'),

  MAIN_API_SERVICE: import.meta.env.VITE_API_URL || 
                    (process.env as any).REACT_APP_API_URL || 
                    (IS_DEVELOPMENT ? 'http://localhost:8001' : 'https://your-production-api.com'),
    
  // Legacy services
  LEGACY_PRECISION9_API: IS_DEVELOPMENT
    ? 'http://localhost:8888'
    : 'https://your-legacy-api.com',
};

// -----------------------------------------------------------------------------
// Exporting the Configuration
// -----------------------------------------------------------------------------
export const apiConfig = API_BASE_URLS;
