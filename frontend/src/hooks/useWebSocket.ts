// DEPRECATED: This file is a stub to prevent import errors
// All WebSocket functionality has been moved to direct subscriptions in components
// See: ../api.ts for the new WebSocket manager

console.warn('⚠️ DEPRECATED: useWebSocket hooks are no longer supported. Use direct subscriptions from ../api.ts instead.');

// Stub implementations to prevent runtime errors
export const useWebSocket = () => {
  console.warn('useWebSocket is deprecated. Use subscribeToTicker, subscribeToOrderbook, etc. from ../api.ts');
  return { lastMessage: null, readyState: 0 };
};

export const useMarketData = () => {
  console.warn('useMarketData is deprecated. Use direct subscriptions in components.');
  return { ticker: null, orderbook: null };
};

export const useRealtimeData = () => {
  console.warn('useRealtimeData is deprecated. Use direct subscriptions in components.');
  return null;
};

export const useGlobalStats = () => {
  console.warn('useGlobalStats is deprecated. Use REST API calls instead.');
  return { globalStats: {}, loading: false };
};

export const useMultiSymbolData = () => {
  console.warn('useMultiSymbolData is deprecated. Use direct subscriptions for each symbol.');
  return {};
};

export const useExchangeData = () => {
  console.warn('useExchangeData is deprecated. Use REST API calls instead.');
  return { exchanges: [], loading: false };
};