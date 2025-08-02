
// =============================================================================
// PulseIntel API Configuration
// =============================================================================
// This file serves as the single source of truth for all backend service
// endpoints. Centralizing this configuration makes it easy to manage
// different environments (development, staging, production) and prevents
// hardcoded URLs from being scattered across the codebase.

// -----------------------------------------------------------------------------
// Environment Detection
// -----------------------------------------------------------------------------
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

// -----------------------------------------------------------------------------
// Service Base URLs
// -----------------------------------------------------------------------------
// In development, we connect to the locally running Python services.
// In production, these would be replaced with the deployed service URLs.

const API_BASE_URLS = {
  // Service 1: Real-Time Data (WebSocket)
  // Handles live market data streams.
  WEBSOCKET_SERVICE: IS_DEVELOPMENT
    ? 'ws://localhost:8000'
    : 'wss://your-production-websocket-service.com',

  // Service 2: REST API Service (Main API)
  // Handles all REST API endpoints including market data, news, etc.
  REST_API_SERVICE: IS_DEVELOPMENT
    ? 'http://localhost:8001'
    : 'https://your-production-api.com',

  // Service 3: Analytics API (REST)
  // Handles computed analytics and cached data.
  ANALYTICS_API_SERVICE: IS_DEVELOPMENT
    ? 'http://localhost:8001'
    : 'https://your-production-analytics-api.com',

  // Service 4: External Data API (REST)
  // Handles third-party API integrations (news, global data).
  EXTERNAL_API_SERVICE: IS_DEVELOPMENT
    ? 'http://localhost:8001'
    : 'https://your-production-external-api.com',

  // Service 5: Historical Data API (REST)
  // Handles historical data and backtesting.
  HISTORICAL_API_SERVICE: IS_DEVELOPMENT
    ? 'http://localhost:8001'
    : 'https://your-production-historical-api.com',
    
  // Legacy or other services (e.g., the service on port 8888)
  // We can define fallbacks or alternative endpoints here.
  LEGACY_PRECISION9_API: IS_DEVELOPMENT
    ? 'http://localhost:8888'
    : 'https://your-legacy-api.com',
};

// -----------------------------------------------------------------------------
// Exporting the Configuration
// -----------------------------------------------------------------------------
export const apiConfig = API_BASE_URLS;
