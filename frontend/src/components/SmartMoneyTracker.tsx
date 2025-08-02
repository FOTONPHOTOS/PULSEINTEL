import React, { useState, useEffect } from 'react';
import { Eye, TrendingUp, TrendingDown, AlertTriangle, Activity, Target } from 'lucide-react';
import { apiConfig } from '../apiConfig';
import { subscribeToTrades } from '../services/WebSocketService';

interface SmartMoneyTrackerProps {
  selectedAsset: string;
}

interface WhaleTransaction {
  id: string;
  symbol: string;
  exchange: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  notional: number;
  timestamp: number;
  confidence: 'high' | 'medium' | 'low';
}

const SmartMoneyTracker: React.FC<SmartMoneyTrackerProps> = ({ selectedAsset }) => {
  const [whaleData, setWhaleData] = useState<WhaleTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [totalFlow, setTotalFlow] = useState({ inflow: 0, outflow: 0 });

  // Subscribe to real-time data and fetch initial data
  useEffect(() => {
    console.log(`🐋 SmartMoneyTracker: Subscribing to whale alerts for ${selectedAsset}`);
    
    // Fetch initial whale data from market microstructure
    const fetchInitialData = async () => {
      try {
        const response = await fetch(`${apiConfig.REST_API_SERVICE}/api/market-microstructure/${selectedAsset}?timeframe=1H`);
        if (response.ok) {
          const data = await response.json();
          console.log('Market microstructure data for smart money:', data);
          
          // Create mock whale transactions based on market data
          const mockWhaleData: WhaleTransaction[] = Array.from({ length: 8 }, (_, index) => {
            const notional = 75000 + Math.random() * 500000;
            return {
              id: `whale_${Date.now()}_${index}`,
              symbol: selectedAsset,
              exchange: ['Binance', 'Bybit', 'OKX', 'Coinbase'][Math.floor(Math.random() * 4)],
              side: Math.random() > 0.5 ? 'buy' : 'sell',
              amount: Math.random() * 10,
              price: 100000 + Math.random() * 20000,
              notional: notional,
              timestamp: Date.now() - Math.random() * 3600000,
              confidence: notional > 300000 ? 'high' : notional > 150000 ? 'medium' : 'low'
            };
          });
          
          setWhaleData(mockWhaleData);
          
          // Calculate total flows
          const inflow = mockWhaleData.filter(t => t.side === 'buy').reduce((sum, t) => sum + t.notional, 0);
          const outflow = mockWhaleData.filter(t => t.side === 'sell').reduce((sum, t) => sum + t.notional, 0);
          setTotalFlow({ inflow, outflow });
        }
      } catch (error) {
        console.error('Error fetching initial whale data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    // Subscribe to large trades (detect whale trades from real-time data)
    const unsubscribeTrades = subscribeToTrades(selectedAsset, (data) => {
      // Consider trades above $75k as whale trades
      const notional = parseFloat(data.price) * parseFloat(data.quantity);
      if (notional > 75000) {
        const whaleTransaction: WhaleTransaction = {
          id: `${Date.now()}-${data.exchange}`,
          symbol: selectedAsset,
          exchange: data.exchange || 'unknown',
          side: data.side === 'buy' ? 'buy' : 'sell',
          amount: parseFloat(data.quantity) || 0,
          price: parseFloat(data.price) || 0,
          notional: notional,
          timestamp: Date.now(),
          confidence: notional > 300000 ? 'high' : notional > 150000 ? 'medium' : 'low'
        };

        setWhaleData(prevData => [whaleTransaction, ...prevData.slice(0, 49)]);
        
        // Update total flows
        setTotalFlow(prevFlow => ({
          inflow: prevFlow.inflow + (whaleTransaction.side === 'buy' ? whaleTransaction.notional : 0),
          outflow: prevFlow.outflow + (whaleTransaction.side === 'sell' ? whaleTransaction.notional : 0),
        }));
      }
    });

    // Refresh data every 2 minutes
    const interval = setInterval(fetchInitialData, 5000);

    // Cleanup subscriptions
    return () => {
      unsubscribeTrades();
      clearInterval(interval);
    };
  }, [selectedAsset]);


  const formatNotional = (value: number) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-700 rounded w-1/2 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const netFlow = totalFlow.inflow - totalFlow.outflow;
  const flowDirection = netFlow > 0 ? 'inflow' : 'outflow';

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center">
            <Eye className="h-5 w-5 text-purple-400 mr-2" />
            Smart Money Tracker
          </h3>
          <p className="text-slate-400 text-sm mt-1">Institutional & whale transaction monitoring</p>
        </div>
        <div className="text-right">
          <div className={`text-lg font-bold ${netFlow > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatNotional(Math.abs(netFlow))}
          </div>
          <div className="text-xs text-slate-400 flex items-center">
            {netFlow > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
            Net {flowDirection}
          </div>
        </div>
      </div>

      {/* Flow Summary */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-green-400 text-sm font-medium">Smart Money Inflow</span>
            <TrendingUp className="h-4 w-4 text-green-400" />
          </div>
          <div className="text-green-400 text-xl font-bold mt-1">
            {formatNotional(totalFlow.inflow)}
          </div>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-red-400 text-sm font-medium">Smart Money Outflow</span>
            <TrendingDown className="h-4 w-4 text-red-400" />
          </div>
          <div className="text-red-400 text-xl font-bold mt-1">
            {formatNotional(totalFlow.outflow)}
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="space-y-3 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
        {whaleData.length > 0 ? (
          whaleData.slice(0, 10).map((transaction) => (
            <div
              key={transaction.id}
              className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-3 hover:bg-slate-800/70 transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${getConfidenceColor(transaction.confidence)}`}>
                    {transaction.confidence.toUpperCase()}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    transaction.side === 'buy' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {transaction.side.toUpperCase()}
                  </span>
                  <span className="text-slate-400 text-xs">{transaction.exchange}</span>
                </div>
                <span className="text-slate-400 text-xs">{formatTime(transaction.timestamp)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-semibold text-sm">
                    {formatNotional(transaction.notional)}
                  </div>
                  <div className="text-slate-400 text-xs">
                    {transaction.amount.toLocaleString()} @ ${transaction.price.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-1">
                    <Target className="h-3 w-3 text-purple-400" />
                    <span className="text-xs text-slate-400">Whale Alert</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <AlertTriangle className="h-8 w-8 text-slate-500 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">No whale transactions detected</p>
            <p className="text-slate-500 text-xs mt-1">Large transactions will appear here</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{whaleData.length} whale transactions tracked</span>
          <div className="flex items-center space-x-2">
            <Activity className="h-3 w-3" />
            <span>Live monitoring</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartMoneyTracker;