import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiConfig } from '../apiConfig';
import { subscribeToTrades, subscribeToDepth } from '../services/WebSocketService';

// ... (interfaces remain the same)

interface OrderFlowData {
  timestamp: number;
  buyVolume: number;
  sellVolume: number;
  netFlow: number;
}

interface OrderFlowStats {
  totalBuyVolume: number;
  totalSellVolume: number;
  netFlow: number;
  buyPercentage: number;
  sellPercentage: number;
  imbalance: number;
}

interface OrderFlowAnalyticsProps {
  selectedAsset: string;
}

const OrderFlowAnalytics: React.FC<OrderFlowAnalyticsProps> = ({ selectedAsset }) => {
  const [orderFlowData, setOrderFlowData] = useState<OrderFlowData[]>([]);
  const [stats, setStats] = useState<OrderFlowStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log(`🔌 OrderFlowAnalytics: Subscribing to ${selectedAsset} data`);
    
    let buyVolume = 0;
    let sellVolume = 0;
    
    // Subscribe to trades for order flow analysis
    const unsubscribeTrades = subscribeToTrades(selectedAsset, (data) => {
      console.log('📊 Trade data for order flow:', data);
      
      const timestamp = Date.now();
      const volume = parseFloat(data.quantity) || 0;
      const isBuy = data.side === 'buy' || data.price > data.lastPrice;
      
      if (isBuy) {
        buyVolume += volume;
      } else {
        sellVolume += volume;
      }
      
      // Add new data point
      const newDataPoint: OrderFlowData = {
        timestamp,
        buyVolume: isBuy ? volume : 0,
        sellVolume: isBuy ? 0 : volume,
        netFlow: isBuy ? volume : -volume
      };
      
      setOrderFlowData(prev => [...prev.slice(-19), newDataPoint]);
      
      // Update stats
      const total = buyVolume + sellVolume;
      if (total > 0) {
        setStats({
          totalBuyVolume: buyVolume,
          totalSellVolume: sellVolume,
          netFlow: buyVolume - sellVolume,
          buyPercentage: (buyVolume / total) * 100,
          sellPercentage: (sellVolume / total) * 100,
          imbalance: ((buyVolume - sellVolume) / total) * 100
        });
      }
      
      setIsLoading(false);
    });

    return () => {
      unsubscribeTrades();
    };
  }, [selectedAsset]);




  if (isLoading) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-white flex items-center">
              <Activity className="h-6 w-6 text-green-400 mr-3" />
              Order Flow Analytics
              <span className="ml-3 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/30">
                LIVE
              </span>
            </h3>
            <p className="text-slate-400 text-sm mt-1">Real-time order flow analysis for {selectedAsset}</p>
          </div>
        </div>
        <div className="text-center py-8">
          <Activity className="h-12 w-12 text-slate-600 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-400">Loading order flow data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white flex items-center">
            <Activity className="h-6 w-6 text-green-400 mr-3" />
            Order Flow Analytics
            <span className="ml-3 text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded border border-green-500/30">
              LIVE
            </span>
          </h3>
          <p className="text-slate-400 text-sm mt-1">Real-time order flow analysis for {selectedAsset}</p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-400 text-sm font-medium">Buy Pressure</p>
                <p className="text-white text-lg font-bold">{stats.buyPercentage.toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-5 w-5 text-green-400" />
            </div>
          </div>
          
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-400 text-sm font-medium">Sell Pressure</p>
                <p className="text-white text-lg font-bold">{stats.sellPercentage.toFixed(1)}%</p>
              </div>
              <TrendingDown className="h-5 w-5 text-red-400" />
            </div>
          </div>
          
          <div className={`border rounded-lg p-3 ${
            stats.imbalance > 0 
              ? 'bg-green-500/10 border-green-500/20' 
              : 'bg-red-500/10 border-red-500/20'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${stats.imbalance > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  Net Imbalance
                </p>
                <p className="text-white text-lg font-bold">
                  {stats.imbalance > 0 ? '+' : ''}{stats.imbalance.toFixed(1)}%
                </p>
              </div>
              <Activity className={`h-5 w-5 ${stats.imbalance > 0 ? 'text-green-400' : 'text-red-400'}`} />
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h4 className="text-white font-medium">Buy vs Sell Volume</h4>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={orderFlowData.slice(-20)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="timestamp" 
              stroke="#9CA3AF"
              tickFormatter={(value) => new Date(value).toLocaleTimeString()}
            />
            <YAxis stroke="#9CA3AF" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
              labelFormatter={(value) => new Date(value).toLocaleTimeString()}
              formatter={(value: number, name: string) => [
                `${(value / 1000000).toFixed(2)}M`, 
                name === 'buyVolume' ? 'Buy Volume' : 'Sell Volume'
              ]}
            />
            <Area 
              type="monotone" 
              dataKey="buyVolume" 
              stackId="1"
              stroke="#22C55E" 
              fill="#22C55E" 
              fillOpacity={0.3}
            />
            <Area 
              type="monotone" 
              dataKey="sellVolume" 
              stackId="1"
              stroke="#EF4444" 
              fill="#EF4444" 
              fillOpacity={0.3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default OrderFlowAnalytics; 