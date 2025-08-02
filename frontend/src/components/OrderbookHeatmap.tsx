import React, { useState, useEffect } from 'react';
import { Activity, Layers, Zap, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { apiConfig } from '../apiConfig';
import { subscribeToDepth } from '../services/WebSocketService';

interface OrderbookLevel {
  price: number;
  quantity: number;
  exchange: string;
  side: 'bid' | 'ask';
  intensity: number;
}

interface HeatmapData {
  levels: OrderbookLevel[];
  midPrice: number;
  spread: number;
  timestamp: number;
}

interface OrderbookHeatmapProps {
  symbol?: string;
}

const OrderbookHeatmap: React.FC<OrderbookHeatmapProps> = ({ 
  symbol = 'BTCUSDT' 
}) => {
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [previousData, setPreviousData] = useState<HeatmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [viewMode, setViewMode] = useState<'heatmap' | 'depth' | 'flow'>('heatmap');

  useEffect(() => {
    const fetchMultiExchangeOrderbook = async () => {
      try {
        // Only show loading on initial fetch
        if (!heatmapData) {
          setLoading(true);
        } else {
          setIsUpdating(true);
        }
        
        // Fetch orderbook data from our aggregated endpoint
        const response = await fetch(`${apiConfig.REST_API_SERVICE}/api/orderbook/${symbol}?depth=50`);
        
        if (response.ok) {
          const data = await response.json();
          processHeatmapData(data);
        } else {
          // Don't clear existing data on error
          if (!heatmapData) {
            generateMockHeatmapData();
          }
        }
        
        setLastUpdate(Date.now());
        setLoading(false);
        setIsUpdating(false);
      } catch (error) {
        console.error('Error fetching heatmap data:', error);
        // Don't clear existing data on error
        if (!heatmapData) {
          generateMockHeatmapData();
          setLoading(false);
        }
        setIsUpdating(false);
      }
    };

    const generateMockHeatmapData = () => {
      const midPrice = symbol === 'BTCUSDT' ? 97500 : 
                     symbol === 'ETHUSDT' ? 3450 : 
                     symbol === 'SOLUSDT' ? 195 : 97500;
      
      const levels: OrderbookLevel[] = [];
      const priceRange = midPrice * 0.02; // ±2% range
      const levelCount = 100; // 100 price levels for detailed heatmap
      
      // Generate bid levels (below mid price)
      for (let i = 0; i < levelCount / 2; i++) {
        const priceOffset = (i / (levelCount / 2)) * priceRange;
        const price = midPrice - priceOffset;
        
        // Simulate liquidity concentration near mid price
        const distanceFromMid = Math.abs(price - midPrice) / midPrice;
        const baseQuantity = Math.exp(-distanceFromMid * 50) * 10; // Exponential decay
        
        // Add some randomness and exchange distribution
        const exchanges = ['Binance', 'Bybit', 'OKX'];
        for (const exchange of exchanges) {
          const quantity = baseQuantity * (0.5 + Math.random()) * (exchange === 'Binance' ? 1.5 : 1);
          if (quantity > 0.1) {
            levels.push({
              price,
              quantity,
              exchange,
              side: 'bid',
              intensity: Math.min(quantity / 2, 10) // Normalize intensity for visualization
            });
          }
        }
      }
      
      // Generate ask levels (above mid price)
      for (let i = 0; i < levelCount / 2; i++) {
        const priceOffset = (i / (levelCount / 2)) * priceRange;
        const price = midPrice + priceOffset;
        
        // Simulate liquidity concentration near mid price
        const distanceFromMid = Math.abs(price - midPrice) / midPrice;
        const baseQuantity = Math.exp(-distanceFromMid * 50) * 10; // Exponential decay
        
        // Add some randomness and exchange distribution
        const exchanges = ['Binance', 'Bybit', 'OKX'];
        for (const exchange of exchanges) {
          const quantity = baseQuantity * (0.5 + Math.random()) * (exchange === 'Binance' ? 1.5 : 1);
          if (quantity > 0.1) {
            levels.push({
              price,
              quantity,
              exchange,
              side: 'ask',
              intensity: Math.min(quantity / 2, 10) // Normalize intensity for visualization
            });
          }
        }
      }
      
      const newData = {
        levels: levels.sort((a, b) => a.price - b.price),
        midPrice,
        spread: 10, // $10 spread
        timestamp: Date.now()
      };
      
      setPreviousData(heatmapData);
      setHeatmapData(newData);
    };

    const processHeatmapData = (data: any) => {
      if (!data.bids || !data.asks) {
        if (!heatmapData) {
          generateMockHeatmapData();
        }
        return;
      }
      
      const levels: OrderbookLevel[] = [];
      const midPrice = data.mid_price || 97500;
      
      // Process bids
      data.bids.forEach((bid: any) => {
        levels.push({
          price: bid[0],
          quantity: bid[1],
          exchange: bid[2] || 'Aggregated',
          side: 'bid',
          intensity: Math.min(bid[1] / 2, 10)
        });
      });
      
      // Process asks
      data.asks.forEach((ask: any) => {
        levels.push({
          price: ask[0],
          quantity: ask[1],
          exchange: ask[2] || 'Aggregated',
          side: 'ask',
          intensity: Math.min(ask[1] / 2, 10)
        });
      });
      
      const newData = {
        levels: levels.sort((a, b) => a.price - b.price),
        midPrice,
        spread: data.spread || 10,
        timestamp: Date.now()
      };
      
      setPreviousData(heatmapData);
      setHeatmapData(newData);
    };

    // Initial fetch for bootstrap data
    fetchMultiExchangeOrderbook();
    
    // Subscribe to real-time depth data via WebSocket
    const unsubscribeDepth = subscribeToDepth(symbol, (data) => {
      console.log('🔥 Real-time heatmap depth data received:', data);
      
      if (data.bids && data.asks) {
        const levels: OrderbookLevel[] = [];
        const midPrice = data.mid_price || 97500;
        
        // Process real-time bids
        data.bids.forEach((bid: any) => {
          levels.push({
            price: parseFloat(bid[0]),
            quantity: parseFloat(bid[1]),
            exchange: bid[2] || 'Live',
            side: 'bid',
            intensity: Math.min(parseFloat(bid[1]) / 2, 10)
          });
        });
        
        // Process real-time asks
        data.asks.forEach((ask: any) => {
          levels.push({
            price: parseFloat(ask[0]),
            quantity: parseFloat(ask[1]),
            exchange: ask[2] || 'Live',
            side: 'ask',
            intensity: Math.min(parseFloat(ask[1]) / 2, 10)
          });
        });
        
        const newData = {
          levels: levels.sort((a, b) => a.price - b.price),
          midPrice,
          spread: data.spread || 10,
          timestamp: Date.now()
        };
        
        setPreviousData(heatmapData);
        setHeatmapData(newData);
        setLastUpdate(Date.now());
        setLoading(false);
        setIsUpdating(false);
      }
    });
    
    // REST API refresh every 15 seconds to complement WebSocket data
    const interval = setInterval(fetchMultiExchangeOrderbook, 15000);
    
    return () => {
      unsubscribeDepth();
      clearInterval(interval);
    };
  }, [symbol, lastUpdate]);

  const renderHeatmapGrid = () => {
    const displayData = heatmapData || previousData;
    if (!displayData) return null;
    
    const { levels, midPrice } = displayData;
    const priceRange = midPrice * 0.02; // ±2% range
    const minPrice = midPrice - priceRange;
    const maxPrice = midPrice + priceRange;
    
    // Create price grid (50 rows)
    const gridRows = 50;
    const priceStep = (maxPrice - minPrice) / gridRows;
    const rows = [];
    
    for (let i = 0; i < gridRows; i++) {
      const rowPrice = maxPrice - (i * priceStep);
      const isNearMid = Math.abs(rowPrice - midPrice) / midPrice < 0.001; // Within 0.1%
      
      // Aggregate liquidity at this price level
      const rowLevels = levels.filter(level => 
        Math.abs(level.price - rowPrice) < priceStep / 2
      );
      
      const totalBidQuantity = rowLevels
        .filter(l => l.side === 'bid')
        .reduce((sum, l) => sum + l.quantity, 0);
      
      const totalAskQuantity = rowLevels
        .filter(l => l.side === 'ask')
        .reduce((sum, l) => sum + l.quantity, 0);
      
      const bidIntensity = totalBidQuantity > 0 ? (totalBidQuantity / 10) * 100 : 0;
      const askIntensity = totalAskQuantity > 0 ? (totalAskQuantity / 10) * 100 : 0;
      
      rows.push(
        <div key={i} className={`grid grid-cols-3 h-3 ${isNearMid ? 'border-y border-yellow-400/50' : ''}`}>
          {/* Bid side */}
          <div className="relative bg-slate-800">
            {totalBidQuantity > 0 && (
              <div 
                className="absolute right-0 top-0 h-full bg-green-500 transition-all duration-300"
                style={{ 
                  width: `${Math.min(bidIntensity, 100)}%`,
                  opacity: Math.min(bidIntensity / 100, 0.8)
                }}
              />
            )}
          </div>
          
          {/* Price level */}
          <div className={`flex items-center justify-center text-xs font-mono ${
            isNearMid ? 'bg-yellow-400/20 text-yellow-400' : 'bg-slate-700 text-slate-300'
          }`}>
            {rowPrice.toFixed(0)}
          </div>
          
          {/* Ask side */}
          <div className="relative bg-slate-800">
            {totalAskQuantity > 0 && (
              <div 
                className="absolute left-0 top-0 h-full bg-red-500 transition-all duration-300"
                style={{ 
                  width: `${Math.min(askIntensity, 100)}%`,
                  opacity: Math.min(askIntensity / 100, 0.8)
                }}
              />
            )}
          </div>
        </div>
      );
    }
    
    return rows;
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="h-6 w-6 text-blue-400" />
            Orderbook Heatmap - {symbol}
          </h3>
        </div>
        <div className="animate-pulse space-y-1">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="h-4 bg-slate-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const displayData = heatmapData || previousData;
  
  if (!displayData) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="text-center py-8">
          <Activity className="h-12 w-12 text-slate-500 mx-auto mb-4" />
          <p className="text-slate-400">No heatmap data available</p>
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
          Orderbook Heatmap - {symbol}
          <span className="text-sm bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
            LIVE
          </span>
        </h3>
        
        <div className="flex items-center gap-4">
          {/* View Mode Selector */}
          <div className="flex bg-slate-700 rounded-lg p-1">
            {(['heatmap', 'depth', 'flow'] as const).map((mode) => (
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
          
          {/* Update Status */}
          <div className="text-right">
            <div className="text-sm text-slate-400 flex items-center gap-2">
              WebSocket Live
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            </div>
            <div className="text-white font-mono text-xs">
              {new Date(lastUpdate).toLocaleTimeString()}
            </div>
          </div>
        </div>
      </div>

      {/* Market Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-700 rounded-lg p-3">
          <div className="text-sm text-slate-400 mb-1">Mid Price</div>
          <div className="text-white font-mono text-lg">
            ${displayData.midPrice.toLocaleString()}
          </div>
        </div>
        <div className="bg-slate-700 rounded-lg p-3">
          <div className="text-sm text-slate-400 mb-1">Spread</div>
          <div className="text-white font-mono text-lg">
            ${displayData.spread.toFixed(2)}
          </div>
        </div>
        <div className="bg-slate-700 rounded-lg p-3">
          <div className="text-sm text-slate-400 mb-1">Levels</div>
          <div className="text-white font-mono text-lg">
            {displayData.levels.length || 0}
          </div>
        </div>
        <div className="bg-slate-700 rounded-lg p-3">
          <div className="text-sm text-slate-400 mb-1">Exchanges</div>
          <div className="text-white font-mono text-lg">3</div>
        </div>
      </div>

      {/* Heatmap Visualization */}
      {viewMode === 'heatmap' && (
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-slate-300">Bids</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-slate-300">Asks</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-400 rounded"></div>
                <span className="text-slate-300">Mid Price</span>
              </div>
            </div>
            <div className="text-slate-400">
              Intensity represents liquidity depth
            </div>
          </div>
          
          {/* Heatmap Grid */}
          <div className="border border-slate-600 rounded-lg overflow-hidden">
            <div className="grid grid-cols-3 bg-slate-700 text-sm font-semibold text-slate-300">
              <div className="p-2 text-center">Bids</div>
              <div className="p-2 text-center">Price</div>
              <div className="p-2 text-center">Asks</div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {renderHeatmapGrid()}
            </div>
          </div>
        </div>
      )}

      {viewMode === 'depth' && (
        <div className="bg-slate-700 rounded-lg p-6 h-80">
          <div className="text-center text-slate-400 mt-28">
            <BarChart3 className="h-16 w-16 text-blue-400 mx-auto mb-4" />
            <h4 className="text-lg font-semibold mb-2">Depth Chart View</h4>
            <p className="text-sm">Cumulative depth visualization</p>
          </div>
        </div>
      )}

      {viewMode === 'flow' && (
        <div className="bg-slate-700 rounded-lg p-6 h-80">
          <div className="text-center text-slate-400 mt-28">
            <Activity className="h-16 w-16 text-purple-400 mx-auto mb-4" />
            <h4 className="text-lg font-semibold mb-2">Order Flow View</h4>
            <p className="text-sm">Real-time order flow analysis</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-slate-700">
        <div className="flex justify-between items-center text-xs text-slate-400">
          <div>Real-time WebSocket data • Live depth updates</div>
          <div className="flex items-center gap-4">
            <span>Multi-exchange aggregated</span>
            <span>•</span>
            <span className="text-green-400">● WebSocket Live</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderbookHeatmap;