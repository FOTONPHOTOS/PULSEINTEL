// Market data types
export interface MarketData {
  price: number;
  change: number;
  volume: string;
  symbol: string;
  name?: string;
}

export interface OrderBookEntry {
  price: string;
  size: string;
  side: 'buy' | 'sell';
}

export interface Alert {
  id: string;
  type: 'price' | 'volume' | 'liquidation' | 'other';
  message: string;
  time: string;
  priority: 'high' | 'medium' | 'low';
  read: boolean;
}

// Funding Rate types
export interface FundingRateData {
  symbol: string;
  exchange: string;
  rate: number;
  timestamp: number;
  nextFundingTime?: number;
}

export interface FundingRateStats {
  symbol: string;
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
}

// Exchange data types
export interface ExchangeData {
  name: string;
  volume24h: string;
  openInterest: string;
  takerFee: number;
  makerFee: number;
  liquidation24h: string;
  score: number;
  rank: number;
}

// Liquidation data types
export interface LiquidationEvent {
  symbol: string;
  exchange: string;
  amount: number;
  price: number;
  side: 'long' | 'short';
  timestamp: number;
}

export interface LiquidationHeatmapData {
  symbol: string;
  timeframe: string; // e.g., '1h', '4h', '1d'
  data: Array<{
    time: number;
    price: number;
    intensity: number;
    side: 'long' | 'short';
  }>;
}

// Heatmap types
export interface HeatmapData {
  type: 'funding' | 'liquidity' | 'marketcap' | 'liquidation';
  timeframe?: string;
  data: {
    x: string[] | number[];
    y: string[] | number[];
    values: number[][];
  };
}

// Market Cap Heatmap data
export interface MarketCapHeatmapData {
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

// Component props
export interface MetricCardProps {
  title: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down';
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

export interface MenuItemProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  id: string;
  active: boolean;
  onClick: (id: string) => void;
}

export interface OrderBookProps {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  currentPrice: string;
}

export interface AlertItemProps {
  alert: Omit<Alert, 'id' | 'read'>;
}

export interface FundingRateTableProps {
  rates: FundingRateData[];
  stats?: FundingRateStats;
}

export interface HeatmapProps {
  data: HeatmapData;
  title: string;
  symbol?: string;
}

// Store types
export interface MarketState {
  activeTab: string;
  marketData: Record<string, MarketData>;
  orderBook: {
    bids: OrderBookEntry[];
    asks: OrderBookEntry[];
  };
  alerts: Alert[];
  fundingRates: Record<string, FundingRateData[]>;
  liquidations: LiquidationEvent[];
  exchanges: ExchangeData[];
  setActiveTab: (tab: string) => void;
  updateMarketData: (data: Record<string, Omit<MarketData, 'symbol'>>) => void;
  addAlert: (alert: Omit<Alert, 'id' | 'read'>) => void;
  markAlertAsRead: (alertId: string) => void;
  updateFundingRates: (symbol: string, data: FundingRateData[]) => void;
  updateLiquidations: (data: LiquidationEvent[]) => void;
  updateExchanges: (data: ExchangeData[]) => void;
  updateOrderBook: (data: { bids: OrderBookEntry[]; asks: OrderBookEntry[] }) => void;
}

// Global Stats from CoinGecko
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

// Fear and Greed Index from alternative.me
export interface FearAndGreed {
  value: string;
  value_classification: string;
  timestamp: string;
  time_until_update?: string;
}
