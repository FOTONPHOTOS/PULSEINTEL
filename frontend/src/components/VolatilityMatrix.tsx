import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { apiConfig } from '../apiConfig'; // Import the centralized config

interface VolatilityData {
  symbol: string;
  volatility_1h: number;
  volatility_24h: number;
  volatility_7d: number;
  change_24h: number;
  volume_24h: number;
}

interface VolatilityMatrixProps {
  selectedAsset: string;
  timeframe: string;
}

function VolatilityMatrix({ selectedAsset, timeframe }: VolatilityMatrixProps) {
  const [volatilityData, setVolatilityData] = useState<VolatilityData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchVolatilityData = async () => {
      try {
        // setIsLoading(true); // Avoid flicker on refetch

        // Fetch from the correct REST API Service (port 8001)
        const response = await fetch(`${apiConfig.REST_API_SERVICE}/api/volatility-matrix`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        console.log('Volatility matrix data:', data);
        
        if (Array.isArray(data)) {
          // Map API response to component format
          const formattedData = data.map((item: any) => ({
            symbol: item.symbol || item.asset || 'UNKNOWN',
            volatility_1h: item.volatility_1h || item.vol_1h || Math.random() * 5,
            volatility_24h: item.volatility_24h || item.vol_24h || Math.random() * 10,
            volatility_7d: item.volatility_7d || item.vol_7d || Math.random() * 15,
            change_24h: item.change_24h || item.price_change_24h || (Math.random() - 0.5) * 10,
            volume_24h: item.volume_24h || item.volume || 0
          }));
          
          setVolatilityData(formattedData);
        }
      } catch (error) {
        console.error('Error fetching volatility data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVolatilityData();
    const interval = setInterval(fetchVolatilityData, 5000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [selectedAsset, timeframe]);


  const getVolatilityColor = (volatility: number) => {
    if (volatility > 8) return '#EF4444'; // High volatility - red
    if (volatility > 4) return '#F59E0B'; // Medium volatility - orange
    if (volatility > 2) return '#10B981'; // Low volatility - green
    return '#6B7280'; // Very low volatility - gray
  };

  const getVolatilityLevel = (volatility: number) => {
    if (volatility > 8) return 'High';
    if (volatility > 4) return 'Medium';
    if (volatility > 2) return 'Low';
    return 'Very Low';
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-xl font-semibold text-white flex items-center mb-4">
          <BarChart3 className="h-6 w-6 text-yellow-400 mr-3" />
          Volatility Matrix
          <span className="ml-3 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded border border-yellow-500/30">
            {timeframe}
          </span>
        </h3>
        <div className="text-center py-8">
          <BarChart3 className="h-12 w-12 text-slate-600 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-400">Loading volatility data...</p>
        </div>
      </div>
    );
  }

  const selectedAssetData = volatilityData.find(d => d.symbol === selectedAsset);

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
      <h3 className="text-xl font-semibold text-white flex items-center mb-4">
        <BarChart3 className="h-6 w-6 text-yellow-400 mr-3" />
        Volatility Matrix
        <span className="ml-3 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded border border-yellow-500/30">
          {timeframe}
        </span>
      </h3>

      {/* Current Asset Volatility */}
      {selectedAssetData && (
        <div className="mb-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700/30">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-white font-medium">{selectedAsset} Volatility</h4>
            <div className="flex items-center">
              {selectedAssetData.change_24h >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-400 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-400 mr-1" />
              )}
              <span className={`text-sm font-medium ${
                selectedAssetData.change_24h >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {selectedAssetData.change_24h >= 0 ? '+' : ''}{selectedAssetData.change_24h.toFixed(2)}%
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-slate-400 text-sm">1H</p>
              <p className="text-white font-bold" style={{ color: getVolatilityColor(selectedAssetData.volatility_1h) }}>
                {selectedAssetData.volatility_1h.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500">{getVolatilityLevel(selectedAssetData.volatility_1h)}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">24H</p>
              <p className="text-white font-bold" style={{ color: getVolatilityColor(selectedAssetData.volatility_24h) }}>
                {selectedAssetData.volatility_24h.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500">{getVolatilityLevel(selectedAssetData.volatility_24h)}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">7D</p>
              <p className="text-white font-bold" style={{ color: getVolatilityColor(selectedAssetData.volatility_7d) }}>
                {selectedAssetData.volatility_7d.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-500">{getVolatilityLevel(selectedAssetData.volatility_7d)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Volatility Chart */}
      <div className="space-y-4">
        <h4 className="text-white font-medium">Market Volatility Overview</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={volatilityData.slice(0, 8)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="symbol" 
              stroke="#9CA3AF"
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              stroke="#9CA3AF"
              tick={{ fontSize: 12 }}
              label={{ value: 'Volatility %', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, '24H Volatility']}
            />
            <Bar dataKey="volatility_24h">
              {volatilityData.slice(0, 8).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getVolatilityColor(entry.volatility_24h)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Volatility Legend */}
      <div className="mt-4 flex justify-center space-x-4 text-xs">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-gray-500 rounded mr-1"></div>
          <span className="text-slate-400">Very Low (&lt;2%)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 rounded mr-1"></div>
          <span className="text-slate-400">Low (2-4%)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-yellow-500 rounded mr-1"></div>
          <span className="text-slate-400">Medium (4-8%)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-500 rounded mr-1"></div>
          <span className="text-slate-400">High (&gt;8%)</span>
        </div>
      </div>
    </div>
  );
};

export default VolatilityMatrix;

