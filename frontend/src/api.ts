// API utilities for PulseIntel Dashboard
// Split Architecture: REST API (8001) + WebSocket (8000)

export const API_BASE_URL = 'https://api.precision9bot.com/api';  // REST API Service via Cloudflare
export const WS_BASE_URL = 'wss://ws.precision9bot.com/ws';      // WebSocket Service via Cloudflare

export interface OrderbookData {
  symbol: string;
  exchange: string;
  bids: number[][];
  asks: number[][];
  timestamp: number;
}

export interface AnalyticsData {
  symbol: string;
  exchanges: string[];
  arbitrage_opportunities: any[];
  liquidity_analysis: any;
  sentiment_score: number;
  risk_metrics: any;
  heatmap?: {
    x: string[];
    y: string[];
    data: number[][];
  };
}

export interface LiquidationData {
  timestamp: number;
  price: number;
  size: number;
  side: string;
  exchange: string;
  value_usd: number;
}

export interface FundingRateResponse {
  symbol: string;
  rates: Array<{
    exchange: string;
    rate: number;
    nextFundingTime?: number;
    timestamp: number;
  }>;
  stats: {
    avgRate: number;
    highestRate: {
      exchange: string;
      rate: number;
    };
    lowestRate: {
      exchange: string;
      rate: number;
    };
    arbitrageOpportunity?: {
      longExchange: string;
      shortExchange: string;
      difference: number;
    };
  };
}

export interface ExchangesResponse {
  exchanges: Array<{
    name: string;
    volume24h: string;
    openInterest: string;
    takerFee: number;
    makerFee: number;
    liquidation24h: string;
    score: number;
    rank: number;
  }>;
}

export interface MarketCapHeatmapResponse {
  sectors: string[];
  tokens: Array<{
    symbol: string;
    name: string;
    marketCap: number;
    price: number;
    change24h: number;
    sector: string;
  }>;
}

export interface LiquidationHeatmapResponse {
  symbol: string;
  timeframe: string;
  data: Array<{
    time: number;
    price: number;
    intensity: number;
    side: 'long' | 'short';
  }>;
}

export interface OpenInterestResponse {
  open_interest: Array<{
    exchange: string;
    openInterest: number;
    timestamp: number;
  }>;
  stats: {
    totalOpenInterest: number;
    highest: number;
    lowest: number;
  };
}

export interface OrderFlowResponse {
  order_flow: Array<{
    exchange: string;
    buyVolume: number;
    sellVolume: number;
    delta: number;
    timestamp: number;
  }>;
  stats: {
    totalBuy: number;
    totalSell: number;
    totalDelta: number;
  };
}

export interface WhaleTrade {
  exchange: string;
  price: number;
  quantity: number;
  notional: number;
  side?: string;
  timestamp: number;
}

export interface WhaleTrackingResponse {
  whale_trades: WhaleTrade[];
  stats: {
    count: number;
    largest?: WhaleTrade;
  };
}

export interface SentimentResponse {
  sentiment: {
    fear_greed?: {
      value: number;
      classification: string;
      timestamp: number;
    };
    reddit?: any;
  };
  sources: string[];
}

export interface ArbitrageOpportunity {
  buy_exchange: string;
  sell_exchange: string;
  buy_price: number;
  sell_price: number;
  profit_percentage: number;
}

export interface ArbitrageResponse {
  opportunities: ArbitrageOpportunity[];
  stats: {
    count: number;
    max_profit: number;
  };
}

export interface GlobalStats {
  active_cryptocurrencies: number;
  upcoming_icos: number;
  ongoing_icos: number;
  ended_icos: number;
  markets: number;
  total_market_cap: { [key: string]: number };
  total_volume: { [key:string]: number };
  market_cap_percentage: { [key: string]: number };
  market_cap_change_percentage_24h_usd: number;
  updated_at: number;
}

export interface FearAndGreed {
  value: string;
  value_classification: string;
  timestamp: string;
  time_until_update?: string;
}

// Advanced Market Analysis Types
export interface MarketAnalyzerResponse {
  symbol: string;
  timeframe: string;
  current_price: number;
  technical_indicators: {
    rsi: {
      value: number;
      interpretation: string;
    };
    macd: {
      macd_line: number;
      signal_line: number;
      histogram: number;
      interpretation: string;
    };
    moving_averages: {
      ma_50: number;
      ma_200: number;
      interpretation: string;
    };
    volatility: {
      bollinger_width: number;
      atr: number;
      interpretation: string;
    };
  };
  liquidity_analysis: {
    buy_wall_strength: number;
    sell_wall_strength: number;
    imbalance: number;
    interpretation: string;
  };
  price_levels: {
    support: number[];
    resistance: number[];
  };
  volume_profile: Array<{
    price: number;
    volume: number;
  }>;
  market_sentiment: {
    score: number;
    interpretation: string;
  };
  market_condition: string;
}

