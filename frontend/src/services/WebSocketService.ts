/**
 * Centralized WebSocket Service for Dashboard Components
 * Uses direct WebSocket connection (proven to work)
 */

export interface WebSocketData {
  type: 'trade' | 'depth' | 'vwap' | 'cvd' | 'candle' | 'liquidations';
  symbol: string;
  timestamp: number;
  [key: string]: any;
}

export type WebSocketCallback = (data: WebSocketData) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<WebSocketCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10; // Increased for more resilience
  private reconnectDelay = 1000;
  private isConnecting = false;

  constructor() {
    this.connect();
  }

  private connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.isConnecting = true;
    
    // Use environment variable or fallback to localhost
    const wsUrl = (process.env.REACT_APP_WEBSOCKET_URL || 
                   (import.meta.env as any)?.VITE_WEBSOCKET_URL || 
                   'ws://localhost:8000')
      .replace('https://', 'wss://')
      .replace('http://', 'ws://');
    
    console.log('🔌 WebSocketService: Connecting to', wsUrl);

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('✅ WebSocketService: Connected successfully');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.resubscribeAll();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.status === 'success') {
          console.log(`✅ WebSocketService: ${data.message}`);
          return;
        }

        if (data.type && data.symbol) {
          const channel = `${data.type}:${data.symbol.toLowerCase()}`;
          const callbacks = this.subscribers.get(channel);
          
          if (callbacks && callbacks.size > 0) {
            callbacks.forEach(callback => {
              try {
                callback(data);
              } catch (error) {
                console.error('❌ WebSocketService: Error in callback:', error);
              }
            });
          }
        }
      } catch (error) {
        console.error('❌ WebSocketService: Error parsing message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ WebSocketService: Connection error:', error);
      this.isConnecting = false;
    };

    this.ws.onclose = () => {
      console.log('🔌 WebSocketService: Connection closed');
      this.isConnecting = false;
      this.ws = null;

      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`🔄 WebSocketService: Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
      } else {
        console.error('❌ WebSocketService: Max reconnect attempts reached.');
      }
    };
  }

  private resubscribeAll() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.subscribers.forEach((callbacks, channel) => {
      if (callbacks.size > 0) {
        this.subscribeToChannel(channel);
      }
    });
  }

  public subscribe(type: string, symbol: string, callback: WebSocketCallback): () => void {
    const channel = `${type}:${symbol.toLowerCase()}`;
    
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    
    const channelSubscribers = this.subscribers.get(channel)!;
    channelSubscribers.add(callback);
    console.log(`📈 WebSocketService: Added subscriber to ${channel} (total: ${channelSubscribers.size})`);

    if (channelSubscribers.size === 1) {
      this.subscribeToChannel(channel);
    }

    return () => {
      channelSubscribers.delete(callback);
      console.log(`📉 WebSocketService: Removed subscriber from ${channel} (remaining: ${channelSubscribers.size})`);
      
      if (channelSubscribers.size === 0) {
        this.unsubscribeFromChannel(channel);
        this.subscribers.delete(channel);
      }
    };
  }

  private subscribeToChannel(channel: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: "subscribe", channel }));
      console.log(`📡 WebSocketService: Subscribed to ${channel}`);
    } else {
      console.log(`⏳ WebSocketService: Queued subscription to ${channel} (not connected)`);
    }
  }

  private unsubscribeFromChannel(channel: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: "unsubscribe", channel }));
      console.log(`📡 WebSocketService: Unsubscribed from ${channel}`);
    }
  }
}

export const webSocketService = new WebSocketService();

// --- Convenience Functions for Subscriptions ---

export const subscribeToTrades = (symbol: string, callback: WebSocketCallback) => 
  webSocketService.subscribe('trade', symbol, callback);

export const subscribeToDepth = (symbol: string, callback: WebSocketCallback) => 
  webSocketService.subscribe('depth', symbol, callback);

export const subscribeToVWAP = (symbol: string, callback: WebSocketCallback) => 
  webSocketService.subscribe('vwap', symbol, callback);

export const subscribeToCVD = (symbol: string, callback: WebSocketCallback) => 
  webSocketService.subscribe('cvd', symbol, callback);

export const subscribeToCandles = (symbol: string, interval: string, callback: WebSocketCallback) => 
  webSocketService.subscribe(`candle:${interval}`, symbol, callback);

export const subscribeToLiquidations = (symbol: string, callback: WebSocketCallback) => 
  webSocketService.subscribe('liquidations', symbol, callback);

// --- Convenience Functions for Unsubscriptions (Optional but good practice) ---

export const unsubscribeFromTrades = (symbol: string, callback: WebSocketCallback) => {
  // The subscribe method returns the unsubscribe function. 
  // This is a placeholder for a more explicit unsubscribe API if needed later.
};

export const unsubscribeFromDepth = (symbol: string, callback: WebSocketCallback) => {};
export const unsubscribeFromVWAP = (symbol: string, callback: WebSocketCallback) => {};
export const unsubscribeFromCVD = (symbol: string, callback: WebSocketCallback) => {};
export const unsubscribeFromCandles = (symbol: string, interval: string, callback: WebSocketCallback) => {};
export const unsubscribeFromLiquidations = (symbol: string, callback: WebSocketCallback) => {};
