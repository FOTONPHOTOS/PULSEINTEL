import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, TrendingDown, Users, Building, Zap, Target } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface SentimentSignal {
  id: string;
  source: 'options_flow' | 'whale_activity' | 'funding_rates' | 'social_volume' | 'fear_greed';
  signal: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-100
  confidence: number; // 0-100
  timestamp: number;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

interface SentimentData {
  timestamp: number;
  institutional_sentiment: number;
  retail_sentiment: number;
  overall_sentiment: number;
  fear_greed_index: number;
  whale_sentiment: number;
  options_sentiment: number;
}

interface InstitutionalSentimentProps {
  symbol: string;
}

const InstitutionalSentiment: React.FC<InstitutionalSentimentProps> = ({ symbol }) => {
  const [signals, setSignals] = useState<SentimentSignal[]>([]);
  const [sentimentData, setSentimentData] = useState<SentimentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [timeframe, setTimeframe] = useState<'1h' | '4h' | '1d' | '7d'>('1d');
  const [filter, setFilter] = useState<'all' | 'institutional' | 'retail'>('all');

  useEffect(() => {
    const fetchRealSentimentData = async () => {
      try {
        setLoading(true);
        
        // Fetch real institutional sentiment data from backend
        const response = await fetch(`http://localhost:8888/api/institutional-sentiment/${symbol}?timeframe=${timeframe}`);
        const data = await response.json();

        if (data.error) {
          console.error('Sentiment API Error:', data.error);
          setLoading(false);
          return;
        }

        // Transform real API response to component format
        if (data.sentiment_data && Array.isArray(data.sentiment_data)) {
          const realSentimentData: SentimentData[] = data.sentiment_data.map((point: any) => ({
            timestamp: point.timestamp || Date.now(),
            institutional_sentiment: parseFloat(point.institutional_sentiment || '50'),
            retail_sentiment: parseFloat(point.retail_sentiment || '50'),
            overall_sentiment: parseFloat(point.overall_sentiment || '50'),
            fear_greed_index: parseFloat(point.fear_greed_index || '50'),
            whale_sentiment: parseFloat(point.whale_sentiment || '50'),
            options_sentiment: parseFloat(point.options_sentiment || '50')
          }));

          setSentimentData(realSentimentData);
        }

        // Set real signals data
        if (data.signals && Array.isArray(data.signals)) {
          const realSignals: SentimentSignal[] = data.signals.map((signal: any) => ({
            id: signal.id || Math.random().toString(),
            source: signal.source || 'whale_activity',
            signal: signal.signal || 'neutral',
            strength: parseFloat(signal.strength || '50'),
            confidence: parseFloat(signal.confidence || '75'),
            timestamp: signal.timestamp || Date.now(),
            description: signal.description || 'Real sentiment signal detected',
            impact: signal.impact || 'medium'
          }));
          
          setSignals(realSignals.sort((a, b) => b.timestamp - a.timestamp));
        }

        console.log(`✅ Loaded real sentiment data for ${symbol}: ${data.sentiment_data?.length || 0} data points, ${data.signals?.length || 0} signals`);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch real sentiment data:', error);
        setLoading(false);
      }
    };

    fetchRealSentimentData();
    
    // Update every 30 seconds with real data
    const interval = setInterval(fetchRealSentimentData, 5000);
    return () => clearInterval(interval);
  }, [symbol, timeframe]);

  const getSignalColor = (signal: string): string => {
    switch (signal) {
      case 'bullish': return 'text-green-400';
      case 'bearish': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  const getSignalBg = (signal: string): string => {
    switch (signal) {
      case 'bullish': return 'bg-green-900/50 text-green-300';
      case 'bearish': return 'bg-red-900/50 text-red-300';
      default: return 'bg-yellow-900/50 text-yellow-300';
    }
  };

  const getImpactColor = (impact: string): string => {
    switch (impact) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      default: return 'text-green-400';
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'options_flow': return <Target className="w-4 h-4" />;
      case 'whale_activity': return <Users className="w-4 h-4" />;
      case 'funding_rates': return <TrendingUp className="w-4 h-4" />;
      case 'social_volume': return <Brain className="w-4 h-4" />;
      case 'fear_greed': return <Zap className="w-4 h-4" />;
      default: return <Brain className="w-4 h-4" />;
    }
  };

  const formatTime = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    
    if (hours > 24) return `${Math.floor(hours / 24)}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  };

  const latestSentiment = sentimentData[sentimentData.length - 1];
  
  // Pie chart data for sentiment breakdown
  const pieData = latestSentiment ? [
    { name: 'Institutional', value: latestSentiment.institutional_sentiment, color: '#3b82f6' },
    { name: 'Retail', value: latestSentiment.retail_sentiment, color: '#f59e0b' },
  ] : [];

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Brain className="w-5 h-5 mr-2 text-purple-400" />
            Institutional Sentiment
          </h3>
        </div>
        <div className="animate-pulse">
          <div className="h-48 bg-gray-800 rounded-lg mb-4"></div>
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-800 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Brain className="w-5 h-5 mr-2 text-purple-400" />
          Institutional Sentiment
        </h3>
        
        <div className="flex items-center space-x-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="bg-gray-800 text-white text-sm px-3 py-1 rounded border border-gray-600"
          >
            <option value="all">All Signals</option>
            <option value="institutional">Institutional</option>
            <option value="retail">Retail</option>
          </select>
          
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            className="bg-gray-800 text-white text-sm px-3 py-1 rounded border border-gray-600"
          >
            <option value="1h">1H</option>
            <option value="4h">4H</option>
            <option value="1d">1D</option>
            <option value="7d">7D</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {latestSentiment && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Overall Sentiment</p>
                <p className={`text-lg font-semibold ${latestSentiment.overall_sentiment >= 60 ? 'text-green-400' : latestSentiment.overall_sentiment <= 40 ? 'text-red-400' : 'text-yellow-400'}`}>
                  {latestSentiment.overall_sentiment.toFixed(0)}%
                </p>
              </div>
              <Brain className={`w-5 h-5 ${latestSentiment.overall_sentiment >= 60 ? 'text-green-400' : latestSentiment.overall_sentiment <= 40 ? 'text-red-400' : 'text-yellow-400'}`} />
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Institutional</p>
                <p className={`text-lg font-semibold ${latestSentiment.institutional_sentiment >= 60 ? 'text-green-400' : latestSentiment.institutional_sentiment <= 40 ? 'text-red-400' : 'text-yellow-400'}`}>
                  {latestSentiment.institutional_sentiment.toFixed(0)}%
                </p>
              </div>
              <Building className={`w-5 h-5 ${latestSentiment.institutional_sentiment >= 60 ? 'text-green-400' : latestSentiment.institutional_sentiment <= 40 ? 'text-red-400' : 'text-yellow-400'}`} />
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Retail Sentiment</p>
                <p className={`text-lg font-semibold ${latestSentiment.retail_sentiment >= 60 ? 'text-green-400' : latestSentiment.retail_sentiment <= 40 ? 'text-red-400' : 'text-yellow-400'}`}>
                  {latestSentiment.retail_sentiment.toFixed(0)}%
                </p>
              </div>
              <Users className={`w-5 h-5 ${latestSentiment.retail_sentiment >= 60 ? 'text-green-400' : latestSentiment.retail_sentiment <= 40 ? 'text-red-400' : 'text-yellow-400'}`} />
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Fear & Greed</p>
                <p className={`text-lg font-semibold ${latestSentiment.fear_greed_index >= 60 ? 'text-green-400' : latestSentiment.fear_greed_index <= 40 ? 'text-red-400' : 'text-yellow-400'}`}>
                  {latestSentiment.fear_greed_index.toFixed(0)}
                </p>
              </div>
              <Zap className={`w-5 h-5 ${latestSentiment.fear_greed_index >= 60 ? 'text-green-400' : latestSentiment.fear_greed_index <= 40 ? 'text-red-400' : 'text-yellow-400'}`} />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Sentiment Chart */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h4 className="text-white font-medium mb-4">Sentiment Trends</h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sentimentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="timestamp" 
                  stroke="#6b7280"
                  tickFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <YAxis stroke="#6b7280" domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                />
                <Line 
                  type="monotone" 
                  dataKey="institutional_sentiment" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Institutional"
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="retail_sentiment" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  name="Retail"
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="overall_sentiment" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="Overall"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sentiment Breakdown */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h4 className="text-white font-medium mb-4">Current Breakdown</h4>
          <div className="h-48 flex items-center justify-center">
            {latestSentiment && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value: number) => `${value.toFixed(0)}%`}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {latestSentiment && (
            <div className="flex justify-center space-x-4 mt-2">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                <span className="text-gray-300 text-sm">Institutional ({latestSentiment.institutional_sentiment.toFixed(0)}%)</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                <span className="text-gray-300 text-sm">Retail ({latestSentiment.retail_sentiment.toFixed(0)}%)</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Signals Table */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <h4 className="text-white font-medium mb-4">Recent Signals</h4>
        <div className="space-y-3">
          {signals.slice(0, 6).map((signal) => (
            <div 
              key={signal.id} 
              className="flex items-center justify-between p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="text-blue-400">
                  {getSourceIcon(signal.source)}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="text-white text-sm font-medium">{signal.source.replace('_', ' ').toUpperCase()}</p>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSignalBg(signal.signal)}`}>
                      {signal.signal}
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs mt-1">{signal.description}</p>
                </div>
              </div>
              
              <div className="text-right">
                <div className="flex items-center space-x-2">
                  <span className={`text-sm font-medium ${getSignalColor(signal.signal)}`}>
                    {signal.strength}%
                  </span>
                  <span className={`text-xs ${getImpactColor(signal.impact)}`}>
                    {signal.impact.toUpperCase()}
                  </span>
                </div>
                <p className="text-gray-400 text-xs">{formatTime(signal.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default InstitutionalSentiment; 