export interface MarketScannerResponse {
  scan_time: number;
  results: Array<{
    symbol: string;
    price: number;
    volume_24h: number;
    change_24h: number;
    volatility: number;
    exchanges: number;
    anomaly_scores: {
      volume: number;
      price: number;
      overall: number;
    };
  }>;
  filter: {
    min_volume: number;
    sort_by: string;
    limit: number;
  };
  stats: {
    total_markets_scanned: number;
    high_volatility_count: number;
    high_volume_count: number;
    significant_movers_count: number;
  };
}

export interface CorrelationMatrixResponse {
  timeframe: string;
  symbols: string[];
  correlation_matrix: number[][];
  symbol_stats: Record<string, {
    price: number;
    volatility: number;
    beta: number;
    liquidity_score: number;
  }>;
  analysis: {
    highest_correlation: {
      value: number;
      description: string;
    };
    lowest_correlation: {
      value: number;
      description: string;
    };
    average_correlation: {
      value: number;
      description: string;
    };
  };
}

// WebSocket connection manager with proper channel subscriptions
class WebSocketManager {
  private connection: WebSocket | null = null;
  private subscribers: Map<string, Set<(data: any) => void>> = new Map();
  private isConnecting: boolean = false;

  private async ensureConnection(): Promise<WebSocket> {
    if (this.connection && this.connection.readyState === WebSocket.OPEN) {
      return this.connection;
    }

    if (this.isConnecting) {
      // Wait for existing connection attempt
      return new Promise((resolve, reject) => {
        const checkConnection = () => {
          if (this.connection && this.connection.readyState === WebSocket.OPEN) {
            resolve(this.connection);
          } else if (!this.isConnecting) {
            reject(new Error('Connection failed'));
          } else {
            setTimeout(checkConnection, 100);
          }
        };
        checkConnection();
      });
    }

    this.isConnecting = true;
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(WS_BASE_URL);
      
      ws.onopen = () => {
        console.log('✅ WebSocket connected to PulseIntel service');
        this.connection = ws;
        this.isConnecting = false;
        resolve(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle subscription confirmations
          if (data.status === 'success') {
            console.log(`📈 ${data.message}`);
            return;
          }
          
          // Route data to appropriate subscribers based on type and symbol
          const messageType = data.type;
          const symbol = data.symbol;
          
          console.log(`📨 WebSocketManager: Received message:`, data);
          console.log(`🔍 WebSocketManager: messageType=${messageType}, symbol=${symbol}`);
          
          if (messageType && symbol) {
            const channel = `${messageType}:${symbol}`;
            const callbacks = this.subscribers.get(channel);
            
            console.log(`🎯 WebSocketManager: Looking for subscribers to ${channel}`);
            console.log(`📊 WebSocketManager: Found ${callbacks?.size || 0} subscribers`);
            console.log(`🗂️ WebSocketManager: All channels:`, Array.from(this.subscribers.keys()));
            
            if (callbacks && callbacks.size > 0) {
              console.log(`📤 WebSocketManager: Forwarding data to ${callbacks.size} subscribers`);
              callbacks.forEach((cb) => {
                console.log(`🚀 WebSocketManager: Calling callback with data:`, data);
                cb(data);
              });
            } else {
              console.warn(`⚠️ WebSocketManager: No subscribers for ${channel}`);
            }
          } else {
            console.warn(`⚠️ WebSocketManager: Missing messageType or symbol:`, {messageType, symbol});
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        reject(error);
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket connection closed');
        this.connection = null;
        this.isConnecting = false;
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (this.subscribers.size > 0) {
            console.log('🔄 Attempting to reconnect WebSocket...');
            this.reconnectAll();
          }
        }, 3000);
      };
    });
  }

  private async reconnectAll(): Promise<void> {
    try {
      await this.ensureConnection();
      // Resubscribe to all channels
      for (const channel of this.subscribers.keys()) {
        await this.subscribeToChannel(channel);
      }
    } catch (error) {
      console.error('Failed to reconnect:', error);
    }
  }

  private async subscribeToChannel(channel: string): Promise<void> {
    try {
      const ws = await this.ensureConnection();
      const subscriptionMessage = {
        action: "subscribe",
        channel: channel
      };
      ws.send(JSON.stringify(subscriptionMessage));
      console.log(`📡 Subscribed to channel: ${channel}`);
    } catch (error) {
      console.error(`Failed to subscribe to ${channel}:`, error);
    }
  }

  public async connect(channel: string, callback: (data: any) => void): Promise<void> {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    this.subscribers.get(channel)!.add(callback);

    // Subscribe to the channel if this is the first subscriber
    if (this.subscribers.get(channel)!.size === 1) {
      await this.subscribeToChannel(channel);
    }
  }

  public async disconnect(channel: string, callback: (data: any) => void): Promise<void> {
    const subscribers = this.subscribers.get(channel);
    if (subscribers) {
      subscribers.delete(callback);
      if (subscribers.size === 0) {
        // Unsubscribe from the channel
        try {
          const ws = await this.ensureConnection();
          const unsubscribeMessage = {
            action: "unsubscribe",
            channel: channel
          };
          ws.send(JSON.stringify(unsubscribeMessage));
          console.log(`📉 Unsubscribed from channel: ${channel}`);
        } catch (error) {
          console.error(`Failed to unsubscribe from ${channel}:`, error);
        }
        this.subscribers.delete(channel);
      }
    }
  }

  public isConnected(): boolean {
    return this.connection?.readyState === WebSocket.OPEN || false;
  }
}

