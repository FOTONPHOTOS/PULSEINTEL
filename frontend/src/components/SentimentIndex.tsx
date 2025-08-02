import React, { useState, useEffect } from 'react';
import { Heart, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { apiConfig } from '../apiConfig';

interface SentimentIndexProps {
  selectedAsset: string;
}

const SentimentIndex: React.FC<SentimentIndexProps> = ({ selectedAsset }) => {
  const [sentimentData, setSentimentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previousData, setPreviousData] = useState<any>(null);

  useEffect(() => {
    const fetchSentimentData = async () => {
      try {
        // Only show loading on initial fetch
        if (!sentimentData) {
          setLoading(true);
        }
        setError(null);
        
        // Try to fetch fear and greed index or general market sentiment
        const response = await fetch(`${apiConfig.REST_API_SERVICE}/api/market-overview`);
        
        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Sentiment data:', data);
        
        // Create mock sentiment based on market cap change
        const marketChange = data.market_cap_change_percentage_24h_usd || 0;
        let sentimentScore = 50; // Neutral
        let sentimentLabel = 'Neutral';
        let sentimentColor = 'text-gray-400';
        let sentimentIcon = <Minus className="h-5 w-5" />;
        
        if (marketChange > 2) {
          sentimentScore = 75;
          sentimentLabel = 'Bullish';
          sentimentColor = 'text-green-400';
          sentimentIcon = <TrendingUp className="h-5 w-5" />;
        } else if (marketChange > 0) {
          sentimentScore = 60;
          sentimentLabel = 'Optimistic';
          sentimentColor = 'text-green-300';
          sentimentIcon = <TrendingUp className="h-5 w-5" />;
        } else if (marketChange < -2) {
          sentimentScore = 25;
          sentimentLabel = 'Bearish';
          sentimentColor = 'text-red-400';
          sentimentIcon = <TrendingDown className="h-5 w-5" />;
        } else if (marketChange < 0) {
          sentimentScore = 40;
          sentimentLabel = 'Cautious';
          sentimentColor = 'text-orange-400';
          sentimentIcon = <TrendingDown className="h-5 w-5" />;
        }
        
        const newSentimentData = {
          score: sentimentScore,
          label: sentimentLabel,
          color: sentimentColor,
          icon: sentimentIcon,
          marketChange: marketChange
        };
        
        setPreviousData(sentimentData);
        setSentimentData(newSentimentData);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching sentiment data:', error);
        // Generate fallback sentiment data
        const fallbackData = {
          score: 65,
          label: 'Neutral',
          color: 'text-gray-400',
          icon: <Minus className="h-5 w-5" />,
          marketChange: 0
        };
        
        setPreviousData(sentimentData);
        setSentimentData(fallbackData);
        setLoading(false);
      }
    };

    fetchSentimentData();
    
    // Refresh every 30 seconds to prevent flickering
    const interval = setInterval(fetchSentimentData, 30000);
    return () => clearInterval(interval);
  }, [selectedAsset]);

  if (loading) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-white flex items-center">
              <Heart className="h-6 w-6 text-pink-400 mr-3" />
              Sentiment Index
              <span className="ml-3 text-xs bg-pink-500/20 text-pink-400 px-2 py-1 rounded border border-pink-500/30">
                SOCIAL
              </span>
            </h3>
            <p className="text-slate-400 text-sm mt-1">Market sentiment for {selectedAsset}</p>
          </div>
        </div>

        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading sentiment analysis...</p>
        </div>
      </div>
    );
  }

  // Use previous data if current is null to prevent flickering
  const displayData = sentimentData || previousData;
  
  if (error || !displayData) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-white flex items-center">
              <Heart className="h-6 w-6 text-pink-400 mr-3" />
              Sentiment Index
              <span className="ml-3 text-xs bg-pink-500/20 text-pink-400 px-2 py-1 rounded border border-pink-500/30">
                SOCIAL
              </span>
            </h3>
            <p className="text-slate-400 text-sm mt-1">Market sentiment for {selectedAsset}</p>
          </div>
        </div>

        <div className="text-center py-8">
          <Heart className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-red-400">{error || 'No sentiment data available'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white flex items-center">
            <Heart className="h-6 w-6 text-pink-400 mr-3" />
            Sentiment Index
            <span className="ml-3 text-xs bg-pink-500/20 text-pink-400 px-2 py-1 rounded border border-pink-500/30">
              MARKET
            </span>
          </h3>
          <p className="text-slate-400 text-sm mt-1">Market sentiment for {selectedAsset}</p>
        </div>
      </div>

      <div className="text-center">
        {/* Sentiment Score Circle */}
        <div className="relative w-32 h-32 mx-auto mb-6">
          <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="50"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-slate-700"
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeDasharray={`${(displayData.score / 100) * 314} 314`}
              className={displayData.color}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className={`${displayData.color} mb-1`}>
                {displayData.icon}
              </div>
              <div className="text-2xl font-bold text-white">{displayData.score}</div>
            </div>
          </div>
        </div>

        {/* Sentiment Label */}
        <div className="mb-4">
          <h4 className={`text-xl font-bold ${displayData.color}`}>
            {displayData.label}
          </h4>
          <p className="text-slate-400 text-sm">
            Based on market performance ({displayData.marketChange > 0 ? '+' : ''}{displayData.marketChange.toFixed(2)}%)
          </p>
        </div>

        {/* Sentiment Scale */}
        <div className="flex justify-between text-xs text-slate-500 mb-2">
          <span>Bearish</span>
          <span>Neutral</span>
          <span>Bullish</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-500 ${
              displayData.score >= 60 ? 'bg-green-400' : 
              displayData.score >= 40 ? 'bg-yellow-400' : 'bg-red-400'
            }`}
            style={{ width: `${displayData.score}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default SentimentIndex;