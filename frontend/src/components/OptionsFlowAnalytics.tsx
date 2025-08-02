import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Eye, Target, Zap } from 'lucide-react';

interface OptionsFlow {
  id: string;
  symbol: string;
  type: 'call' | 'put';
  strike: number;
  expiry: string;
  volume: number;
  openInterest: number;
  premium: number;
  notional: number;
  unusual: boolean;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  timestamp: number;
  exchange: string;
}

interface OptionsFlowAnalyticsProps {
  symbol: string;
}

const OptionsFlowAnalytics: React.FC<OptionsFlowAnalyticsProps> = ({ symbol }) => {
  const [flows, setFlows] = useState<OptionsFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unusual' | 'large'>('all');
  const [timeframe, setTimeframe] = useState<'1h' | '4h' | '1d'>('4h');

  // Mock data - replace with real API call
  useEffect(() => {
    const generateMockFlows = (): OptionsFlow[] => {
      const mockFlows: OptionsFlow[] = [];
      const basePrice = symbol === 'BTCUSDT' ? 45000 : symbol === 'ETHUSDT' ? 2800 : 150;
      
      for (let i = 0; i < 20; i++) {
        const isCall = Math.random() > 0.5;
        const strikeOffset = (Math.random() - 0.5) * 0.2 * basePrice;
        const volume = Math.floor(Math.random() * 1000) + 50;
        const premium = Math.random() * 500 + 10;
        
        mockFlows.push({
          id: `flow_${i}`,
          symbol,
          type: isCall ? 'call' : 'put',
          strike: Math.round(basePrice + strikeOffset),
          expiry: ['2024-01-26', '2024-02-02', '2024-02-16', '2024-03-01'][Math.floor(Math.random() * 4)],
          volume,
          openInterest: Math.floor(volume * (Math.random() * 3 + 1)),
          premium,
          notional: volume * premium,
          unusual: Math.random() > 0.7,
          sentiment: volume > 500 ? (isCall ? 'bullish' : 'bearish') : 'neutral',
          timestamp: Date.now() - Math.random() * 3600000,
          exchange: ['Deribit', 'OKX', 'Bybit'][Math.floor(Math.random() * 3)]
        });
      }
      
      return mockFlows.sort((a, b) => b.notional - a.notional);
    };

    setLoading(true);
    setTimeout(() => {
      setFlows(generateMockFlows());
      setLoading(false);
    }, 1000);
  }, [symbol, timeframe]);

  const filteredFlows = flows.filter(flow => {
    if (filter === 'unusual') return flow.unusual;
    if (filter === 'large') return flow.notional > 50000;
    return true;
  });

  const bullishVolume = flows.reduce((sum, flow) => 
    flow.type === 'call' ? sum + flow.volume : sum, 0
  );
  
  const bearishVolume = flows.reduce((sum, flow) => 
    flow.type === 'put' ? sum + flow.volume : sum, 0
  );

  const totalNotional = flows.reduce((sum, flow) => sum + flow.notional, 0);
  const unusualFlows = flows.filter(flow => flow.unusual).length;

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
    return `$${num.toFixed(0)}`;
  };

  const formatTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  };

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Target className="w-5 h-5 mr-2 text-blue-400" />
            Options Flow Analytics
          </h3>
        </div>
        <div className="animate-pulse space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-800 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Target className="w-5 h-5 mr-2 text-blue-400" />
          Options Flow Analytics
        </h3>
        
        <div className="flex items-center space-x-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="bg-gray-800 text-white text-sm px-3 py-1 rounded border border-gray-600"
          >
            <option value="all">All Flows</option>
            <option value="unusual">Unusual Only</option>
            <option value="large">Large Volume</option>
          </select>
          
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            className="bg-gray-800 text-white text-sm px-3 py-1 rounded border border-gray-600"
          >
            <option value="1h">1H</option>
            <option value="4h">4H</option>
            <option value="1d">1D</option>
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Notional</p>
              <p className="text-white text-lg font-semibold">{formatNumber(totalNotional)}</p>
            </div>
            <Zap className="w-5 h-5 text-yellow-400" />
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Call/Put Ratio</p>
              <p className="text-white text-lg font-semibold">
                {(bullishVolume / Math.max(bearishVolume, 1)).toFixed(2)}
              </p>
            </div>
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Unusual Flows</p>
              <p className="text-white text-lg font-semibold">{unusualFlows}</p>
            </div>
            <AlertTriangle className="w-5 h-5 text-orange-400" />
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Active Contracts</p>
              <p className="text-white text-lg font-semibold">{filteredFlows.length}</p>
            </div>
            <Eye className="w-5 h-5 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Flow Table */}
      <div className="overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-gray-800 sticky top-0">
              <tr>
                <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Contract</th>
                <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Volume</th>
                <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Premium</th>
                <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Notional</th>
                <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Sentiment</th>
                <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredFlows.slice(0, 15).map((flow, index) => (
                <tr 
                  key={flow.id} 
                  className={`border-b border-gray-700 hover:bg-gray-800 transition-colors ${
                    flow.unusual ? 'bg-yellow-900/20' : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${
                        flow.type === 'call' ? 'bg-green-400' : 'bg-red-400'
                      }`}></div>
                      <div>
                        <p className="text-white text-sm font-medium">
                          {flow.type.toUpperCase()} ${flow.strike}
                        </p>
                        <p className="text-gray-400 text-xs">{flow.expiry} • {flow.exchange}</p>
                      </div>
                      {flow.unusual && (
                        <AlertTriangle className="w-3 h-3 text-yellow-400" />
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-white text-sm">{flow.volume.toLocaleString()}</td>
                  <td className="py-3 px-4 text-white text-sm">${flow.premium.toFixed(0)}</td>
                  <td className="py-3 px-4 text-white text-sm font-medium">
                    {formatNumber(flow.notional)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      flow.sentiment === 'bullish' 
                        ? 'bg-green-900/50 text-green-300'
                        : flow.sentiment === 'bearish'
                        ? 'bg-red-900/50 text-red-300'
                        : 'bg-gray-800 text-gray-300'
                    }`}>
                      {flow.sentiment}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-400 text-sm">{formatTime(flow.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredFlows.length === 0 && (
        <div className="text-center py-8">
          <Target className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-400">No options flows found matching current filters</p>
        </div>
      )}
    </div>
  );
};

export default OptionsFlowAnalytics;