// Global WebSocket manager instance
export const wsManager = new WebSocketManager();

export function subscribeToVwap(symbol: string, callback: (data: any) => void): () => void {
  const channel = `vwap:${symbol.toLowerCase()}`;
  wsManager.connect(channel, callback);
  return () => wsManager.disconnect(channel, callback);
}

export function subscribeToCvd(symbol: string, callback: (data: any) => void): () => void {
  const channel = `cvd:${symbol.toLowerCase()}`;
  wsManager.connect(channel, callback);
  return () => wsManager.disconnect(channel, callback);
}

// WebSocket-first API functions (with REST fallback)

export function subscribeToLiquidations(symbol: string, callback: (data: any) => void): () => void {
  const channel = `liquidation:${symbol.toLowerCase()}`;
  wsManager.connect(channel, callback);
  return () => wsManager.disconnect(channel, callback);
}

export function subscribeToWhaleAlerts(symbol: string, callback: (data: any) => void): () => void {
  const channel = `whale:${symbol.toLowerCase()}`;
  wsManager.connect(channel, callback);
  return () => wsManager.disconnect(channel, callback);
}

export function subscribeToOrderbook(symbol: string, callback: (data: any) => void): () => void {
  const channel = `depth:${symbol.toLowerCase()}`;
  wsManager.connect(channel, callback);
  return () => wsManager.disconnect(channel, callback);
}

export function subscribeToTicker(symbol: string, callback: (data: any) => void): () => void {
  const channel = `trade:${symbol.toLowerCase()}`;
  wsManager.connect(channel, callback);
  return () => wsManager.disconnect(channel, callback);
}

export function subscribeToOrderFlow(symbol: string, callback: (data: any) => void): () => void {
  const channel = `order_flow:${symbol.toLowerCase()}`;
  wsManager.connect(channel, callback);
  return () => wsManager.disconnect(channel, callback);
}

export function subscribeToOptions(symbol: string, callback: (data: any) => void): () => void {
  const channel = `options:${symbol.toLowerCase()}`;
  wsManager.connect(channel, callback);
  return () => wsManager.disconnect(channel, callback);
}

export function subscribeToSocialSentiment(symbol: string, callback: (data: any) => void): () => void {
  const channel = `social_sentiment:${symbol.toLowerCase()}`;
  wsManager.connect(channel, callback);
  return () => wsManager.disconnect(channel, callback);
}

export function subscribeToWhaleTrades(symbol: string, callback: (data: any) => void): () => void {
  const channel = `whale_trades:${symbol.toLowerCase()}`;
  wsManager.connect(channel, callback);
  return () => wsManager.disconnect(channel, callback);
}

// Generic fetch wrapper with error handling
async function fetchAPI<T>(endpoint: string): Promise<T> {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`API fetch error for ${endpoint}:`, error);
    throw new Error(`Failed to fetch data from backend: ${error}`);
  }
}

// Fetch orderbook data for a symbol
export async function fetchOrderbook(symbol: string): Promise<OrderbookData> {
  return fetchAPI<OrderbookData>(`/orderbook/${symbol}`);
}

