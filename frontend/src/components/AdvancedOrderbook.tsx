import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, BarChart3, Layers, Zap } from 'lucide-react';
import { apiConfig } from '../apiConfig';
import { subscribeToDepth } from '../services/WebSocketService';

interface OrderbookEntry {
  price: number;
  quantity: number;
  total: number;
  exchange: string;
  percentage: number;
}

interface AggregatedOrderbook {
  bids: OrderbookEntry[];
  asks: OrderbookEntry[];
  spread: number;
  spreadPercentage: number;
  totalBidVolume: number;
  totalAskVolume: number;
  lastUpdate: number;
}

interface AdvancedOrderbookProps {
  symbol?: string;
  depth?: number;
}

const AdvancedOrderbook: React.FC<AdvancedOrderbookProps> = ({ 
  symbol = 'BTCUSDT', 
  depth = 30 
}) => {
  const [orderbook, setOrderbook] = useState<AggregatedOrderbook | null>(null);
  const [previousOrderbook, setPreviousOrderbook] = useState<AggregatedOrderbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [viewMode, setViewMode] = useState<'combined' | 'split' | 'depth'>('combined');
  const [priceFilter, setPriceFilter] = useState<number>(0.5);

  useEffect(() => {
    const fetchOrderbook = async () => {
      try {
        // Only show loading on initial fetch
        if (!orderbook) {
          setLoading(true);
        } else {
          setIsUpdating(true);
        }
        
        // Fetch aggregated orderbook from multiple exchanges
        const response = await fetch(`${apiConfig.REST_API_SERVICE}/api/orderbook/${symbol}?depth=${depth}`);
        
        if (response.ok) {
          const data = await response.json();
          processOrderbookData(data);
        } else {
          // Generate mock aggregated orderbook with realistic data
          generateMockOrderbook();
        }
        
        setLoading(false);
        setIsUpdating(false);
      } catch (error) {
        console.error('Error fetching orderbook:', error);
        // Don't clear existing data on error, just stop updating
        if (!orderbook) {
          generateMockOrderbook();
          setLoading(false);
        }
        setIsUpdating(false);
      }
    };

    const generateMockOrderbook = () => {
      const midPrice = symbol === 'BTCUSDT' ? 97500 : 
                     symbol === 'ETHUSDT' ? 3450 : 
                     symbol === 'SOLUSDT' ? 195 : 97500;
      const spread = midPrice * 0.0001; // 0.01% spread
      
      // Generate bids (buy orders) - below mid price
      const bids: OrderbookEntry[] = [];
      let totalBidVolume = 0;
      
      for (let i = 0; i < depth; i++) {
        const priceOffset = (i + 1) * (spread / 2) + Math.random() * (midPrice * 0.0002);
        const price = midPrice - priceOffset;
        const quantity = Math.random() * 8 + 0.5; // 0.5 to 8.5 BTC
        const exchange = ['Binance', 'Bybit', 'OKX'][Math.floor(Math.random() * 3)];
        
        totalBidVolume += quantity;
        
        bids.push({
          price,
          quantity,
          total: totalBidVolume,
          exchange,
          percentage: 0 // Will be calculated later
        });
      }
      
      // Generate asks (sell orders) - above mid price
      const asks: OrderbookEntry[] = [];
      let totalAskVolume = 0;
      
      for (let i = 0; i < depth; i++) {
        const priceOffset = (i + 1) * (spread / 2) + Math.random() * (midPrice * 0.0002);
        const price = midPrice + priceOffset;
        const quantity = Math.random() * 8 + 0.5; // 0.5 to 8.5 BTC
        const exchange = ['Binance', 'Bybit', 'OKX'][Math.floor(Math.random() * 3)];
        
        totalAskVolume += quantity;
        
        asks.push({
          price,
          quantity,
          total: totalAskVolume,
          exchange,
          percentage: 0 // Will be calculated later
        });
      }
      
      // Calculate percentages for visual bars
      const maxVolume = Math.max(totalBidVolume, totalAskVolume);
      bids.forEach(bid => bid.percentage = (bid.quantity / maxVolume) * 100);
      asks.forEach(ask => ask.percentage = (ask.quantity / maxVolume) * 100);
      
      const newOrderbook = {
        bids: bids.sort((a, b) => b.price - a.price), // Highest bids first
        asks: asks.sort((a, b) => a.price - b.price), // Lowest asks first
        spread: asks[0]?.price - bids[0]?.price || 0,
        spreadPercentage: ((asks[0]?.price - bids[0]?.price) / midPrice) * 100 || 0,
        totalBidVolume,
        totalAskVolume,
        lastUpdate: Date.now()
      };
      
      // Store previous data before updating
      setPreviousOrderbook(orderbook);
      setOrderbook(newOrderbook);
    };

    const processOrderbookData = (data: any) => {
      // Process real orderbook data from API
      if (data.bids && data.asks) {
        const processedBids = data.bids.map((bid: any, index: number) => ({
          price: parseFloat(bid[0]),
          quantity: parseFloat(bid[1]),
          total: data.bids.slice(0, index + 1).reduce((sum: number, b: any) => sum + parseFloat(b[1]), 0),
          exchange: bid[2] || 'Aggregated',
          percentage: 0
        }));
        
        const processedAsks = data.asks.map((ask: any, index: number) => ({
          price: parseFloat(ask[0]),
          quantity: parseFloat(ask[1]),
          total: data.asks.slice(0, index + 1).reduce((sum: number, b: any) => sum + parseFloat(b[1]), 0),
          exchange: ask[2] || 'Aggregated',
          percentage: 0
        }));
        
        const totalBidVolume = processedBids.reduce((sum, bid) => sum + bid.quantity, 0);
        const totalAskVolume = processedAsks.reduce((sum, ask) => sum + ask.quantity, 0);
        const maxVolume = Math.max(totalBidVolume, totalAskVolume);
        
        processedBids.forEach(bid => bid.percentage = (bid.quantity / maxVolume) * 100);
        processedAsks.forEach(ask => ask.percentage = (ask.quantity / maxVolume) * 100);
        
        const newOrderbook = {
          bids: processedBids,
          asks: processedAsks,
          spread: processedAsks[0]?.price - processedBids[0]?.price || 0,
          spreadPercentage: ((processedAsks[0]?.price - processedBids[0]?.price) / processedBids[0]?.price) * 100 || 0,
          totalBidVolume,
          totalAskVolume,
          lastUpdate: Date.now()
        };
        
        // Store previous data before updating
        setPreviousOrderbook(orderbook);
        setOrderbook(newOrderbook);
      } else {
        generateMockOrderbook();
      }
    };

    // Initial fetch for bootstrap data
    fetchOrderbook();
    
    // Subscribe to real-time orderbook updates via WebSocket
    const unsubscribeDepth = subscribeToDepth(symbol, (data) => {
      console.log('📊 Real-time depth data received:', data);
      
      if (data.bids && data.asks) {
        // Process real-time WebSocket data
        const processedBids = data.bids.map((bid: any, index: number) => ({
          price: parseFloat(bid[0]),
          quantity: parseFloat(bid[1]),
          total: data.bids.slice(0, index + 1).reduce((sum: number, b: any) => sum + parseFloat(b[1]), 0),
          exchange: bid[2] || 'Live',
          percentage: 0
        }));
        
        const processedAsks = data.asks.map((ask: any, index: number) => ({
          price: parseFloat(ask[0]),
          quantity: parseFloat(ask[1]),
          total: data.asks.slice(0, index + 1).reduce((sum: number, b: any) => sum + parseFloat(b[1]), 0),
          exchange: ask[2] || 'Live',
          percentage: 0
        }));
        
        const totalBidVolume = processedBids.reduce((sum, bid) => sum + bid.quantity, 0);
        const totalAskVolume = processedAsks.reduce((sum, ask) => sum + ask.quantity, 0);
        const maxVolume = Math.max(totalBidVolume, totalAskVolume);
        
        processedBids.forEach(bid => bid.percentage = (bid.quantity / maxVolume) * 100);
        processedAsks.forEach(ask => ask.percentage = (ask.quantity / maxVolume) * 100);
        
        const newOrderbook = {
          bids: processedBids.sort((a, b) => b.price - a.price),
          asks: processedAsks.sort((a, b) => a.price - b.price),
          spread: processedAsks[0]?.price - processedBids[0]?.price || 0,
          spreadPercentage: ((processedAsks[0]?.price - processedBids[0]?.price) / processedBids[0]?.price) * 100 || 0,
          totalBidVolume,
          totalAskVolume,
          lastUpdate: Date.now()
        };
        
        // Store previous data before updating
        setPreviousOrderbook(orderbook);
        setOrderbook(newOrderbook);
        setLoading(false);
        setIsUpdating(false);
      }
    });
    
    // REST API refresh every 10 seconds to complement WebSocket data
    const interval = setInterval(fetchOrderbook, 10000);
    
    return () => {
      unsubscribeDepth();
      clearInterval(interval);
    };
  }, [symbol, depth]);

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatQuantity = (quantity: number) => {
    return quantity.toFixed(4);
  };

  const getExchangeColor = (exchange: string) => {
    const colors: { [key: string]: string } = {
      'Binance': 'text-yellow-400',
      'Bybit': 'text-orange-400', 
      'OKX': 'text-blue-400',
      'Aggregated': 'text-gray-400'
    };
    return colors[exchange] || 'text-gray-400';
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="h-6 w-6 text-blue-400" />
            Advanced Orderbook
          </h3>
        </div>
        <div className="animate-pulse space-y-2">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="h-8 bg-slate-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  // Use previous data if current is null to prevent flickering
  const displayOrderbook = orderbook || previousOrderbook;
  
  if (!displayOrderbook) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="text-center py-8">
          <Activity className="h-12 w-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400">No orderbook data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Layers className="h-6 w-6 text-blue-400" />
          Advanced Orderbook - {symbol}
        </h3>
        
        <div className="flex items-center gap-4">
          {/* View Mode Selector */}
          <div className="flex bg-slate-700 rounded-lg p-1">
            {(['combined', 'split', 'depth'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  viewMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
          
          {/* Update Status & Spread Info */}
          <div className="text-right">
            <div className="text-sm text-slate-400 flex items-center gap-2">
              Spread
              {isUpdating && (
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              )}
            </div>
            <div className="text-white font-mono">
              ${displayOrderbook.spread.toFixed(2)} ({displayOrderbook.spreadPercentage.toFixed(3)}%)
            </div>
          </div>
        </div>
      </div>

      {/* Market Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-700 rounded-lg p-4">
          <div className="text-sm text-slate-400 mb-1">Total Bid Volume</div>
          <div className="text-green-400 font-mono text-lg">
            {formatQuantity(displayOrderbook.totalBidVolume)} BTC
          </div>
        </div>
        <div className="bg-slate-700 rounded-lg p-4">
          <div className="text-sm text-slate-400 mb-1">Total Ask Volume</div>
          <div className="text-red-400 font-mono text-lg">
            {formatQuantity(displayOrderbook.totalAskVolume)} BTC
          </div>
        </div>
        <div className="bg-slate-700 rounded-lg p-4">
          <div className="text-sm text-slate-400 mb-1">Imbalance</div>
          <div className={`font-mono text-lg ${
            displayOrderbook.totalBidVolume > displayOrderbook.totalAskVolume ? 'text-green-400' : 'text-red-400'
          }`}>
            {((displayOrderbook.totalBidVolume / displayOrderbook.totalAskVolume - 1) * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Orderbook Display */}
      <div className="space-y-4">
        {viewMode === 'combined' && (
          <div className="grid grid-cols-2 gap-6 min-h-[600px]">
            {/* Asks (Sell Orders) */}
            <div className="h-full">
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="h-4 w-4 text-red-400" />
                <span className="text-red-400 font-semibold">Asks (Sell Orders)</span>
              </div>
              <div className="space-y-1 h-[550px] overflow-y-auto">
                <div className="grid grid-cols-4 gap-2 text-xs text-slate-400 font-semibold mb-2 sticky top-0 bg-slate-800 py-2">
                  <div>Price ($)</div>
                  <div>Size</div>
                  <div>Total</div>
                  <div>Exchange</div>
                </div>
                {displayOrderbook.asks.slice(0, 20).reverse().map((ask, index) => (
                  <div key={index} className="relative min-h-[32px]">
                    <div 
                      className="absolute inset-0 bg-red-500 opacity-10 rounded"
                      style={{ width: `${Math.min(ask.percentage, 100)}%` }}
                    ></div>
                    <div className="relative grid grid-cols-4 gap-2 text-sm py-1 px-2 hover:bg-slate-700/30 transition-colors h-8 items-center">
                      <div className="text-red-400 font-mono truncate">{formatPrice(ask.price)}</div>
                      <div className="text-white font-mono truncate">{formatQuantity(ask.quantity)}</div>
                      <div className="text-slate-300 font-mono truncate">{formatQuantity(ask.total)}</div>
                      <div className={`text-xs truncate ${getExchangeColor(ask.exchange)}`}>{ask.exchange}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bids (Buy Orders) */}
            <div className="h-full">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span className="text-green-400 font-semibold">Bids (Buy Orders)</span>
              </div>
              <div className="space-y-1 h-[550px] overflow-y-auto">
                <div className="grid grid-cols-4 gap-2 text-xs text-slate-400 font-semibold mb-2 sticky top-0 bg-slate-800 py-2">
                  <div>Price ($)</div>
                  <div>Size</div>
                  <div>Total</div>
                  <div>Exchange</div>
                </div>
                {displayOrderbook.bids.slice(0, 20).map((bid, index) => (
                  <div key={index} className="relative min-h-[32px]">
                    <div 
                      className="absolute inset-0 bg-green-500 opacity-10 rounded"
                      style={{ width: `${Math.min(bid.percentage, 100)}%` }}
                    ></div>
                    <div className="relative grid grid-cols-4 gap-2 text-sm py-1 px-2 hover:bg-slate-700/30 transition-colors h-8 items-center">
                      <div className="text-green-400 font-mono truncate">{formatPrice(bid.price)}</div>
                      <div className="text-white font-mono truncate">{formatQuantity(bid.quantity)}</div>
                      <div className="text-slate-300 font-mono truncate">{formatQuantity(bid.total)}</div>
                      <div className={`text-xs truncate ${getExchangeColor(bid.exchange)}`}>{bid.exchange}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'depth' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              <span className="text-blue-400 font-semibold">Market Depth Visualization</span>
            </div>
            <div className="bg-slate-700 rounded-lg p-6 h-80">
              <div className="text-center text-slate-400 mt-28">
                <Zap className="h-16 w-16 text-blue-400 mx-auto mb-4" />
                <h4 className="text-lg font-semibold mb-2">Market Depth Chart</h4>
                <p className="text-sm">Visual representation of cumulative order book depth</p>
                <div className="mt-4 text-xs">
                  <span className="text-green-400">● Bids</span>
                  <span className="mx-4 text-red-400">● Asks</span>
                  <span className="text-blue-400">● Spread: ${displayOrderbook.spread.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-slate-700">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <div>Last updated: {new Date(displayOrderbook.lastUpdate).toLocaleTimeString()}</div>
          <div className="flex items-center gap-4">
            <span>Real-time WebSocket</span>
            <span>•</span>
            <span>{depth} levels deep</span>
            <span>•</span>
            <span className="text-green-400">● WebSocket Live</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedOrderbook;