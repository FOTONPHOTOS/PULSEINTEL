import React, { useState, useEffect } from 'react';
import { ArrowDown, ArrowUp, DollarSign } from 'lucide-react';
import { subscribeToTrades, TradeData } from '../services/WebSocketService';

interface LiquidationEvent {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  amount: number;
  price: number;
  notional: number;
  timestamp: number;
  exchange: string;
}

interface LiquidationFeedProps {
  symbol?: string;
  limit?: number;
  liquidationThreshold?: number;
}

const LiquidationFeed: React.FC<LiquidationFeedProps> = ({ 
  symbol, 
  limit = 15,
  liquidationThreshold = 50000,
}) => {
  const [liquidations, setLiquidations] = useState<LiquidationEvent[]>([]);

  useEffect(() => {
    if (!symbol) return;

    setLiquidations([]); // Clear previous liquidations on symbol change

    const unsubscribe = subscribeToTrades(symbol, (trade: TradeData) => {
      const notional = parseFloat(trade.price) * parseFloat(trade.quantity);

      // A simple heuristic for identifying liquidations: a large trade.
      // A more advanced implementation would look for trades during high volatility
      // or against the prevailing short-term trend.
      if (notional >= liquidationThreshold) {
        const newLiquidation: LiquidationEvent = {
          id: `${trade.timestamp}-${trade.price}-${trade.quantity}`,
          symbol: symbol,
          // A market buy triggers short liquidations, a market sell triggers long liquidations.
          side: trade.side === 'buy' ? 'short' : 'long',
          amount: parseFloat(trade.quantity),
          price: parseFloat(trade.price),
          notional: notional,
          timestamp: trade.timestamp,
          exchange: trade.exchange || 'Unknown',
        };
        
        setLiquidations(prev => [newLiquidation, ...prev.slice(0, limit - 1)]);
      }
    });
      
    return () => {
      unsubscribe();
    };
  }, [symbol, limit, liquidationThreshold]);

  const timeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };
  
  const formatNumber = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return `${num.toFixed(0)}`;
  };

  return (
    <div className="w-full overflow-hidden">
      <h3 className="font-bold text-xl mb-4 text-white">Liquidation Feed</h3>
      
      {liquidations.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-20" />
          <p>No large liquidations detected</p>
          {symbol && <p className="text-sm mt-1">Monitoring {symbol} for trades &gt; {formatNumber(liquidationThreshold)}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {liquidations.map((liquidation) => (
            <div 
              key={liquidation.id}
              className={`flex items-center justify-between p-3 rounded-lg ${
                liquidation.side === 'long' 
                  ? 'bg-red-500/10 border-l-4 border-red-500/50' 
                  : 'bg-green-500/10 border-l-4 border-green-500/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${
                  liquidation.side === 'long' 
                    ? 'bg-red-500/20 text-red-400' 
                    : 'bg-green-500/20 text-green-400'
                }`}>
                  {liquidation.side === 'long' ? <ArrowDown className="h-5 w-5" /> : <ArrowUp className="h-5 w-5" />}
                </div>
                <div>
                  <div className="font-medium text-white">
                    {liquidation.symbol} {liquidation.side.toUpperCase()} Liquidation
                  </div>
                  <div className="text-sm text-slate-400">
                    {liquidation.exchange} • {timeAgo(liquidation.timestamp)}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-semibold ${
                  liquidation.side === 'long' ? 'text-red-400' : 'text-green-400'
                }`}>
                  {formatNumber(liquidation.notional)}
                </div>
                <div className="text-sm text-slate-400">
                  at ${liquidation.price.toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiquidationFeed; 