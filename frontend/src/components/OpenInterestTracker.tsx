import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { apiConfig } from '../apiConfig';

interface OpenInterestData {
  exchange: string;
  openInterest: number;
  timestamp: number;
}

interface OpenInterestStats {
  totalOpenInterest: number;
  change24h: number; // Note: This is not provided by the API and will be 0
  trend: 'up' | 'down' | 'neutral';
}

interface OpenInterestTrackerProps {
  selectedAsset: string;
}

const OpenInterestTracker: React.FC<OpenInterestTrackerProps> = ({ selectedAsset }) => {
  const [openInterestData, setOpenInterestData] = useState<OpenInterestData[]>([]);
  const [stats, setStats] = useState<OpenInterestStats | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOpenInterestData = async () => {
      // Don't set loading to true on refetch to avoid UI flicker
      setError(null);
      try {
        const response = await fetch(`${apiConfig.REST_API_SERVICE}/api/open-interest/${selectedAsset}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data && data.open_interest && Array.isArray(data.open_interest)) {
          const formattedData = data.open_interest.map((item: any) => ({
            exchange: item.exchange || 'Unknown',
            openInterest: parseFloat(item.openInterest) || 0,
            timestamp: item.timestamp || Date.now()
          }));
          
          setOpenInterestData(formattedData);
          
          const totalOI = formattedData.reduce((sum, item) => sum + item.openInterest, 0);
          
          // The API does not provide 24h change, so we cannot calculate a real trend.
          setStats({
            totalOpenInterest: totalOI,
            change24h: 0,
            trend: 'neutral'
          });
          
          // The API does not provide historical data, so this will be empty.
          setHistoricalData([]);
        } else {
          throw new Error("Invalid data structure from API");
        }
        
      } catch (err) {
        console.error('Error fetching open interest data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchOpenInterestData();
    
    const interval = setInterval(fetchOpenInterestData, 5000); // Update every 60 seconds
    
    return () => {
      clearInterval(interval);
    };
  }, [selectedAsset]);


  const formatNumber = (num: number) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return `${num.toFixed(0)}`;
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-xl font-semibold text-white flex items-center mb-4">
          <Target className="h-6 w-6 text-orange-400 mr-3" />
          Open Interest Tracker
        </h3>
        <div className="text-center py-8">
          <Target className="h-12 w-12 text-slate-600 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-400">Loading open interest data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
       <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-xl font-semibold text-white flex items-center mb-4">
          <Target className="h-6 w-6 text-red-400 mr-3" />
          Open Interest Tracker
        </h3>
        <div className="text-center py-8 text-red-400">
          <p>Error: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
      <h3 className="text-xl font-semibold text-white flex items-center mb-4">
        <Target className="h-6 w-6 text-orange-400 mr-3" />
        Open Interest Tracker
      </h3>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-400 text-sm font-medium">Total OI</p>
                <p className="text-white text-lg font-bold">{formatNumber(stats.totalOpenInterest)}</p>
              </div>
              <Target className="h-5 w-5 text-orange-400" />
            </div>
          </div>
          
          <div className="bg-gray-500/10 border-gray-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">24H Change</p>
                <p className="text-white text-lg font-bold">N/A</p>
              </div>
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>
          </div>
        </div>
      )}

      {/* Historical OI Chart */}
      <div className="space-y-4">
        <h4 className="text-white font-medium">24H Open Interest Trend</h4>
        <div className="h-[150px] flex items-center justify-center bg-slate-800/30 rounded-lg">
            <p className="text-slate-500 text-sm">Historical OI data not available</p>
        </div>
      </div>

      {/* Exchange Breakdown */}
      <div className="mt-6">
        <h4 className="text-white font-medium mb-3">Exchange Breakdown</h4>
        <div className="space-y-2">
          {openInterestData.length > 0 ? openInterestData.slice(0, 5).map((item) => (
            <div 
              key={item.exchange}
              className="flex items-center justify-between p-2 bg-slate-800/30 rounded"
            >
              <span className="text-slate-300 capitalize">{item.exchange}</span>
              <div className="text-right">
                <span className="text-white font-medium">{formatNumber(item.openInterest)}</span>
                {stats && stats.totalOpenInterest > 0 && (
                  <span className="text-slate-400 text-sm ml-2">
                    ({((item.openInterest / stats.totalOpenInterest) * 100).toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>
          )) : <p className="text-slate-500 text-sm text-center py-4">No data to display.</p>}
        </div>
      </div>
    </div>
  );
};

export default OpenInterestTracker;
