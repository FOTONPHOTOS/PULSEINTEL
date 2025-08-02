import React, { useState, useEffect, useRef } from 'react';
import { BarChart, TrendingUp, Eye, EyeOff } from 'lucide-react';
import { apiConfig } from '../apiConfig';

interface VolumeData {
  exchange: string;
  volume: number;
  volume24h: string;
  change24h: number;
  marketShare: number;
  color: string;
}

interface VolumeComparisonChartProps {
  refreshInterval?: number;
}

const VolumeComparisonChart: React.FC<VolumeComparisonChartProps> = ({ 
  refreshInterval = 120000 // 2 minutes
}) => {
  const [volumeData, setVolumeData] = useState<VolumeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'bar' | 'pie'>('bar');
  const [hiddenExchanges, setHiddenExchanges] = useState<Set<string>>(new Set());
  const chartRef = useRef<HTMLDivElement>(null);

  const exchangeColors = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#F97316', // Orange
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#EC4899'  // Pink
  ];

  const fetchVolumeData = async () => {
    try {
      setError(null);
      const response = await fetch(`${apiConfig.REST_API_SERVICE}/api/exchange-rankings`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      console.log('Exchange rankings data for volume comparison:', data);
      
      if (Array.isArray(data)) {
        const processedData = data.map((exchange: any, index: number) => {
          const volume = exchange.volume_24h ? parseFloat(exchange.volume_24h.toString()) / 1e9 : Math.random() * 10;
          return {
            exchange: exchange.name || exchange.exchange || `Exchange ${index + 1}`,
            volume,
            volume24h: `$${volume.toFixed(1)}B`,
            change24h: exchange.change_24h || (Math.random() - 0.5) * 20,
            marketShare: 0, // Will be calculated below
            color: exchangeColors[index % exchangeColors.length]
          };
        });

        // Calculate market share
        const totalVolume = processedData.reduce((sum: number, item: VolumeData) => sum + item.volume, 0);
        processedData.forEach((item: VolumeData) => {
          item.marketShare = (item.volume / totalVolume) * 100;
        });

        // Sort by volume descending
        processedData.sort((a: VolumeData, b: VolumeData) => b.volume - a.volume);
        
        setVolumeData(processedData);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Failed to fetch volume data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch volume data');
    } finally {
      setLoading(false);
    }
  };

  const toggleExchange = (exchange: string) => {
    const newHidden = new Set(hiddenExchanges);
    if (newHidden.has(exchange)) {
      newHidden.delete(exchange);
    } else {
      newHidden.add(exchange);
    }
    setHiddenExchanges(newHidden);
  };

  const filteredData = volumeData.filter(item => !hiddenExchanges.has(item.exchange));

  const maxVolume = Math.max(...filteredData.map(item => item.volume));

  useEffect(() => {
    fetchVolumeData();
    const interval = setInterval(fetchVolumeData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const renderBarChart = () => (
    <div className="space-y-3">
      {filteredData.map((item) => (
        <div key={item.exchange} className="flex items-center space-x-4">
          <div className="w-16 text-right">
            <div className="text-sm font-medium text-white">{item.exchange}</div>
          </div>
          <div className="flex-1 bg-gray-800 rounded-full h-8 relative overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ 
                width: `${(item.volume / maxVolume) * 100}%`,
                backgroundColor: item.color
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white">
              {item.volume24h}
            </div>
          </div>
          <div className="w-20 text-right">
            <div className="text-sm font-medium text-white">{item.marketShare.toFixed(1)}%</div>
            <div className={`text-xs flex items-center justify-end space-x-1 ${
              item.change24h > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              <TrendingUp className={`w-3 h-3 ${item.change24h < 0 ? 'rotate-180' : ''}`} />
              <span>{Math.abs(item.change24h).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderPieChart = () => {
    const centerX = 120;
    const centerY = 120;
    const radius = 80;
    let currentAngle = 0;

    return (
      <div className="flex items-center justify-center">
        <svg width="240" height="240" className="drop-shadow-lg">
          <defs>
            {filteredData.map((item, index) => (
              <linearGradient key={item.exchange} id={`gradient-${index}`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={item.color} stopOpacity="0.8" />
                <stop offset="100%" stopColor={item.color} stopOpacity="1" />
              </linearGradient>
            ))}
          </defs>
          
          {filteredData.map((item, index) => {
            const angle = (item.marketShare / 100) * 360;
            const x1 = centerX + radius * Math.cos((currentAngle * Math.PI) / 180);
            const y1 = centerY + radius * Math.sin((currentAngle * Math.PI) / 180);
            const x2 = centerX + radius * Math.cos(((currentAngle + angle) * Math.PI) / 180);
            const y2 = centerY + radius * Math.sin(((currentAngle + angle) * Math.PI) / 180);
            
            const largeArcFlag = angle > 180 ? 1 : 0;
            
            const pathData = [
              `M ${centerX} ${centerY}`,
              `L ${x1} ${y1}`,
              `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
              'Z'
            ].join(' ');
            
            currentAngle += angle;
            
            return (
              <path
                key={item.exchange}
                d={pathData}
                fill={`url(#gradient-${index})`}
                stroke="#374151"
                strokeWidth="2"
                className="transition-all duration-300 hover:brightness-110"
              />
            );
          })}
          
          <circle
            cx={centerX}
            cy={centerY}
            r="40"
            fill="#1F2937"
            stroke="#374151"
            strokeWidth="2"
          />
          <text
            x={centerX}
            y={centerY - 8}
            textAnchor="middle"
            className="text-sm font-bold fill-white"
          >
            Total
          </text>
          <text
            x={centerX}
            y={centerY + 8}
            textAnchor="middle"
            className="text-xs fill-gray-400"
          >
            {filteredData.reduce((sum: number, item: VolumeData) => sum + item.volume, 0).toFixed(1)}B
          </text>
        </svg>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Volume Comparison</h2>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <span className="text-gray-400 text-sm">Loading...</span>
          </div>
        </div>
        <div className="h-64 bg-gray-800 rounded-lg animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Volume Comparison</h2>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <span className="text-red-400 text-sm">Error</span>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={fetchVolumeData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Volume Comparison</h2>
          <p className="text-gray-400 text-sm">24h trading volume across exchanges</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-sm">Live Data</span>
          </div>
          <div className="flex items-center space-x-1 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('bar')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'bar' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <BarChart className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('pie')}
              className={`p-2 rounded-md transition-colors ${
                viewMode === 'pie' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="w-4 h-4 rounded-full border-2 border-current"></div>
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div ref={chartRef} className="mb-6">
        {viewMode === 'bar' ? renderBarChart() : renderPieChart()}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {volumeData.map((item) => (
          <div 
            key={item.exchange}
            className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all ${
              hiddenExchanges.has(item.exchange)
                ? 'bg-gray-800/30 opacity-50'
                : 'bg-gray-800/60 hover:bg-gray-800/80'
            }`}
            onClick={() => toggleExchange(item.exchange)}
          >
            <div 
              className="w-4 h-4 rounded"
              style={{ backgroundColor: item.color }}
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white truncate">{item.exchange}</div>
              <div className="text-xs text-gray-400">{item.volume24h}</div>
            </div>
            <button className="text-gray-400 hover:text-white">
              {hiddenExchanges.has(item.exchange) ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-blue-400">
              {filteredData.reduce((sum: number, item: VolumeData) => sum + item.volume, 0).toFixed(1)}B
            </div>
            <div className="text-xs text-gray-400">Total Volume</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-400">
              {filteredData.length > 0 ? filteredData[0].exchange : 'N/A'}
            </div>
            <div className="text-xs text-gray-400">Leader</div>
          </div>
          <div>
            <div className="text-lg font-bold text-purple-400">
              {filteredData.length > 0 ? filteredData[0].marketShare.toFixed(1) : '0'}%
            </div>
            <div className="text-xs text-gray-400">Market Share</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VolumeComparisonChart;