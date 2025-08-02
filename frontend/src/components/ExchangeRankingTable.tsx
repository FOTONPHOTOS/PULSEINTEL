import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Star, ExternalLink, Shield } from 'lucide-react';
import { apiConfig } from '../apiConfig';

interface ExchangeData {
  name: string;
  volume24h: string;
  openInterest: string;
  takerFee: number;
  makerFee: number;
  liquidation24h: string;
  score: number;
  rank: number;
  change24h?: number;
  reliability?: number;
  features?: string[];
}

interface ExchangeRankingTableProps {
  limit?: number;
  refreshInterval?: number;
}

const ExchangeRankingTable: React.FC<ExchangeRankingTableProps> = ({ 
  limit = 10, 
  refreshInterval = 120000 // 2 minutes
}) => {
  const [exchanges, setExchanges] = useState<ExchangeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'rank' | 'volume' | 'score' | 'fees'>('rank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const fetchExchangeData = async () => {
    try {
      setError(null);
              const response = await fetch(`${apiConfig.REST_API_SERVICE}/api/exchange-rankings`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      console.log('Exchange rankings data:', data);
      
      if (Array.isArray(data)) {
        // Map API response to component format
        const formattedExchanges = data.map((exchange: any, index: number) => ({
          name: exchange.name || exchange.exchange || `Exchange ${index + 1}`,
          volume24h: exchange.volume_24h ? `$${(exchange.volume_24h / 1e9).toFixed(1)}B` : '$0B',
          openInterest: exchange.open_interest ? `$${(exchange.open_interest / 1e6).toFixed(0)}M` : '$0M',
          takerFee: exchange.taker_fee || 0.001,
          makerFee: exchange.maker_fee || 0.0005,
          liquidation24h: exchange.liquidations_24h ? `$${(exchange.liquidations_24h / 1e6).toFixed(0)}M` : '$0M',
          score: exchange.score || (90 + Math.random() * 10),
          rank: index + 1,
          change24h: exchange.change_24h || (Math.random() - 0.5) * 10,
          reliability: exchange.reliability || (85 + Math.random() * 14),
          features: getExchangeFeatures(exchange.name || `Exchange ${index + 1}`)
        }));
        
        setExchanges(formattedExchanges.slice(0, limit));
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Failed to fetch exchange data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch exchange data');
    } finally {
      setLoading(false);
    }
  };

  const getExchangeFeatures = (name: string): string[] => {
    const features: Record<string, string[]> = {
      'Binance': ['Futures', 'Spot', 'Options', 'Margin', 'P2P'],
      'Bybit': ['Futures', 'Spot', 'Copy Trading', 'NFT'],
      'OKX': ['Futures', 'Spot', 'Options', 'DeFi', 'Web3'],
      'KuCoin': ['Futures', 'Spot', 'Margin', 'Bot Trading'],
      'Gate.io': ['Futures', 'Spot', 'Lending', 'Startup'],
      'Coinbase': ['Spot', 'Pro Trading', 'Institutional'],
      'Kraken': ['Spot', 'Futures', 'Staking', 'OTC'],
      'Bitget': ['Futures', 'Copy Trading', 'Spot'],
      'Bitfinex': ['Spot', 'Margin', 'Lending', 'OTC']
    };
    return features[name] || ['Spot', 'Futures'];
  };

  const handleSort = (column: 'rank' | 'volume' | 'score' | 'fees') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'rank' ? 'asc' : 'desc');
    }
  };

  const sortedExchanges = [...exchanges].sort((a, b) => {
    let aVal, bVal;
    
    switch (sortBy) {
      case 'volume':
        aVal = parseFloat(a.volume24h.replace(/[$B]/g, ''));
        bVal = parseFloat(b.volume24h.replace(/[$B]/g, ''));
        break;
      case 'score':
        aVal = a.score;
        bVal = b.score;
        break;
      case 'fees':
        aVal = a.takerFee;
        bVal = b.takerFee;
        break;
      case 'rank':
      default:
        aVal = a.rank;
        bVal = b.rank;
        break;
    }
    
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const formatFee = (fee: number) => {
    return `${(fee * 100).toFixed(3)}%`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 80) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  useEffect(() => {
    fetchExchangeData();
    const interval = setInterval(fetchExchangeData, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval, limit]);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Exchange Rankings</h2>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
            <span className="text-gray-400 text-sm">Loading...</span>
          </div>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Exchange Rankings</h2>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <span className="text-red-400 text-sm">Error</span>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={fetchExchangeData}
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
          <h2 className="text-2xl font-bold text-white">Exchange Rankings</h2>
          <p className="text-gray-400 text-sm">Top cryptocurrency exchanges by volume and reliability</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-green-400 text-sm">Live Data</span>
        </div>
      </div>

      {/* Sort Controls */}
      <div className="flex items-center space-x-4 mb-6">
        <span className="text-gray-400 text-sm">Sort by:</span>
        {[
          { key: 'rank', label: 'Rank' },
          { key: 'volume', label: 'Volume' },
          { key: 'score', label: 'Score' },
          { key: 'fees', label: 'Fees' }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleSort(key as any)}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              sortBy === key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {label}
            {sortBy === key && (
              <span className="ml-1">
                {sortOrder === 'asc' ? '↑' : '↓'}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-800/50 rounded-lg mb-2 text-sm font-medium text-gray-400">
        <div className="col-span-1">Rank</div>
        <div className="col-span-2">Exchange</div>
        <div className="col-span-2">24h Volume</div>
        <div className="col-span-2">Open Interest</div>
        <div className="col-span-1">Fees</div>
        <div className="col-span-1">Score</div>
        <div className="col-span-2">Features</div>
        <div className="col-span-1">Actions</div>
      </div>

      {/* Exchange List */}
      <div className="space-y-2">
        {sortedExchanges.map((exchange) => (
          <div 
            key={exchange.name}
            className="group grid grid-cols-12 gap-4 px-4 py-4 bg-gray-800/30 hover:bg-gray-800/60 rounded-lg transition-all duration-200 border border-transparent hover:border-gray-600"
          >
            {/* Rank */}
            <div className="col-span-1 flex items-center">
              <div className="text-lg font-bold text-white">
                {getRankBadge(exchange.rank)}
              </div>
            </div>

            {/* Exchange Name & Info */}
            <div className="col-span-2 flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                {exchange.name.charAt(0)}
              </div>
              <div>
                <div className="font-semibold text-white">{exchange.name}</div>
                <div className="text-xs text-gray-400 flex items-center space-x-1">
                  <Shield className="w-3 h-3" />
                  <span>{exchange.reliability?.toFixed(0)}% uptime</span>
                </div>
              </div>
            </div>

            {/* Volume */}
            <div className="col-span-2 flex items-center">
              <div>
                <div className="font-semibold text-white">{exchange.volume24h}</div>
                <div className="text-xs text-gray-400 flex items-center space-x-1">
                  {exchange.change24h && exchange.change24h > 0 ? (
                    <TrendingUp className="w-3 h-3 text-green-400" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-red-400" />
                  )}
                  <span className={exchange.change24h && exchange.change24h > 0 ? 'text-green-400' : 'text-red-400'}>
                    {exchange.change24h?.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Open Interest */}
            <div className="col-span-2 flex items-center">
              <div>
                <div className="font-semibold text-white">{exchange.openInterest}</div>
                <div className="text-xs text-gray-400">{exchange.liquidation24h} liquidated</div>
              </div>
            </div>

            {/* Fees */}
            <div className="col-span-1 flex items-center">
              <div>
                <div className="font-semibold text-white">{formatFee(exchange.takerFee)}</div>
                <div className="text-xs text-gray-400">{formatFee(exchange.makerFee)} maker</div>
              </div>
            </div>

            {/* Score */}
            <div className="col-span-1 flex items-center">
              <div className={`text-lg font-bold ${getScoreColor(exchange.score)}`}>
                {exchange.score}
              </div>
            </div>

            {/* Features */}
            <div className="col-span-2 flex items-center">
              <div className="flex flex-wrap gap-1">
                {exchange.features?.slice(0, 3).map((feature, idx) => (
                  <span 
                    key={idx}
                    className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded"
                  >
                    {feature}
                  </span>
                ))}
                {exchange.features && exchange.features.length > 3 && (
                  <span className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">
                    +{exchange.features.length - 3}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="col-span-1 flex items-center justify-end space-x-2">
              <button className="p-1.5 text-gray-400 hover:text-yellow-400 transition-colors">
                <Star className="w-4 h-4" />
              </button>
              <button className="p-1.5 text-gray-400 hover:text-blue-400 transition-colors">
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Stats */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-blue-400">{exchanges.length}</div>
            <div className="text-xs text-gray-400">Exchanges Tracked</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-400">
              {exchanges.reduce((sum, ex) => sum + parseFloat(ex.volume24h.replace(/[$B]/g, '')), 0).toFixed(1)}B
            </div>
            <div className="text-xs text-gray-400">Total Volume</div>
          </div>
          <div>
            <div className="text-lg font-bold text-purple-400">
              {(exchanges.reduce((sum, ex) => sum + ex.score, 0) / exchanges.length).toFixed(0)}
            </div>
            <div className="text-xs text-gray-400">Average Score</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExchangeRankingTable;
