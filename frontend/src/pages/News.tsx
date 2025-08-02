import React, { useState, useEffect } from 'react';
import { Newspaper, Clock, ExternalLink, TrendingUp, TrendingDown, Filter, RefreshCw } from 'lucide-react';
import { apiConfig } from '../apiConfig';
import CryptoNewsSlider from '../components/CryptoNewsSlider';

interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  image?: string;
  published_at: string;
  source: string;
  category?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export default function News() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSentiment, setSelectedSentiment] = useState<string>('all');

  const categories = ['all', 'bitcoin', 'ethereum', 'defi', 'nft', 'regulation', 'adoption'];
  const sentiments = ['all', 'positive', 'negative', 'neutral'];

  const fetchNews = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${apiConfig.REST_API_SERVICE}/api/news?limit=50`);
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('News data:', data);
      
      // Map API response to component format
      const formattedNews = data.articles?.map((article: any, index: number) => ({
        id: `news-${index}`,
        title: article.title || 'No title',
        description: article.description || article.summary || 'No description available',
        url: article.url || '#',
        image: article.image || article.urlToImage,
        published_at: article.published_at || article.publishedAt || new Date().toISOString(),
        source: article.source || 'Unknown',
        category: article.category || 'general',
        sentiment: article.sentiment || 'neutral'
      })) || [];
      
      setNews(formattedNews);
    } catch (error) {
      console.error('Error fetching news:', error);
      setError('Failed to load news');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
    
    // Refresh every 10 minutes
    const interval = setInterval(fetchNews, 600000);
    return () => clearInterval(interval);
  }, []);

  const filteredNews = news.filter(article => {
    const categoryMatch = selectedCategory === 'all' || article.category === selectedCategory;
    const sentimentMatch = selectedSentiment === 'all' || article.sentiment === selectedSentiment;
    return categoryMatch && sentimentMatch;
  });

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
    switch (sentiment) {
      case 'positive': return 'text-green-400';
      case 'negative': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return <TrendingUp className="h-3 w-3" />;
      case 'negative': return <TrendingDown className="h-3 w-3" />;
      default: return <Newspaper className="h-3 w-3" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Crypto News</h1>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-900 rounded-lg p-6 animate-pulse">
              <div className="h-4 bg-gray-700 rounded mb-4"></div>
              <div className="h-3 bg-gray-700 rounded mb-2"></div>
              <div className="h-3 bg-gray-700 rounded mb-2"></div>
              <div className="h-3 bg-gray-700 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white">Crypto News</h1>
          <button 
            onClick={fetchNews}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Retry</span>
          </button>
        </div>
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-6 text-center">
          <p className="text-red-400 text-lg">{error}</p>
          <p className="text-gray-400 text-sm mt-2">Please check your connection and try again</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Crypto News</h1>
          <p className="text-gray-400">Stay updated with the latest cryptocurrency news and market insights</p>
        </div>
        <button 
          onClick={fetchNews}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* News Slider Component */}
      <CryptoNewsSlider maxArticles={6} />

      {/* Filters */}
      <div className="flex items-center space-x-4 p-4 bg-gray-800/30 rounded-lg">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-400">Filters:</span>
        </div>
        
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-gray-700 text-white text-sm rounded px-3 py-1"
        >
          {categories.map(category => (
            <option key={category} value={category}>
              {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={selectedSentiment}
          onChange={(e) => setSelectedSentiment(e.target.value)}
          className="bg-gray-700 text-white text-sm rounded px-3 py-1"
        >
          {sentiments.map(sentiment => (
            <option key={sentiment} value={sentiment}>
              {sentiment === 'all' ? 'All Sentiment' : sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
            </option>
          ))}
        </select>
        
        <div className="ml-auto text-sm text-gray-400">
          {filteredNews.length} articles
        </div>
      </div>

      {/* News Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNews.map((article) => (
          <div key={article.id} className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors">
            {/* Article Image */}
            {article.image && (
              <div className="h-48 bg-gray-800 overflow-hidden">
                <img
                  src={article.image}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}
            
            {/* Article Content */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                  {article.source}
                </span>
                <div className={`flex items-center space-x-1 ${getSentimentColor(article.sentiment || 'neutral')}`}>
                  {getSentimentIcon(article.sentiment || 'neutral')}
                  <span className="text-xs capitalize">{article.sentiment}</span>
                </div>
              </div>
              
              <h3 className="text-white font-semibold text-lg mb-3 line-clamp-2">
                {article.title}
              </h3>
              
              <p className="text-gray-400 text-sm mb-4 line-clamp-3">
                {article.description}
              </p>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-gray-500 text-xs">
                  <Clock className="h-3 w-3" />
                  <span>{formatTimeAgo(article.published_at)}</span>
                </div>
                
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-blue-400 hover:text-blue-300 text-sm transition-colors"
                >
                  <span>Read more</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredNews.length === 0 && (
        <div className="text-center py-12">
          <Newspaper className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No news articles found matching your filters</p>
          <p className="text-gray-500 text-sm mt-2">Try adjusting your filter settings</p>
        </div>
      )}
    </div>
  );
}