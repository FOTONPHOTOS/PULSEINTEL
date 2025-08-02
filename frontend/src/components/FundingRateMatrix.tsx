import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, RefreshCw } from 'lucide-react';
import { apiConfig } from '../apiConfig';
import { subscribeToTrades } from '../services/WebSocketService';

interface FundingRateData {
  exchange: string;
  symbol: string;
  rate: number;
  nextFundingTime: number;
  timestamp: number;
  annualizedRate: number;
  status: 'positive' | 'negative' | 'neutral';
}

interface FundingRateMatrixProps {
  symbols?: string[];
  refreshInterval?: number;
}

const FundingRateMatrix: React.FC<FundingRateMatrixProps> = ({ 
  symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'],
  refreshInterval = 300000 // 5 minutes
}) => {
  const [fundingData, setFundingData] = useState<FundingRateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'exchange' | 'symbol' | 'rate'>('rate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('all');

  const fetchFundingRates = async () => {
    try {
      setError(null);
      const promises = symbols.map(symbol => 
        fetch(`${apiConfig.REST_API_SERVICE}/api/funding-rates/${symbol}`)
          .then(res => res.ok ? res.json() : null)
          .catch(() => null)
      );

      const results = await Promise.all(promises);
      const allRates: FundingRateData[] = [];

      results.forEach((result, index) => {
        if (result && result.rates) {
          const symbol = symbols[index];
          result.rates.forEach((rate: any) => {
            const rateValue = parseFloat(rate.rate) || 0;
            allRates.push({
              exchange: rate.exchange,
              symbol,
              rate: rateValue,
              nextFundingTime: rate.nextFundingTime || 0,
              timestamp: rate.timestamp || Date.now(),
              annualizedRate: rateValue * 365 * 3, // Assuming 8-hour funding
              status: rateValue > 0.01 ? 'positive' : rateValue < -0.01 ? 'negative' : 'neutral'
            });
          });
        }
      });

      setFundingData(allRates);
    } catch (err) {
      console.error('Failed to fetch funding rates:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch funding rates');
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (column: 'exchange' | 'symbol' | 'rate') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'rate' ? 'desc' : 'asc');
    }
  };

  const filteredData = fundingData.filter(item => 
    selectedSymbol === 'all' || item.symbol === selectedSymbol
  );

  const sortedData = [...filteredData].sort((a, b) => {
    let aVal, bVal;
    
    switch (sortBy) {
      case 'exchange':
        aVal = a.exchange;
        bVal = b.exchange;
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      case 'symbol':
        aVal = a.symbol;
        bVal = b.symbol;
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      case 'rate':
        aVal = Math.abs(a.rate);
        bVal = Math.abs(b.rate);
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      default:
        return 0;
    }
  });

  const formatRate = (rate: number) => {
    return `${(rate * 100).toFixed(4)}%`;
  };

  const formatTimeUntilFunding = (timestamp: number) => {
    if (!timestamp) return 'Unknown';
    
    const now = Date.now();
    const diff = timestamp - now;
    
    if (diff <= 0) return 'Now';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getRateColor = (rate: number) => {
    if (rate > 0.01) return 'text-red-400';
    if (rate < -0.01) return 'text-green-400';
    return 'text-gray-400';
  };

  const getRateBackground = (rate: number) => {
    if (rate > 0.01) return 'bg-red-900/20';
    if (rate < -0.01) return 'bg-green-900/20';
    return 'bg-gray-900/20';
  };

  const getOpportunityBadge = (rate: number) => {
    const absRate = Math.abs(rate);
    if (absRate > 0.05) return { text: 'High', color: 'bg-red-600' };
    if (absRate > 0.02) return { text: 'Med', color: 'bg-yellow-600' };
    if (absRate > 0.005) return { text: 'Low', color: 'bg-blue-600' };
    return null;
  };

  useEffect(() => {
    fetchFundingRates();
    
    const interval = setInterval(fetchFundingRates, refreshInterval);
    
    return () => {
      clearInterval(interval);
    };
  }, [refreshInterval, symbols]);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Funding Rate Matrix</h2>
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
            <span className="text-gray-400 text-sm">Loading...</span>
          </div>
        </div>
        <div className="space-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-800 rounded-lg animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Funding Rate Matrix</h2>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 text-sm">Error</span>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-red-400 mb-4">{error}</p>
          <button 
            onClick={fetchFundingRates}
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
          <h2 className="text-2xl font-bold text-white">Funding Rate Matrix</h2>
          <p className="text-gray-400 text-sm">Real-time funding rates across exchanges</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-green-400 text-sm">Live Data</span>
          </div>
          <button 
            onClick={fetchFundingRates}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <span className="text-gray-400 text-sm">Symbol:</span>
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="bg-gray-800 text-white px-3 py-1.5 rounded-md border border-gray-600 text-sm"
          >
            <option value="all">All Symbols</option>
            {symbols.map(symbol => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-gray-400 text-sm">Sort by:</span>
          {[
            { key: 'rate', label: 'Rate' },
            { key: 'exchange', label: 'Exchange' },
            { key: 'symbol', label: 'Symbol' }
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
      </div>

      {/* Matrix Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-800/50 rounded-lg mb-2 text-sm font-medium text-gray-400">
        <div className="col-span-2">Exchange</div>
        <div className="col-span-2">Symbol</div>
        <div className="col-span-2">Funding Rate</div>
        <div className="col-span-2">Annualized</div>
        <div className="col-span-2">Next Funding</div>
        <div className="col-span-1">Opportunity</div>
        <div className="col-span-1">Status</div>
      </div>

      {/* Matrix Data */}
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {sortedData.map((item, index) => {
          const opportunity = getOpportunityBadge(item.rate);
          
          return (
            <div 
              key={`${item.exchange}-${item.symbol}-${index}`}
              className={`grid grid-cols-12 gap-4 px-4 py-3 rounded-lg transition-all duration-200 hover:bg-gray-800/60 ${
                getRateBackground(item.rate)
              }`}
            >
              {/* Exchange */}
              <div className="col-span-2 flex items-center">
                <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xs mr-2">
                  {item.exchange.charAt(0)}
                </div>
                <span className="font-medium text-white">{item.exchange}</span>
              </div>

              {/* Symbol */}
              <div className="col-span-2 flex items-center">
                <span className="font-medium text-white">{item.symbol}</span>
              </div>

              {/* Funding Rate */}
              <div className="col-span-2 flex items-center">
                <div className={`font-bold ${getRateColor(item.rate)}`}>
                  {formatRate(item.rate)}
                </div>
                <div className="ml-2">
                  {item.rate > 0 ? (
                    <TrendingUp className="w-4 h-4 text-red-400" />
                  ) : item.rate < 0 ? (
                    <TrendingDown className="w-4 h-4 text-green-400" />
                  ) : (
                    <div className="w-4 h-4" />
                  )}
                </div>
              </div>

              {/* Annualized Rate */}
              <div className="col-span-2 flex items-center">
                <span className={`font-medium ${getRateColor(item.annualizedRate)}`}>
                  {formatRate(item.annualizedRate)}
                </span>
              </div>

              {/* Next Funding */}
              <div className="col-span-2 flex items-center">
                <span className="text-gray-300">
                  {formatTimeUntilFunding(item.nextFundingTime)}
                </span>
              </div>

              {/* Opportunity */}
              <div className="col-span-1 flex items-center">
                {opportunity && (
                  <span className={`px-2 py-1 text-xs font-medium text-white rounded ${opportunity.color}`}>
                    {opportunity.text}
                  </span>
                )}
              </div>

              {/* Status */}
              <div className="col-span-1 flex items-center">
                <div className={`w-3 h-3 rounded-full ${
                  item.status === 'positive' ? 'bg-red-400' :
                  item.status === 'negative' ? 'bg-green-400' : 'bg-gray-400'
                }`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-blue-400">{sortedData.length}</div>
            <div className="text-xs text-gray-400">Total Pairs</div>
          </div>
          <div>
            <div className="text-lg font-bold text-red-400">
              {sortedData.filter(item => item.rate > 0).length}
            </div>
            <div className="text-xs text-gray-400">Positive Rates</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-400">
              {sortedData.filter(item => item.rate < 0).length}
            </div>
            <div className="text-xs text-gray-400">Negative Rates</div>
          </div>
          <div>
            <div className="text-lg font-bold text-yellow-400">
              {sortedData.filter(item => Math.abs(item.rate) > 0.02).length}
            </div>
            <div className="text-xs text-gray-400">High Opportunity</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="flex items-center justify-center space-x-6 text-xs text-gray-400">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-400 rounded-full"></div>
            <span>Positive (Longs pay Shorts)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            <span>Negative (Shorts pay Longs)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
            <span>Neutral</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FundingRateMatrix; 