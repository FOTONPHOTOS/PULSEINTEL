import React, { useState, useEffect } from 'react';
import { webSocketService, subscribeToTrades, subscribeToDepth, subscribeToVWAP, subscribeToCVD, WebSocketData } from '../services/WebSocketService';
import { TrendingUp, TrendingDown, Activity, BarChart3, Zap } from 'lucide-react';

interface RealTimeDashboardProps {
  selectedAsset: string;
}

const RealTimeDashboard: React.FC<RealTimeDashboardProps> = ({ selectedAsset }) => {
  const [tradeData, setTradeData] = useState<WebSocketData | null>(null);
  const [depthData, setDepthData] = useState<WebSocketData | null>(null);
  const [vwapData, setVwapData] = useState<WebSocketData | null>(null);
  const [cvdData, setCvdData] = useState<WebSocketData | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  // Recent trades for activity feed
  const [recentTrades, setRecentTrades] = useState<WebSocketData[]>([]);

  useEffect(() => {
    console.log(`📊 RealTimeDashboard: Setting up for ${selectedAsset}`);
    
    // Update connection status
    const statusInterval = setInterval(() => {
      setConnectionStatus(webSocketService.getConnectionStatus());
    }, 1000);

    // Subscribe to trades
    const unsubscribeTrades = subscribeToTrades(selectedAsset, (data) => {
      setTradeData(data);
      setMessageCount(prev => prev + 1);
      
      // Add to recent trades (keep last 10)
      setRecentTrades(prev => {
        const newTrades = [data, ...prev].slice(0, 10);
        return newTrades;
      });
    });

    // Subscribe to depth
    const unsubscribeDepth = subscribeToDepth(selectedAsset, (data) => {
      setDepthData(data);
      setMessageCount(prev => prev + 1);
    });

    // Subscribe to VWAP
    const unsubscribeVWAP = subscribeToVWAP(selectedAsset, (data) => {
      setVwapData(data);
      setMessageCount(prev => prev + 1);
    });

    // Subscribe to CVD
    const unsubscribeCVD = subscribeToCVD(selectedAsset, (data) => {
      setCvdData(data);
      setMessageCount(prev => prev + 1);
    });

    return () => {
      clearInterval(statusInterval);
      unsubscribeTrades();
      unsubscribeDepth();
      unsubscribeVWAP();
      unsubscribeCVD();
    };
  }, [selectedAsset]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    }).format(price);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleTimeString();
  };

  return (
    <div className="space-y-6">
      {/* Header with Connection Status */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Real-Time Dashboard - {selectedAsset}</h2>
          <div className="flex items-center space-x-4">
            <span className={`px-3 py-1 rounded text-sm font-medium ${
              connectionStatus === 'connected' ? 'bg-green-600 text-white' :
              connectionStatus === 'connecting' ? 'bg-yellow-600 text-white' :
              'bg-red-600 text-white'
            }`}>
              {connectionStatus === 'connected' ? '🟢 Live' :
               connectionStatus === 'connecting' ? '🟡 Connecting...' :
               '🔴 Disconnected'}
            </span>
            <span className="text-white font-bold">
              Messages: {messageCount}
            </span>
          </div>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Latest Trade */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Latest Trade</h3>
            <TrendingUp className="h-6 w-6 text-green-400" />
          </div>
          {tradeData ? (
            <div className="space-y-2">
              <div className="text-2xl font-bold text-green-400">
                {formatPrice(parseFloat(tradeData.price))}
              </div>
              <div className="text-sm text-gray-300">
                Qty: {parseFloat(tradeData.quantity).toFixed(4)}
              </div>
              <div className="text-xs text-gray-400">
                {tradeData.exchange} • {formatTime(tradeData.timestamp)}
              </div>
            </div>
          ) : (
            <div className="text-gray-400">Waiting for trade data...</div>
          )}
        </div>

        {/* VWAP */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">VWAP</h3>
            <BarChart3 className="h-6 w-6 text-purple-400" />
          </div>
          {vwapData ? (
            <div className="space-y-2">
              <div className="text-2xl font-bold text-purple-400">
                {formatPrice(vwapData.vwap)}
              </div>
              <div className="text-xs text-gray-400">
                Volume Weighted Average Price
              </div>
              <div className="text-xs text-gray-400">
                {formatTime(vwapData.timestamp)}
              </div>
            </div>
          ) : (
            <div className="text-gray-400">Waiting for VWAP data...</div>
          )}
        </div>

        {/* Best Bid/Ask */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Best Bid/Ask</h3>
            <Activity className="h-6 w-6 text-blue-400" />
          </div>
          {depthData ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-green-400">Bid:</span>
                <span className="text-green-400 font-bold">
                  {depthData.bids?.[0]?.[0] ? formatPrice(parseFloat(depthData.bids[0][0])) : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-400">Ask:</span>
                <span className="text-red-400 font-bold">
                  {depthData.asks?.[0]?.[0] ? formatPrice(parseFloat(depthData.asks[0][0])) : 'N/A'}
                </span>
              </div>
              <div className="text-xs text-gray-400">
                {depthData.exchange} • {formatTime(depthData.timestamp)}
              </div>
            </div>
          ) : (
            <div className="text-gray-400">Waiting for orderbook data...</div>
          )}
        </div>

        {/* CVD */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">CVD</h3>
            <Zap className="h-6 w-6 text-yellow-400" />
          </div>
          {cvdData ? (
            <div className="space-y-2">
              <div className={`text-2xl font-bold ${cvdData.cvd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {cvdData.cvd >= 0 ? '+' : ''}{cvdData.cvd.toFixed(2)}
              </div>
              <div className="text-xs text-gray-400">
                Cumulative Volume Delta
              </div>
              <div className="text-xs text-gray-400">
                {formatTime(cvdData.timestamp)}
              </div>
            </div>
          ) : (
            <div className="text-gray-400">Waiting for CVD data...</div>
          )}
        </div>
      </div>

      {/* Recent Trades Activity Feed */}
      <div className="bg-gray-800 p-6 rounded-lg">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Trades</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {recentTrades.length > 0 ? (
            recentTrades.map((trade, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-b-0">
                <div className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${trade.side === 'buy' ? 'bg-green-400' : 'bg-red-400'}`}></div>
                  <span className="text-white font-medium">
                    {formatPrice(parseFloat(trade.price))}
                  </span>
                  <span className="text-gray-400 text-sm">
                    {parseFloat(trade.quantity).toFixed(4)}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  {formatTime(trade.timestamp)}
                </div>
              </div>
            ))
          ) : (
            <div className="text-gray-400">Waiting for trade data...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealTimeDashboard;