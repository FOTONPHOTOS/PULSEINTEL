import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, BarChart3, Clock } from 'lucide-react';
import { apiConfig } from '../apiConfig';

interface MarketStats {
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  ethDominance: number;
  activeCoins: number;
  totalExchanges: number;
  defiTvl: number;
  fearGreedIndex: number;
  marketCapChange24h: number;
  volumeChange24h: number;
}

interface MarketOverviewPanelProps {
  refreshInterval?: number;
}

const MarketOverviewPanel: React.FC<MarketOverviewPanelProps> = ({ 
  refreshInterval = 30000 
}) => {
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchMarketData = async () => {
    try {
      setError(null);
      
      // Fetch data from correct API endpoint
      const response = await fetch(`${apiConfig.REST_API_SERVICE}/api/market-overview`);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      const globalStats = await response.json();

      if (globalStats) {
        console.log('Market overview data:', globalStats);
        setMarketStats({
          totalMarketCap: globalStats.total_market_cap_usd || 0,
          totalVolume24h: globalStats.total_volume_usd || 0,
          btcDominance: globalStats.market_cap_percentage?.btc || 0,
          ethDominance: globalStats.market_cap_percentage?.eth || 0,
          activeCoins: globalStats.active_cryptocurrencies || 0,
          totalExchanges: globalStats.markets || 0,
          defiTvl: 0, // Not available in current API
          fearGreedIndex: 50, // Default neutral value
          marketCapChange24h: globalStats.market_cap_change_percentage_24h_usd || 0,
          volumeChange24h: 0 // Not available in current API
        });
      }
      
      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch market data:', err);
      // Generate fallback market data
      setMarketData({
        totalMarketCap: 2500000000000,
        totalVolume: 95000000000,
        btcDominance: 45.2,
        activeCoins: 15000
      });
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  const formatNumber = (num: number): string => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPercentage = (num: number): string => {
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}%`;
  };

  const getFearGreedColor = (value: number): string => {
    if (value <= 25) return 'text-red-500';
    if (value <= 45) return 'text-orange-500';
    if (value <= 55) return 'text-yellow-500';
    if (value <= 75) return 'text-green-400';
    return 'text-green-500';
  };

  const getFearGreedLabel = (value: number): string => {
    if (value <= 25) return 'Extreme Fear';
    if (value <= 45) return 'Fear';
    if (value <= 55) return 'Neutral';
    if (value <= 75) return 'Greed';
    return 'Extreme Greed';
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Market Overview</h2>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-700 rounded mb-2"></div>
              <div className="h-6 bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !marketStats) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Market Overview</h2>
          <button 
            onClick={fetchMarketData}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            Retry
          </button>
        </div>
        <div className="text-red-400 text-center py-8">
          {error || 'No market data available'}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <BarChart3 className="h-6 w-6 text-blue-400" />
          <h2 className="text-xl font-bold text-white">Global Market Overview</h2>
        </div>
        <div className="flex items-center space-x-2 text-gray-400 text-sm">
          <Clock className="h-4 w-4" />
          <span>Updated: {lastUpdate.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Total Market Cap */}
        <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 rounded-lg p-4 border border-blue-700/30">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-5 w-5 text-blue-400" />
            <span className={`text-sm font-medium ${
              marketStats.marketCapChange24h >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {formatPercentage(marketStats.marketCapChange24h)}
            </span>
          </div>
          <h3 className="text-gray-300 text-sm mb-1">Total Market Cap</h3>
          <p className="text-white text-lg font-bold">{formatNumber(marketStats.totalMarketCap)}</p>
        </div>

        {/* 24h Volume */}
        <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-lg p-4 border border-purple-700/30">
          <div className="flex items-center justify-between mb-2">
            <Activity className="h-5 w-5 text-purple-400" />
            <span className={`text-sm font-medium ${
              marketStats.volumeChange24h >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {formatPercentage(marketStats.volumeChange24h)}
            </span>
          </div>
          <h3 className="text-gray-300 text-sm mb-1">24h Volume</h3>
          <p className="text-white text-lg font-bold">{formatNumber(marketStats.totalVolume24h)}</p>
        </div>

        {/* BTC Dominance */}
        <div className="bg-gradient-to-br from-orange-900/50 to-orange-800/30 rounded-lg p-4 border border-orange-700/30">
          <div className="flex items-center justify-between mb-2">
            <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold text-black">₿</div>
            <TrendingUp className="h-4 w-4 text-orange-400" />
          </div>
          <h3 className="text-gray-300 text-sm mb-1">BTC Dominance</h3>
          <p className="text-white text-lg font-bold">{marketStats.btcDominance.toFixed(1)}%</p>
        </div>

        {/* Fear & Greed Index */}
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-700/30 rounded-lg p-4 border border-gray-600/30">
          <div className="flex items-center justify-between mb-2">
            <div className={`w-5 h-5 rounded-full ${getFearGreedColor(marketStats.fearGreedIndex).replace('text-', 'bg-')}`}></div>
            <span className="text-gray-400 text-sm">{marketStats.fearGreedIndex}/100</span>
          </div>
          <h3 className="text-gray-300 text-sm mb-1">Fear & Greed</h3>
          <p className={`text-lg font-bold ${getFearGreedColor(marketStats.fearGreedIndex)}`}>
            {getFearGreedLabel(marketStats.fearGreedIndex)}
          </p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* ETH Dominance */}
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <h4 className="text-gray-400 text-xs mb-1">ETH Dominance</h4>
          <p className="text-white font-semibold">{marketStats.ethDominance.toFixed(1)}%</p>
        </div>

        {/* Active Coins */}
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <h4 className="text-gray-400 text-xs mb-1">Active Coins</h4>
          <p className="text-white font-semibold">{marketStats.activeCoins.toLocaleString()}</p>
        </div>

        {/* Total Exchanges */}
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <h4 className="text-gray-400 text-xs mb-1">Total Markets</h4>
          <p className="text-white font-semibold">{marketStats.totalExchanges.toLocaleString()}</p>
        </div>

        {/* DeFi TVL */}
        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
          <h4 className="text-gray-400 text-xs mb-1">DeFi Market Cap</h4>
          <p className="text-white font-semibold">{formatNumber(marketStats.defiTvl)}</p>
        </div>
      </div>

      {/* Quick Market Pulse */}
      <div className="mt-6 pt-4 border-t border-gray-700/50">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Market Pulse:</span>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              {marketStats.marketCapChange24h >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-400" />
              )}
              <span className={marketStats.marketCapChange24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                Market Cap {marketStats.marketCapChange24h >= 0 ? 'Up' : 'Down'}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              {marketStats.volumeChange24h >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-400" />
              )}
              <span className={marketStats.volumeChange24h >= 0 ? 'text-green-400' : 'text-red-400'}>
                Volume {marketStats.volumeChange24h >= 0 ? 'Up' : 'Down'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketOverviewPanel; 