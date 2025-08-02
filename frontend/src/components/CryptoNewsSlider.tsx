import React, { useEffect, useState, useRef } from 'react';
import { Clock, ExternalLink, TrendingUp, TrendingDown, Newspaper, RefreshCw } from 'lucide-react';
import { apiConfig } from '../apiConfig';

interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  image: string;
  published_at: string;
  source: string;
  category: string;
  sentiment: string;
}

interface CryptoNewsSliderProps {
  autoplay?: boolean;
  interval?: number;
  showControls?: boolean;
  maxArticles?: number;
}

const CryptoNewsSlider: React.FC<CryptoNewsSliderProps> = ({
  autoplay = true,
  interval = 5000,
  showControls = true,
  maxArticles = 6
}) => {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNews = async () => {
    try {
      setError(null);
      setRefreshing(true);
      const response = await fetch(`${apiConfig.REST_API_SERVICE}/api/news`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('News data:', data);
      
      // Map API response to component format
      const formattedNews = data.articles?.map((article: any, index: number) => ({
        id: `news-${index}`,
        title: article.title || 'No title',
        description: article.description || article.summary || 'No description available',
        url: article.url || '#',
        image: article.image || '',
        published_at: article.published_at || article.publishedAt || new Date().toISOString(),
        source: article.source || 'Unknown',
        category: article.category || 'general',
        sentiment: article.sentiment || 'neutral'
      })) || [];
      
      setNews(formattedNews);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch crypto news:', err);
      // This error handling is already fixed in the API integration above
      setLoading(false);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNews();
    // Refresh news every 30 seconds for faster updates
    const refreshInterval = setInterval(fetchNews, 30000);
    return () => clearInterval(refreshInterval);
  }, [maxArticles]);

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const published = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - published.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const getSentimentColor = (sentiment: string): string => {
    switch (sentiment.toLowerCase()) {
      case 'positive': return 'text-green-400';
      case 'negative': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case 'positive': return <TrendingUp className="h-3 w-3" />;
      case 'negative': return <TrendingDown className="h-3 w-3" />;
      default: return <Newspaper className="h-3 w-3" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-lg font-bold text-white flex items-center">
            <Newspaper className="h-5 w-5 text-blue-400 mr-2" />
            Latest Crypto News
          </h3>
        </div>
        <div className="p-4">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border-b border-gray-700 pb-3">
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-full mb-1"></div>
                <div className="h-3 bg-gray-700 rounded w-2/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || news.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center">
              <Newspaper className="h-5 w-5 text-blue-400 mr-2" />
              Latest Crypto News
            </h3>
            <button 
              onClick={fetchNews}
              disabled={refreshing}
              className="text-blue-400 hover:text-blue-300 text-sm flex items-center space-x-1 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Retry</span>
            </button>
          </div>
        </div>
        <div className="p-4">
          <div className="text-red-400 text-center py-6">
            <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{error || 'No news available'}</p>
            <p className="text-xs text-gray-500 mt-1">
              Check your internet connection or try again later
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700">
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center">
            <Newspaper className="h-5 w-5 text-blue-400 mr-2" />
            Latest Crypto News
            <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded-full">
              {news.length} articles
            </span>
          </h3>
          <button 
            onClick={fetchNews}
            disabled={refreshing}
            className="text-gray-400 hover:text-white text-sm disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      <div className="p-4">
        {news.length > 0 ? (
          <div className="space-y-3">
            {news.slice(0, 4).map((article, index) => (
              <div key={article.id} className="group">
                <div className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-800 transition-colors">
                  {/* Article Image or Placeholder */}
                  <div className="flex-shrink-0">
                    {article.image ? (
                      <img
                        src={article.image}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                        <Newspaper className="h-6 w-6 text-gray-500" />
                      </div>
                    )}
                  </div>
                  
                  {/* Article Content */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-medium text-sm line-clamp-2 group-hover:text-blue-400 transition-colors">
                      {article.title}
                    </h4>
                    <p className="text-gray-400 text-xs mt-1 line-clamp-2">
                      {article.description}
                    </p>
                    
                    {/* Article Meta */}
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-blue-400 text-xs font-medium">
                          {article.source}
                        </span>
                        <div className={`flex items-center space-x-1 ${getSentimentColor(article.sentiment)}`}>
                          {getSentimentIcon(article.sentiment)}
                          <span className="text-xs capitalize">{article.sentiment}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-500 text-xs flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {formatTimeAgo(article.published_at)}
                        </span>
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-blue-400 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Divider */}
                {index < Math.min(news.length, 4) - 1 && (
                  <div className="border-b border-gray-700 my-1"></div>
                )}
              </div>
            ))}
            
            {/* View More Link */}
            {news.length > 4 && (
              <div className="text-center pt-2">
                <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
                  View {news.length - 4} more articles
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-400 text-center py-8">
            <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No news available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CryptoNewsSlider;