// Fetch analytics data for a symbol
export async function fetchAnalytics(symbol: string): Promise<AnalyticsData> {
  return fetchAPI<AnalyticsData>(`/analytics/${symbol}`);
}

// Fetch recent liquidations for a symbol (real backend only)
export async function fetchLiquidations(symbol: string): Promise<LiquidationData[]> {
  const response = await fetchAPI<{liquidations: LiquidationData[], timestamp?: number, message?: string}>(`/liquidations/${symbol}`);
  // Return the liquidations array, handling both old and new API response formats
  return Array.isArray(response) ? response : response.liquidations || [];
}

// Fetch funding rates for a symbol (real backend only)
export async function fetchFundingRates(symbol: string): Promise<FundingRateResponse> {
  return await fetchAPI<FundingRateResponse>(`/funding-rates/${symbol}`);
}

// Fetch exchange data (real backend only)
export async function fetchExchanges(): Promise<ExchangesResponse> {
  return await fetchAPI<ExchangesResponse>('/exchanges');
}

// Fetch market cap heatmap data (real backend only)
export async function fetchMarketCapHeatmap(): Promise<MarketCapHeatmapResponse> {
  return await fetchAPI<MarketCapHeatmapResponse>('/market-cap-heatmap');
}

// Fetch liquidation heatmap data
export async function fetchLiquidationHeatmap(symbol: string, timeframe: string = '1d'): Promise<LiquidationHeatmapResponse> {
  return await fetchAPI<LiquidationHeatmapResponse>(`/liquidation-heatmap/${symbol}?timeframe=${timeframe}`);
}

// Fetch open interest for a symbol (real backend only)
export async function fetchOpenInterest(symbol: string): Promise<OpenInterestResponse> {
  return await fetchAPI<OpenInterestResponse>(`/open-interest/${symbol}`);
}

// Fetch order flow for a symbol (real backend only)
export async function fetchOrderFlow(symbol: string): Promise<OrderFlowResponse> {
  return fetchAPI<OrderFlowResponse>(`/order-flow/${symbol}`);
}

// Fetch whale tracking data for a symbol (real backend only)
export async function fetchWhaleTracking(symbol: string): Promise<WhaleTrackingResponse> {
  return fetchAPI<WhaleTrackingResponse>(`/whale-tracking/${symbol}`);
}

// Fetch sentiment data for a symbol (real backend only)
export async function fetchSentiment(symbol: string): Promise<SentimentResponse> {
  return fetchAPI<SentimentResponse>(`/sentiment/${symbol}`);
}

// Fetch arbitrage opportunities for a symbol (real backend only)
export async function fetchArbitrage(symbol: string): Promise<ArbitrageResponse> {
  return fetchAPI<ArbitrageResponse>(`/arbitrage/${symbol}`);
}

// Fetch advanced market analysis for a symbol
export async function fetchMarketAnalyzer(symbol: string, timeframe: string = '1d'): Promise<MarketAnalyzerResponse> {
  return fetchAPI<MarketAnalyzerResponse>(`/market-analyzer/${symbol}?timeframe=${timeframe}`);
}

// Fetch market scanner results
export async function fetchMarketScanner(minVolume: number = 1000000, sortBy: string = 'volume', limit: number = 20): Promise<MarketScannerResponse> {
  return fetchAPI<MarketScannerResponse>(`/market-scanner?min_volume=${minVolume}&sort_by=${sortBy}&limit=${limit}`);
}

// Fetch correlation matrix for a set of symbols
export async function fetchCorrelationMatrix(symbols: string[], timeframe: string = '1d'): Promise<CorrelationMatrixResponse> {
  const symbolsParam = symbols.join(',');
  return fetchAPI(`/correlation-matrix?symbols=${symbolsParam}&timeframe=${timeframe}`);
}

export async function fetchGlobalMarketStats(): Promise<GlobalStats> {
  return fetchAPI('/global-market-stats');
}

export async function fetchFearAndGreedIndex(): Promise<FearAndGreed> {
  return fetchAPI('/fear-and-greed-index');
}

// Advanced Liquidation Intelligence API calls
export async function fetchWhaleAlerts(symbol: string, threshold: number = 1000000) {
  return fetchAPI(`/whale-alerts/${symbol}?threshold=${threshold}`);
}

export async function fetchLiquidationCascade(symbol: string, timeframe: string = '1h') {
  return fetchAPI(`/liquidation-cascade/${symbol}?timeframe=${timeframe}`);
}

export async function fetchOIAnalysis(symbol: string) {
  return fetchAPI(`/oi-analysis/${symbol}`);
}