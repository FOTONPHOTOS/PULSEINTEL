import React, { useState, useEffect } from 'react';
import { Newspaper, ExternalLink, Clock, TrendingUp, Filter, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { apiConfig } from '../apiConfig';

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: 'high' | 'medium' | 'low';
  category: string;
}

const ProfessionalNewsTracker: React.FC = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'high' | 'breaking'>('all');
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected'>('disconnected');

  // Enhanced data processing and state update logic
  const processAndSetNews = (articles: any[]) => {
    const enhancedNews = articles.map((item: any) => ({
      id: item.id || item.url || `news-${Math.random()}`,
      headline: item.title || item.headline || '',
      summary: item.description?.substring(0, 120) + '...' || '',
      source: item.source || 'Unknown',
      publishedAt: item.published_at || new Date().toISOString(),
      url: item.url || '#',
      sentiment: determineSentiment(item.title || ''),
      impact: determineImpact(item.title || ''),
      category: determineCategory(item.title || '')
    }));
    setNews(enhancedNews);
    setLoading(false);
  };
  
  // WebSocket connection logic
  useEffect(() => {
    // Fetch initial data via REST to populate the feed quickly
    const fetchInitialNews = async () => {
      try {
        const response = await fetch(`${apiConfig.REST_API_SERVICE}/api/news`);
        if (response.ok) {
          const data = await response.json();
          if (data.articles) {
            processAndSetNews(data.articles);
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial news:', error);
        setLoading(false);
      }
    };

    fetchInitialNews();

    // Establish WebSocket connection
    const wsUrl = `${apiConfig.WEBSOCKET_SERVICE.replace(/^http/, 'ws')}/ws/news`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('📰 News WebSocket connected');
      setWsStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'news_update' && message.data) {
          console.log('📰 Received real-time news update');
          processAndSetNews(message.data);
        }
      } catch (error) {
        console.error('Error processing news message:', error);
      }
    };

    ws.onclose = () => {
      console.log('📰 News WebSocket disconnected');
      setWsStatus('disconnected');
    };

    ws.onerror = (error) => {
      console.error('News WebSocket error:', error);
      setWsStatus('disconnected');
    };

    // Cleanup on unmount
    return () => {
      ws.close();
    };
  }, []);


  const determineSentiment = (headline: string): 'positive' | 'negative' | 'neutral' => {
    const positiveWords = ['surge', 'rally', 'bull', 'gain', 'rise', 'breakthrough', 'adoption', 'institutional'];
    const negativeWords = ['crash', 'fall', 'bear', 'drop', 'decline', 'hack', 'fraud', 'regulation'];
    
    const lowerHeadline = headline.toLowerCase();
    if (positiveWords.some(word => lowerHeadline.includes(word))) return 'positive';
    if (negativeWords.some(word => lowerHeadline.includes(word))) return 'negative';
    return 'neutral';
  };

  const determineImpact = (headline: string): 'high' | 'medium' | 'low' => {
    const highImpactWords = ['bitcoin', 'ethereum', 'federal', 'sec', 'trillion', 'institutional', 'etf'];
    const mediumImpactWords = ['altcoin', 'defi', 'nft', 'regulation', 'adoption'];
    
    const lowerHeadline = headline.toLowerCase();
    if (highImpactWords.some(word => lowerHeadline.includes(word))) return 'high';
    if (mediumImpactWords.some(word => lowerHeadline.includes(word))) return 'medium';
    return 'low';
  };

  const determineCategory = (headline: string): string => {
    const categories = {
      'Bitcoin': ['bitcoin', 'btc'],
      'Ethereum': ['ethereum', 'eth'],
      'DeFi': ['defi', 'uniswap', 'dex'],
      'Regulation': ['sec', 'regulation', 'government'],
      'Institutional': ['institutional', 'etf', 'corporation'],
      'Technology': ['blockchain', 'protocol', 'upgrade']
    };

    const lowerHeadline = headline.toLowerCase();
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => lowerHeadline.includes(keyword))) {
        return category;
      }
    }
    return 'General';
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'negative': return 'text-red-400 bg-red-500/10 border-red-500/20';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  const filteredNews = news.filter(item => {
    if (filter === 'high') return item.impact === 'high';
    if (filter === 'breaking') return new Date(item.publishedAt).getTime() > Date.now() - 3600000; // Last hour
    return true;
  });

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMinutes > 0) return `${diffMinutes}m ago`;
    return 'Just now';
  };

  if (loading) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/3"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-slate-700 rounded w-3/4"></div>
              <div className="h-3 bg-slate-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center">
            <Newspaper className="h-5 w-5 text-blue-400 mr-2" />
            Market Intelligence Feed
          </h3>
          <p className="text-slate-400 text-sm mt-1">Real-time crypto news with institutional analysis</p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Filter Dropdown */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="bg-slate-800/80 text-white px-3 py-1 rounded-lg border border-slate-600/50 text-sm"
          >
            <option value="all">All News</option>
            <option value="high">High Impact</option>
            <option value="breaking">Breaking</option>
          </select>
        </div>
      </div>

      {/* News Feed */}
      <div className="space-y-4 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
        {filteredNews.map((item) => (
          <div
            key={item.id}
            className="bg-slate-800/50 border border-slate-700/30 rounded-lg p-4 hover:bg-slate-800/70 transition-all group"
          >
            {/* News Header */}
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2 flex-1">
                <span className={`px-2 py-1 rounded text-xs font-medium border ${getSentimentColor(item.sentiment || 'neutral')}`}>
                  {item.sentiment?.toUpperCase()}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium border ${getImpactColor(item.impact || 'low')}`}>
                  {item.impact?.toUpperCase()}
                </span>
                <span className="px-2 py-1 rounded text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600/30">
                  {item.category}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-slate-400 text-xs">
                <Clock className="h-3 w-3" />
                <span>{formatTime(item.publishedAt)}</span>
              </div>
            </div>

            {/* News Content */}
            <div className="mb-3">
              <h4 className="text-white font-semibold text-sm leading-tight mb-1 line-clamp-2">
                {item.headline}
              </h4>
              {item.summary && (
                <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">
                  {item.summary}
                </p>
              )}
            </div>

            {/* News Footer */}
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-xs font-medium">
                {item.source}
              </span>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-xs opacity-0 group-hover:opacity-100 transition-all"
              >
                <span>Read More</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Stats */}
      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{filteredNews.length} articles displayed</span>
          <div className="flex items-center space-x-4">
            <span className={`flex items-center space-x-1 ${wsStatus === 'connected' ? 'text-green-400' : 'text-red-400'}`}>
              {wsStatus === 'connected' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              <span>{wsStatus === 'connected' ? 'Live Feed' : 'Disconnected'}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfessionalNewsTracker;
