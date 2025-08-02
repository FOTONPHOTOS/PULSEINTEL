import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, Clock } from 'lucide-react';
import { apiConfig } from '../apiConfig';
import { subscribeToTrades, subscribeToDepth } from '../services/WebSocketService';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface FundingRateSnapshot {
  timestamp: number;
  rates: { [exchange: string]: number };
}

interface FundingRateHeatmapProps {
  selectedAsset: string;
  maxHistorySeconds?: number; // How many seconds of history to keep
  pollIntervalSeconds?: number; // How often to fetch new data
}

const MAX_SNAPSHOTS = 100; // Limit the number of data points in the chart

const FundingRateHeatmap: React.FC<FundingRateHeatmapProps> = ({
  selectedAsset,
  pollIntervalSeconds = 30,
}) => {
  const [snapshots, setSnapshots] = useState<FundingRateSnapshot[]>([]);
  const [latestRates, setLatestRates] = useState<FundingRateSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFundingData = async () => {
      try {
        const response = await fetch(`${apiConfig.REST_API_SERVICE}/api/funding-rates/${selectedAsset}`);
        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }
        const data = await response.json();

        if (Array.isArray(data) && data.length > 0) {
          const newSnapshot: FundingRateSnapshot = {
            timestamp: Date.now(),
            rates: data.reduce((acc, item) => {
              acc[item.exchange] = item.rate || 0;
              return acc;
            }, {}),
          };

          setLatestRates(newSnapshot);
          setSnapshots(prev => [...prev, newSnapshot].slice(-MAX_SNAPSHOTS));
        }
        setError(null);
      } catch (err) {
        console.error('Error fetching funding rate data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchFundingData();

    // Set up polling
    const interval = setInterval(fetchFundingData, pollIntervalSeconds * 1000);

    return () => {
      clearInterval(interval);
    };
  }, [selectedAsset, pollIntervalSeconds]);

  const getFundingRateColor = (rate: number) => {
    const absRate = Math.abs(rate);
    if (absRate > 0.001) return rate > 0 ? 'bg-red-500' : 'bg-green-500';
    if (absRate > 0.0005) return rate > 0 ? 'bg-orange-500' : 'bg-blue-500';
    if (absRate > 0.0001) return rate > 0 ? 'bg-yellow-500' : 'bg-cyan-500';
    return 'bg-slate-600';
  };

  const getFundingRateIntensity = (rate: number) => {
    const absRate = Math.abs(rate);
    if (absRate > 0.001) return 'opacity-100';
    if (absRate > 0.0005) return 'opacity-80';
    if (absRate > 0.0001) return 'opacity-60';
    return 'opacity-40';
  };

  const formatRate = (rate: number) => `${(rate * 100).toFixed(4)}%`;

  const chartData = snapshots.map(snap => ({
    time: new Date(snap.timestamp).toLocaleTimeString(),
    ...snap.rates,
  }));

  const exchanges = latestRates ? Object.keys(latestRates.rates) : [];

  if (isLoading) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-xl font-semibold text-white flex items-center mb-4">
          <Activity className="h-6 w-6 text-purple-400 mr-3" />
          Funding Rate Heatmap
        </h3>
        <div className="text-center py-8">
          <Activity className="h-12 w-12 text-slate-600 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-400">Loading funding rates...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-xl font-semibold text-white flex items-center mb-4">
          <Activity className="h-6 w-6 text-red-400 mr-3" />
          Funding Rate Heatmap
        </h3>
        <div className="text-center py-8 text-red-400">
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold text-white flex items-center">
          <Activity className="h-6 w-6 text-purple-400 mr-3" />
          Funding Rate Heatmap
        </h3>
        <div className="flex items-center text-xs text-slate-400">
          <Clock className="h-3 w-3 mr-1.5" />
          <span>Updating every {pollIntervalSeconds}s</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-white font-medium mb-3">Current Rates</h4>
          <div className="grid grid-cols-2 gap-2">
            {latestRates && exchanges.map(exchange => (
              <div 
                key={exchange}
                className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div 
                    className={`w-4 h-4 rounded ${getFundingRateColor(latestRates.rates[exchange])} ${getFundingRateIntensity(latestRates.rates[exchange])}`}
                  ></div>
                  <p className="text-white font-medium capitalize">{exchange}</p>
                </div>
                <p className={`font-bold text-sm ${latestRates.rates[exchange] >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {formatRate(latestRates.rates[exchange])}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-white font-medium mb-3">Historical Trend (Avg)</h4>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9CA3AF" tick={{ fontSize: 10 }} />
              <YAxis stroke="#9CA3AF" tick={{ fontSize: 10 }} tickFormatter={(val) => `${(val * 100).toFixed(3)}%`} domain={['auto', 'auto']} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                labelFormatter={(label) => `Time: ${label}`}
                formatter={(value: number, name: string) => [formatRate(value), name]}
              />
              {exchanges.map((exchange, i) => (
                <Area 
                  key={exchange}
                  type="monotone" 
                  dataKey={exchange} 
                  stackId="1"
                  stroke={['#8884d8', '#82ca9d', '#ffc658'][i % 3]} 
                  fill={['#8884d8', '#82ca9d', '#ffc658'][i % 3]} 
                  fillOpacity={0.3}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default FundingRateHeatmap;
