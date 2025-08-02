import React, { useState, useEffect } from 'react';
import { MessageSquare, TrendingUp, Users, Heart, ThumbsUp, ThumbsDown, Eye, Calendar } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SentimentData {
  timestamp: number;
  positive: number;
  negative: number;
  neutral: number;
  score: number;
  volume: number;
}

interface SocialPost {
  id: string;
  platform: 'twitter' | 'reddit' | 'telegram';
  author: string;
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  engagement: number;
  timestamp: number;
  mentions: string[];
  influence: number;
}

interface TrendingTopic {
  keyword: string;
  mentions: number;
  sentiment: number;
  change24h: number;
  category: 'bullish' | 'bearish' | 'neutral';
}

interface InfluencerMetrics {
  name: string;
  platform: string;
  followers: number;
  engagement: number;
  sentiment: number;
  influence_score: number;
  recent_posts: number;
}

interface SocialSentimentAnalyzerProps {
  symbol?: string;
  className?: string;
}

const SocialSentimentAnalyzer: React.FC<SocialSentimentAnalyzerProps> = ({ 
  symbol = "BTCUSDT",
  className = "" 
}) => {
  const [sentimentHistory, setSentimentHistory] = useState<SentimentData[]>([]);
  const [recentPosts, setRecentPosts] = useState<SocialPost[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [influencers, setInfluencers] = useState<InfluencerMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [timeframe, setTimeframe] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [view, setView] = useState<'overview' | 'posts' | 'trends' | 'influencers'>('overview');

  const sentimentColors = {
    positive: '#10b981',
    negative: '#ef4444',
    neutral: '#6b7280'
  };

  const platformColors = {
    twitter: '#1da1f2',
    reddit: '#ff4500',
    telegram: '#0088cc'
  };

  useEffect(() => {
    const generateMockSocialData = () => {
      // Generate sentiment history
      const hours = timeframe === '1h' ? 1 : timeframe === '24h' ? 24 : timeframe === '7d' ? 168 : 720;
      const interval = timeframe === '1h' ? 3600000 : 3600000; // 1 hour intervals
      
      const mockSentimentHistory: SentimentData[] = [];
      for (let i = 0; i < hours; i++) {
        const timestamp = Date.now() - (hours - i) * interval;
        const baseScore = 0.6 + Math.sin((i / hours) * Math.PI * 4) * 0.2;
        const noise = (Math.random() - 0.5) * 0.1;
        const score = Math.max(0, Math.min(1, baseScore + noise));
        
        const positive = 40 + score * 40 + Math.random() * 10;
        const negative = 25 - score * 15 + Math.random() * 10;
        const neutral = 100 - positive - negative;
        
        mockSentimentHistory.push({
          timestamp,
          positive,
          negative,
          neutral,
          score,
          volume: Math.floor(1000 + Math.random() * 2000)
        });
      }

      // Generate recent posts
      const mockPosts: SocialPost[] = [
        {
          id: '1',
          platform: 'twitter',
          author: '@CryptoWhale_',
          content: `$${symbol.replace('USDT', '')} showing strong support at current levels. Looking for a breakout above $45k resistance. 🚀 #Bitcoin #Crypto`,
          sentiment: 'positive',
          engagement: 1250,
          timestamp: Date.now() - 1800000,
          mentions: ['Bitcoin', 'BTC'],
          influence: 8.5
        },
        {
          id: '2',
          platform: 'reddit',
          author: 'u/BitcoinMaximalist',
          content: 'Institutional adoption continues to accelerate. Major banks now offering crypto custody services.',
          sentiment: 'positive',
          engagement: 847,
          timestamp: Date.now() - 3600000,
          mentions: ['institutional', 'adoption'],
          influence: 7.2
        },
        {
          id: '3',
          platform: 'twitter',
          author: '@TradingGuru',
          content: 'Bearish divergence on the 4H chart. Expecting a pullback to $42k-43k range. Trade accordingly! ⚠️',
          sentiment: 'negative',
          engagement: 623,
          timestamp: Date.now() - 5400000,
          mentions: ['bearish', 'pullback'],
          influence: 6.8
        },
        {
          id: '4',
          platform: 'telegram',
          author: 'CryptoAnalyst_Pro',
          content: 'Fed meeting minutes released. No major surprises but market remains cautious.',
          sentiment: 'neutral',
          engagement: 412,
          timestamp: Date.now() - 7200000,
          mentions: ['Fed', 'market'],
          influence: 5.9
        },
        {
          id: '5',
          platform: 'reddit',
          author: 'u/DeFiDegen',
          content: 'New DeFi protocol launching with 200% APY. DYOR but looks promising!',
          sentiment: 'positive',
          engagement: 334,
          timestamp: Date.now() - 9000000,
          mentions: ['DeFi', 'APY'],
          influence: 4.7
        }
      ];

      // Generate trending topics
      const mockTrends: TrendingTopic[] = [
        {
          keyword: 'Bitcoin ETF',
          mentions: 15420,
          sentiment: 0.72,
          change24h: 45.2,
          category: 'bullish'
        },
        {
          keyword: 'Fed Rate',
          mentions: 8730,
          sentiment: 0.35,
          change24h: -12.8,
          category: 'bearish'
        },
        {
          keyword: 'DeFi Summer',
          mentions: 6250,
          sentiment: 0.68,
          change24h: 23.4,
          category: 'bullish'
        },
        {
          keyword: 'Regulation',
          mentions: 4890,
          sentiment: 0.42,
          change24h: -8.5,
          category: 'bearish'
        },
        {
          keyword: 'Institutional',
          mentions: 3670,
          sentiment: 0.65,
          change24h: 18.7,
          category: 'bullish'
        },
        {
          keyword: 'Whale Alert',
          mentions: 2840,
          sentiment: 0.58,
          change24h: 5.3,
          category: 'neutral'
        }
      ];

      // Generate influencer metrics
      const mockInfluencers: InfluencerMetrics[] = [
        {
          name: '@elonmusk',
          platform: 'Twitter',
          followers: 150000000,
          engagement: 8.5,
          sentiment: 0.65,
          influence_score: 9.8,
          recent_posts: 3
        },
        {
          name: '@saylor',
          platform: 'Twitter',
          followers: 3200000,
          engagement: 12.3,
          sentiment: 0.82,
          influence_score: 9.2,
          recent_posts: 8
        },
        {
          name: 'u/vbuterin',
          platform: 'Reddit',
          followers: 250000,
          engagement: 15.7,
          sentiment: 0.74,
          influence_score: 8.9,
          recent_posts: 2
        },
        {
          name: '@cz_binance',
          platform: 'Twitter',
          followers: 8500000,
          engagement: 6.8,
          sentiment: 0.71,
          influence_score: 8.7,
          recent_posts: 12
        },
        {
          name: '@APompliano',
          platform: 'Twitter',
          followers: 1800000,
          engagement: 9.4,
          sentiment: 0.69,
          influence_score: 8.5,
          recent_posts: 15
        }
      ];

      setSentimentHistory(mockSentimentHistory);
      setRecentPosts(mockPosts);
      setTrendingTopics(mockTrends);
      setInfluencers(mockInfluencers);
    };

    setLoading(true);
    setTimeout(() => {
      generateMockSocialData();
      setLoading(false);
    }, 1000);
  }, [symbol, timeframe]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getTimeAgo = (timestamp: number): string => {
    const diff = Date.now() - timestamp;
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  };

  const getSentimentColor = (sentiment: string): string => {
    return sentimentColors[sentiment as keyof typeof sentimentColors] || '#6b7280';
  };

  const getPlatformColor = (platform: string): string => {
    return platformColors[platform as keyof typeof platformColors] || '#6b7280';
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'bullish': return 'text-green-400 bg-green-900/30';
      case 'bearish': return 'text-red-400 bg-red-900/30';
      default: return 'text-gray-400 bg-gray-900/30';
    }
  };

  const currentSentiment = sentimentHistory[sentimentHistory.length - 1];

  if (loading) {
    return (
      <div className={`bg-gray-900 border border-gray-700 rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <MessageSquare className="w-5 h-5 mr-2 text-blue-400" />
            Social Sentiment Analyzer
          </h3>
        </div>
        <div className="animate-pulse">
          <div className="h-48 bg-gray-800 rounded-lg mb-4"></div>
          <div className="grid grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-800 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <MessageSquare className="w-5 h-5 mr-2 text-blue-400" />
          Social Sentiment Analyzer
          <span className="ml-2 text-sm text-gray-400">({symbol.replace('USDT', '')})</span>
        </h3>
        
        <div className="flex items-center space-x-3">
          <select
            value={view}
            onChange={(e) => setView(e.target.value as any)}
            className="bg-gray-800 text-white text-sm px-3 py-1 rounded border border-gray-600"
          >
            <option value="overview">Overview</option>
            <option value="posts">Recent Posts</option>
            <option value="trends">Trends</option>
            <option value="influencers">Influencers</option>
          </select>
          
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            className="bg-gray-800 text-white text-sm px-3 py-1 rounded border border-gray-600"
          >
            <option value="1h">1H</option>
            <option value="24h">24H</option>
            <option value="7d">7D</option>
            <option value="30d">30D</option>
          </select>
        </div>
      </div>

      {/* Sentiment Overview */}
      {currentSentiment && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Sentiment Score</p>
                <p className={`text-lg font-semibold ${currentSentiment.score > 0.6 ? 'text-green-400' : currentSentiment.score < 0.4 ? 'text-red-400' : 'text-yellow-400'}`}>
                  {(currentSentiment.score * 100).toFixed(1)}%
                </p>
              </div>
              <Heart className={`w-5 h-5 ${currentSentiment.score > 0.6 ? 'text-green-400' : currentSentiment.score < 0.4 ? 'text-red-400' : 'text-yellow-400'}`} />
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Social Volume</p>
                <p className="text-white text-lg font-semibold">{formatNumber(currentSentiment.volume)}</p>
              </div>
              <Users className="w-5 h-5 text-blue-400" />
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Positive</p>
                <p className="text-green-400 text-lg font-semibold">{currentSentiment.positive.toFixed(1)}%</p>
              </div>
              <ThumbsUp className="w-5 h-5 text-green-400" />
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Negative</p>
                <p className="text-red-400 text-lg font-semibold">{currentSentiment.negative.toFixed(1)}%</p>
              </div>
              <ThumbsDown className="w-5 h-5 text-red-400" />
            </div>
          </div>
        </div>
      )}

      {view === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sentiment Timeline */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2 text-green-400" />
              Sentiment Timeline
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sentimentHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#6b7280"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis stroke="#6b7280" domain={[0, 1]} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                    formatter={(value: number) => [`${(value * 100).toFixed(1)}%`, 'Sentiment Score']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sentiment Distribution */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4">Sentiment Distribution</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Positive', value: currentSentiment?.positive || 0, fill: '#10b981' },
                      { name: 'Negative', value: currentSentiment?.negative || 0, fill: '#ef4444' },
                      { name: 'Neutral', value: currentSentiment?.neutral || 0, fill: '#6b7280' }
                    ]}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value.toFixed(1)}%`}
                  >
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {view === 'posts' && (
        <div className="bg-gray-800 p-4 rounded-lg">
          <h4 className="text-white font-medium mb-4 flex items-center">
            <Eye className="w-4 h-4 mr-2 text-purple-400" />
            Recent Social Posts
          </h4>
          
          <div className="space-y-4">
            {recentPosts.map((post) => (
              <div key={post.id} className="p-4 bg-gray-700 rounded-lg border border-gray-600">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: getPlatformColor(post.platform) }}
                    ></div>
                    <div>
                      <span className="text-white font-medium">{post.author}</span>
                      <span className="text-gray-400 text-sm ml-2">{post.platform}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      post.sentiment === 'positive' ? 'bg-green-900/30 text-green-400' :
                      post.sentiment === 'negative' ? 'bg-red-900/30 text-red-400' :
                      'bg-gray-900/30 text-gray-400'
                    }`}>
                      {post.sentiment}
                    </span>
                    <span className="text-gray-400 text-sm">{getTimeAgo(post.timestamp)}</span>
                  </div>
                </div>
                
                <p className="text-gray-300 text-sm mb-3 leading-relaxed">{post.content}</p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <span className="text-blue-400 text-sm">{formatNumber(post.engagement)} interactions</span>
                    <span className="text-yellow-400 text-sm">Influence: {post.influence.toFixed(1)}/10</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-1">
                    {post.mentions.map((mention, index) => (
                      <span key={index} className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded text-xs">
                        #{mention}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'trends' && (
        <div className="space-y-6">
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4">Trending Keywords</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trendingTopics.map((topic, index) => (
                <div key={topic.keyword} className="p-4 bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-white font-medium">{topic.keyword}</h5>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getCategoryColor(topic.category)}`}>
                      {topic.category}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Mentions</span>
                      <span className="text-white text-sm">{formatNumber(topic.mentions)}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Sentiment</span>
                      <span className={`text-sm font-medium ${topic.sentiment > 0.6 ? 'text-green-400' : topic.sentiment < 0.4 ? 'text-red-400' : 'text-yellow-400'}`}>
                        {(topic.sentiment * 100).toFixed(0)}%
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">24h Change</span>
                      <span className={`text-sm font-medium ${topic.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {topic.change24h >= 0 ? '+' : ''}{topic.change24h.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trending Chart */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4">Mention Volume Comparison</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendingTopics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="keyword" 
                    stroke="#6b7280"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis stroke="#6b7280" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value: number) => [formatNumber(value), 'Mentions']}
                  />
                  <Bar dataKey="mentions" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {view === 'influencers' && (
        <div className="bg-gray-800 p-4 rounded-lg">
          <h4 className="text-white font-medium mb-4 flex items-center">
            <Users className="w-4 h-4 mr-2 text-orange-400" />
            Top Crypto Influencers
          </h4>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Influencer</th>
                  <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Platform</th>
                  <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Followers</th>
                  <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Engagement</th>
                  <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Sentiment</th>
                  <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Influence</th>
                  <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Posts (24h)</th>
                </tr>
              </thead>
              <tbody>
                {influencers.map((influencer, index) => (
                  <tr key={influencer.name} className="border-b border-gray-700 hover:bg-gray-700 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400 text-sm">#{index + 1}</span>
                        <span className="text-white font-medium">{influencer.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span 
                        className="text-sm font-medium"
                        style={{ color: getPlatformColor(influencer.platform.toLowerCase()) }}
                      >
                        {influencer.platform}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white text-sm">{formatNumber(influencer.followers)}</td>
                    <td className="py-3 px-4 text-blue-400 text-sm">{influencer.engagement.toFixed(1)}%</td>
                    <td className="py-3 px-4">
                      <span className={`text-sm font-medium ${influencer.sentiment > 0.6 ? 'text-green-400' : influencer.sentiment < 0.4 ? 'text-red-400' : 'text-yellow-400'}`}>
                        {(influencer.sentiment * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-orange-400 text-sm font-medium">{influencer.influence_score.toFixed(1)}/10</span>
                        <div className="w-16 bg-gray-600 rounded-full h-2">
                          <div 
                            className="bg-orange-400 h-2 rounded-full" 
                            style={{ width: `${(influencer.influence_score / 10) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-white text-sm">{influencer.recent_posts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SocialSentimentAnalyzer;