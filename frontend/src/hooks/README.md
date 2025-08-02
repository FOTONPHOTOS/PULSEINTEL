# WebSocket Hooks Migration

The old WebSocket hooks have been removed and replaced with direct component subscriptions.

## Old Pattern (Removed)
```typescript
import { useWebSocket, useMarketData } from '../hooks/useWebSocket';
```

## New Pattern (Current)
```typescript
import { subscribeToTicker, subscribeToOrderbook } from '../api';

// In component:
useEffect(() => {
  const unsubscribe = subscribeToTicker('BTCUSDT', (data) => {
    // Handle data
  });
  return unsubscribe;
}, []);
```

## Available Subscription Functions
- `subscribeToTicker(symbol, callback)` - Trade data
- `subscribeToOrderbook(symbol, callback)` - Orderbook depth
- `subscribeToVwap(symbol, callback)` - VWAP calculations
- `subscribeToWhaleAlerts(symbol, callback)` - Large trades

All subscriptions use the correct channel format (`trade:btcusdt`) and connect to the WebSocket service on port 8000.