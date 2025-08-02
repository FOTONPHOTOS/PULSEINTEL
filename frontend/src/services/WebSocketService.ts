/**
 * Centralized WebSocket Service for Dashboard Components
 * Uses direct WebSocket connection (proven to work)
 */

export interface WebSocketData {
  type: 'trade' | 'depth' | 'vwap' | 'cvd';
  symbol: string;
  timestamp: number;
  [key: string]: any;
}

export type WebSocketCallback = (data: WebSocketData) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<WebSocketCallback>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
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
    console.log('🔌 WebSocketService: Connecting to ws://localhost:8000');

    this.ws = new WebSocket('ws://localhost:8000');

    this.ws.onopen = () => {
      console.log('✅ WebSocketService: Connected successfully');
      this.isConnecting = false;
      this.reconnectAttempts = 0;

      // Resubscribe to all channels
      this.resubscribeAll();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle subscription confirmations
        if (data.status === 'success') {
          console.log(`✅ WebSocketService: ${data.message}`);
          return;
        }

        // Route data to subscribers
        if (data.type && data.symbol) {
          const channel = `${data.type}:${data.symbol}`;
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

      // Attempt to reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`🔄 WebSocketService: Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(() => this.connect(), this.reconnectDelay * this.reconnectAttempts);
      }
    };
  }

  private resubscribeAll() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const channels = Array.from(this.subscribers.keys());
    channels.forEach(channel => {
      if (this.subscribers.get(channel)?.size! > 0) {
        this.ws!.send(JSON.stringify({
          action: "subscribe",
          channel: channel
        }));
        console.log(`📡 WebSocketService: Resubscribed to ${channel}`);
      }
    });
  }

  public subscribe(type: string, symbol: string, callback: WebSocketCallback): () => void {
    const channel = `${type}:${symbol.toLowerCase()}`;
    
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    
    this.subscribers.get(channel)!.add(callback);
    console.log(`📈 WebSocketService: Added subscriber to ${channel} (total: ${this.subscribers.get(channel)!.size})`);

    // Subscribe to channel if this is the first subscriber
    if (this.subscribers.get(channel)!.size === 1) {
      this.subscribeToChannel(channel);
    }

    // Return unsubscribe function
    return () => {
      const channelSubscribers = this.subscribers.get(channel);
      if (channelSubscribers) {
        channelSubscribers.delete(callback);
        console.log(`📉 WebSocketService: Removed subscriber from ${channel} (remaining: ${channelSubscribers.size})`);
        
        // Unsubscribe from channel if no more subscribers
        if (channelSubscribers.size === 0) {
          this.unsubscribeFromChannel(channel);
          this.subscribers.delete(channel);
        }
      }
    };
  }

  private subscribeToChannel(channel: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: "subscribe",
        channel: channel
      }));
      console.log(`📡 WebSocketService: Subscribed to ${channel}`);
    } else {
      console.log(`⏳ WebSocketService: Queued subscription to ${channel} (not connected)`);
    }
  }

  private unsubscribeFromChannel(channel: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        action: "unsubscribe",
        channel: channel
      }));
      console.log(`📡 WebSocketService: Unsubscribed from ${channel}`);
    }
  }

  public getConnectionStatus(): 'connecting' | 'connected' | 'disconnected' {
    if (this.isConnecting) return 'connecting';
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return 'connected';
    return 'disconnected';
  }

  public getSubscriberCount(): number {
    let total = 0;
    this.subscribers.forEach(callbacks => {
      total += callbacks.size;
    });
    return total;
  }
}

// Create singleton instance
export const webSocketService = new WebSocketService();

// Convenience functions for common subscriptions
export const subscribeToTrades = (symbol: string, callback: WebSocketCallback) => 
  webSocketService.subscribe('trade', symbol, callback);

export const subscribeToDepth = (symbol: string, callback: WebSocketCallback) => 
  webSocketService.subscribe('depth', symbol, callback);

export const subscribeToVWAP = (symbol: string, callback: WebSocketCallback) => 
  webSocketService.subscribe('vwap', symbol, callback);

export const subscribeToCVD = (symbol: string, callback: WebSocketCallback) => 
  webSocketService.subscribe('cvd', symbol, callback);