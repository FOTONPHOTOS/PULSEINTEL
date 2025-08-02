import React, { useState, useEffect, useMemo } from 'react';
import { Fish, TrendingUp, TrendingDown, DollarSign, Clock, Waves } from 'lucide-react';
import { subscribeToTrades, TradeData } from '../services/WebSocketService';

interface WhaleTransaction {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  notional: number;
  exchange: string;
  timestamp: number;
  sizeCategory: 'whale' | 'mega_whale' | 'institutional';
}

interface WhaleSummary {
  totalWhaleVolume: number;
  netFlow: number;
  whaleCount: number;
  avgTradeSize: number;
  bullishSentiment: number;
}

interface WhaleTrackerProps {
  symbol: string;
  whaleThreshold?: number;
  megaWhaleThreshold?: number;
  institutionalThreshold?: number;
  maxTransactions?: number;
}

const WhaleTracker: React.FC<WhaleTrackerProps> = ({ 
  symbol,
  whaleThreshold = 100000,
  megaWhaleThreshold = 1000000,
  institutionalThreshold = 5000000,
  maxTransactions = 50,
}) => {
  const [transactions, setTransactions] = useState<WhaleTransaction[]>([]);
  const [summary, setSummary] = useState<WhaleSummary | null>(null);
  const [filter, setFilter] = useState<'all' | 'whale' | 'mega_whale' | 'institutional'>('all');

  useEffect(() => {
    setTransactions([]); // Clear transactions when symbol changes

    const unsubscribe = subscribeToTrades(symbol, (trade: TradeData) => {
      const notional = parseFloat(trade.price) * parseFloat(trade.quantity);

      if (notional >= whaleThreshold) {
        let sizeCategory: WhaleTransaction['sizeCategory'] = 'whale';
        if (notional >= institutionalThreshold) {
          sizeCategory = 'institutional';
        } else if (notional >= megaWhaleThreshold) {
          sizeCategory = 'mega_whale';
        }

        const newTransaction: WhaleTransaction = {
          id: `${trade.timestamp}-${trade.price}-${trade.quantity}`,
          symbol: symbol,
          side: trade.side === 'buy' ? 'buy' : 'sell',
          amount: parseFloat(trade.quantity),
          price: parseFloat(trade.price),
          notional: notional,
          exchange: trade.exchange || 'Unknown',
          timestamp: trade.timestamp,
          sizeCategory: sizeCategory,
        };

        setTransactions(prev => [newTransaction, ...prev.slice(0, maxTransactions - 1)]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [symbol, whaleThreshold, megaWhaleThreshold, institutionalThreshold, maxTransactions]);

  useEffect(() => {
    if (transactions.length === 0) {
      setSummary(null);
      return;
    }

    const totalVolume = transactions.reduce((sum, tx) => sum + tx.notional, 0);
    const buyVolume = transactions.filter(tx => tx.side === 'buy').reduce((sum, tx) => sum + tx.notional, 0);
    const sellVolume = totalVolume - buyVolume;
    
    setSummary({
      totalWhaleVolume: totalVolume,
      netFlow: buyVolume - sellVolume,
      whaleCount: transactions.length,
      avgTradeSize: totalVolume / transactions.length,
      bullishSentiment: totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 50,
    });
  }, [transactions]);

  const filteredTransactions = useMemo(() => transactions.filter(tx => {
    if (filter === 'all') return true;
    return tx.sizeCategory === filter;
  }), [transactions, filter]);

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
    return `${num.toFixed(0)}`;
  };

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getSizeIcon = (category: string) => {
    switch (category) {
      case 'institutional': return '🏛️';
      case 'mega_whale': return '🐋';
      case 'whale': return '🐟';
      default: return '🐟';
    }
  };

  const getSizeBadgeColor = (category: string) => {
    switch (category) {
      case 'institutional': return 'bg-purple-900/50 text-purple-300';
      case 'mega_whale': return 'bg-orange-900/50 text-orange-300';
      case 'whale': return 'bg-blue-900/50 text-blue-300';
      default: return 'bg-slate-800 text-slate-300';
    }
  };

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Waves className="w-5 h-5 mr-2 text-blue-400" />
          Whale Tracker
          <span className="ml-3 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/30">
            LIVE
          </span>
        </h3>
        
        <div className="flex items-center space-x-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="bg-slate-800 text-white text-sm px-3 py-1 rounded border border-slate-600"
          >
            <option value="all">All Whales</option>
            <option value="whale">Whales (&gt;{formatNumber(whaleThreshold)})</option>
            <option value="mega_whale">Mega (&gt;{formatNumber(megaWhaleThreshold)})</option>
            <option value="institutional">Institutional (&gt;{formatNumber(institutionalThreshold)})</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {/* Total Volume, Net Flow, Whale Count, Avg Trade, Sentiment */}
        </div>
      )}

      {/* Transaction Table */}
      <div className="overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-slate-800 sticky top-0">
              <tr>
                <th className="text-left py-3 px-4 text-slate-300 text-sm font-medium">Whale</th>
                <th className="text-left py-3 px-4 text-slate-300 text-sm font-medium">Side</th>
                <th className="text-left py-3 px-4 text-slate-300 text-sm font-medium">Notional</th>
                <th className="text-left py-3 px-4 text-slate-300 text-sm font-medium">Price</th>
                <th className="text-left py-3 px-4 text-slate-300 text-sm font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.slice(0, 20).map((tx) => (
                <tr key={tx.id} className="border-b border-slate-700 hover:bg-slate-800 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getSizeIcon(tx.sizeCategory)}</span>
                      <div>
                        <p className="text-white text-sm font-medium">{tx.exchange}</p>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSizeBadgeColor(tx.sizeCategory)}`}>
                          {tx.sizeCategory.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      tx.side === 'buy' 
                        ? 'bg-green-900/50 text-green-300'
                        : 'bg-red-900/50 text-red-300'
                    }`}>
                      {tx.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-white text-sm font-medium">
                    {formatNumber(tx.notional)}
                  </td>
                  <td className="py-3 px-4 text-white text-sm">${tx.price.toLocaleString()}</td>
                  <td className="py-3 px-4 text-slate-400 text-sm flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatTime(tx.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {transactions.length === 0 && (
        <div className="text-center py-8">
          <Fish className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400">Listening for large trades on {symbol}...</p>
        </div>
      )}
    </div>
  );
};

export default WhaleTracker;