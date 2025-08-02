import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Trophy } from 'lucide-react';
import { apiConfig } from '../apiConfig'; // Import the centralized config

// ... (interfaces remain the same)

const ExchangeVolumeRankings: React.FC<ExchangeVolumeRankingsProps> = ({ selectedAsset }) => {
  const [exchanges, setExchanges] = useState<ExchangeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchExchangeData = async () => {
      try {
        // setIsLoading(true); // Avoid flicker on refetch

        // Fetch from the correct REST API Service (port 8001)
        const response = await fetch(`${apiConfig.REST_API_SERVICE}/api/exchange-rankings`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        console.log('Exchange volume rankings data:', data);
        
        if (Array.isArray(data)) {
          // Map API response to component format
          const formattedExchanges = data.map((exchange: any, index: number) => ({
            name: exchange.name || exchange.exchange || `Exchange ${index + 1}`,
            rank: index + 1,
            volume24h: exchange.volume_24h ? (exchange.volume_24h / 1e9).toFixed(1) + 'B' : '0B',
            openInterest: exchange.open_interest ? (exchange.open_interest / 1e6).toFixed(0) + 'M' : '0M',
            takerFee: exchange.taker_fee || 0.001,
            makerFee: exchange.maker_fee || 0.0005,
            liquidation24h: exchange.liquidations_24h ? (exchange.liquidations_24h / 1e6).toFixed(0) + 'M' : '0M',
            score: exchange.score || (90 + Math.random() * 10)
          }));
          
          setExchanges(formattedExchanges);
        }
      } catch (error) {
        console.error('Error fetching exchange data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExchangeData();
    const interval = setInterval(fetchExchangeData, 5000); // Update every minute
    
    return () => clearInterval(interval);
  }, [selectedAsset]);


  const formatVolume = (volume: string) => {
    const num = parseFloat(volume);
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1: return <Trophy className="h-4 w-4 text-yellow-400" />;
      case 2: return <Trophy className="h-4 w-4 text-gray-300" />;
      case 3: return <Trophy className="h-4 w-4 text-amber-600" />;
      default: return <span className="text-slate-400 text-sm font-medium">#{rank}</span>;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (isLoading) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-xl font-semibold text-white flex items-center mb-4">
          <BarChart3 className="h-6 w-6 text-blue-400 mr-3" />
          Exchange Volume Rankings
          <span className="ml-3 text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30">
            LIVE
          </span>
        </h3>
        <div className="text-center py-8">
          <BarChart3 className="h-12 w-12 text-slate-600 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-400">Loading exchange data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
      <h3 className="text-xl font-semibold text-white flex items-center mb-4">
        <BarChart3 className="h-6 w-6 text-blue-400 mr-3" />
        Exchange Volume Rankings
        <span className="ml-3 text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30">
          LIVE
        </span>
      </h3>
      
      <div className="space-y-3">
        {exchanges.slice(0, 8).map((exchange) => (
          <div 
            key={exchange.name}
            className="flex items-center justify-between p-3 bg-slate-800/30 rounded-lg hover:bg-slate-800/50 transition-all"
          >
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-8 h-8">
                {getRankIcon(exchange.rank)}
              </div>
              <div>
                <p className="text-white font-medium">{exchange.name}</p>
                <p className="text-slate-400 text-sm">
                  Fees: {(exchange.takerFee * 100).toFixed(3)}% / {(exchange.makerFee * 100).toFixed(3)}%
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-white font-bold">{formatVolume(exchange.volume24h)}</p>
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium ${getScoreColor(exchange.score)}`}>
                  {exchange.score.toFixed(0)}
                </span>
                <TrendingUp className="h-3 w-3 text-green-400" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="bg-slate-800/20 rounded-lg p-3">
          <p className="text-slate-400 text-sm">Total Exchanges</p>
          <p className="text-white text-lg font-bold">{exchanges.length}</p>
        </div>
        <div className="bg-slate-800/20 rounded-lg p-3">
          <p className="text-slate-400 text-sm">Total Volume</p>
          <p className="text-white text-lg font-bold">
            {formatVolume(
              exchanges.reduce((sum, ex) => sum + parseFloat(ex.volume24h), 0).toString()
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExchangeVolumeRankings;
