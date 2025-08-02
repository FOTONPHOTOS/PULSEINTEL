import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, BarChart3, Zap, Globe, AlertCircle } from 'lucide-react';
import { apiConfig } from '../apiConfig';
import { subscribeToTrades, subscribeToVWAP, subscribeToCVD } from '../services/WebSocketService';

// (MetricCard component remains the same...)

interface RealTimeMetricsGridProps {
  selectedAsset: string;
}

const RealTimeMetricsGrid: React.FC<RealTimeMetricsGridProps> = ({ selectedAsset }) => {
  const [metrics, setMetrics] = useState<any>({
    price: 0,
    change24h: 0,
    volume24h: 0,
    vwap: 0,
    cvd: 0,
    globalMarketCap: 0,
    globalVolume: 0,
    fearGreedIndex: 50
  });
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);

  // Subscribe to real-time WebSocket data
  useEffect(() => {
    console.log(`🔌 RealTimeMetricsGrid: Subscribing to ${selectedAsset} data`);
    
    // Subscribe to trades for price updates
    const unsubscribeTrades = subscribeToTrades(selectedAsset, (data) => {
      console.log('📊 Trade data received:', data);
      setMetrics((prev: any) => ({
        ...prev,
        price: parseFloat(data.price) || prev.price,
        volume24h: data.volume_24h || prev.volume24h,
        change24h: data.change_24h || prev.change24h
      }));
      setLastUpdate(new Date());
      setLoading(false);
    });

    // Subscribe to VWAP data
    const unsubscribeVWAP = subscribeToVWAP(selectedAsset, (data) => {
      console.log('📈 VWAP data received:', data);
      setMetrics((prev: any) => ({
        ...prev,
        vwap: data.vwap || prev.vwap
      }));
      setLastUpdate(new Date());
    });

    // Subscribe to CVD data
    const unsubscribeCVD = subscribeToCVD(selectedAsset, (data) => {
      console.log('📊 CVD data received:', data);
      setMetrics((prev: any) => ({
        ...prev,
        cvd: data.cvd || prev.cvd
      }));
      setLastUpdate(new Date());
    });

    // Cleanup subscriptions on unmount or asset change
    return () => {
      unsubscribeTrades();
      unsubscribeVWAP();
      unsubscribeCVD();
    };
  }, [selectedAsset]);

  // Fetch real-time global market data from CoinGecko
  useEffect(() => {
    const fetchGlobalMarketData = async () => {
      try {
        // Fetch global market data from CoinGecko
        const globalResponse = await fetch('https://api.coingecko.com/api/v3/global');
        const globalData = await globalResponse.json();
        
        console.log('✅ CoinGecko global market data:', globalData);

        if (globalData.data) {
          setMetrics((prevMetrics: any) => ({
            ...prevMetrics,
            globalMarketCap: globalData.data.total_market_cap.usd || 0,
            globalVolume: globalData.data.total_volume.usd || 0,
            fearGreedIndex: 50 // Default neutral value
          }));
        }

        // Also fetch our local market overview for additional data
        try {
          const overviewResponse = await fetch(`${apiConfig.REST_API_SERVICE}/api/market-overview`);
          const overviewData = await overviewResponse.json();
          
          console.log('📊 Local market overview data:', overviewData);

          setMetrics((prevMetrics: any) => ({
            ...prevMetrics,
            // Keep CoinGecko data as primary, use local as fallback
            globalMarketCap: prevMetrics.globalMarketCap || overviewData.total_market_cap_usd || 0,
            globalVolume: prevMetrics.globalVolume || overviewData.total_volume_usd || 0
          }));
        } catch (localError) {
          console.warn('⚠️ Local API unavailable, using CoinGecko data only');
        }

      } catch (error) {
        console.error('❌ Failed to fetch global market data:', error);
        // Fallback to local API if CoinGecko fails
        try {
          const overviewResponse = await fetch(`${apiConfig.REST_API_SERVICE}/api/market-overview`);
          const overviewData = await overviewResponse.json();
          
          setMetrics((prevMetrics: any) => ({
            ...prevMetrics,
            globalMarketCap: overviewData.total_market_cap_usd || 0,
            globalVolume: overviewData.total_volume_usd || 0,
            fearGreedIndex: 50
          }));
        } catch (fallbackError) {
          console.error('❌ Both CoinGecko and local API failed:', fallbackError);
        }
      }
    };

    fetchGlobalMarketData();
    
    // Refresh every 5 minutes for updated market cap data
    const interval = setInterval(fetchGlobalMarketData, 300000);
    return () => clearInterval(interval);
  }, []);




  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-slate-800/50 rounded-xl p-6 animate-pulse">
            <div className="h-12 w-12 bg-slate-700 rounded-lg mb-4"></div>
            <div className="h-4 bg-slate-700 rounded mb-2"></div>
            <div className="h-6 bg-slate-700 rounded mb-1"></div>
            <div className="h-3 bg-slate-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  const formatPrice = (price: number) => {
    if (price >= 100000) return `$${(price / 1000).toFixed(0)}K`;
    if (price >= 1000) return `$${(price / 1000).toFixed(1)}K`;
    return `$${price.toFixed(2)}`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(1)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(0)}M`;
    return `$${volume.toLocaleString()}`;
  };

  const formatMarketCap = (cap: number) => {
    if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(1)}B`;
    return `$${(cap / 1e6).toFixed(0)}M`;
  };

  return (
    <div className="space-y-4">
      {/* Update Timestamp */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center">
          <Zap className="h-6 w-6 text-yellow-400 mr-2" />
          Real-Time Market Intelligence
        </h2>
        <div className="flex items-center space-x-2 text-slate-400 text-sm">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span>Last updated: {lastUpdate.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Real Data Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6 grid-responsive">
        {/* Global Market Cap */}
        <div className="bg-slate-800/50 rounded-xl p-4 lg:p-6 border border-slate-700/30 metric-card">
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <Globe className="h-5 w-5 lg:h-6 lg:w-6 text-blue-400" />
            <span className="text-xs text-slate-400">Live</span>
          </div>
          <h3 className="text-slate-400 text-xs lg:text-sm mb-1 text-container">Global Market Cap</h3>
          <p className="text-white text-lg lg:text-xl font-bold text-container">${formatMarketCap(metrics.globalMarketCap)}</p>
          <p className="text-slate-500 text-xs text-container">Total Crypto Market</p>
        </div>

        {/* Global Volume */}
        <div className="bg-slate-800/50 rounded-xl p-4 lg:p-6 border border-slate-700/30 metric-card">
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <BarChart3 className="h-5 w-5 lg:h-6 lg:w-6 text-green-400" />
            <span className="text-xs text-slate-400">Live</span>
          </div>
          <h3 className="text-slate-400 text-xs lg:text-sm mb-1 text-container">24h Volume</h3>
          <p className="text-white text-lg lg:text-xl font-bold text-container">${formatVolume(metrics.globalVolume)}</p>
          <p className="text-slate-500 text-xs text-container">All Exchanges</p>
        </div>

        {/* Asset Price */}
        <div className="bg-slate-800/50 rounded-xl p-4 lg:p-6 border border-slate-700/30 metric-card">
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <DollarSign className="h-5 w-5 lg:h-6 lg:w-6 text-yellow-400" />
            <span className="text-xs text-green-400">Live</span>
          </div>
          <h3 className="text-slate-400 text-xs lg:text-sm mb-1 text-container">{selectedAsset.replace('USDT', '')} Price</h3>
          <p className="text-white text-lg lg:text-xl font-bold text-container">${formatPrice(metrics.price)}</p>
          <p className={`text-xs text-container ${metrics.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {metrics.change24h >= 0 ? '+' : ''}{metrics.change24h.toFixed(2)}%
          </p>
        </div>

        {/* VWAP */}
        <div className="bg-slate-800/50 rounded-xl p-4 lg:p-6 border border-slate-700/30 metric-card">
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <Activity className="h-5 w-5 lg:h-6 lg:w-6 text-purple-400" />
            <span className="text-xs text-green-400">Live</span>
          </div>
          <h3 className="text-slate-400 text-xs lg:text-sm mb-1 text-container">VWAP</h3>
          <p className="text-white text-lg lg:text-xl font-bold text-container">${formatPrice(metrics.vwap)}</p>
          <p className="text-slate-500 text-xs text-container">Volume Weighted</p>
        </div>

        {/* CVD */}
        <div className="bg-slate-800/50 rounded-xl p-4 lg:p-6 border border-slate-700/30 metric-card">
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <TrendingUp className="h-5 w-5 lg:h-6 lg:w-6 text-orange-400" />
            <span className="text-xs text-green-400">Live</span>
          </div>
          <h3 className="text-slate-400 text-xs lg:text-sm mb-1 text-container">CVD</h3>
          <p className="text-white text-lg lg:text-xl font-bold text-container">{metrics.cvd > 0 ? '+' : ''}{metrics.cvd.toFixed(0)}</p>
          <p className="text-slate-500 text-xs text-container">Cumulative Volume Delta</p>
        </div>

        {/* Fear & Greed Index */}
        <div className="bg-slate-800/50 rounded-xl p-4 lg:p-6 border border-slate-700/30 metric-card">
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <AlertCircle className="h-5 w-5 lg:h-6 lg:w-6 text-pink-400" />
            <span className="text-xs text-slate-400">Market</span>
          </div>
          <h3 className="text-slate-400 text-xs lg:text-sm mb-1 text-container">Fear & Greed</h3>
          <p className="text-white text-lg lg:text-xl font-bold text-container">{metrics.fearGreedIndex}</p>
          <p className="text-slate-500 text-xs text-container">
            {metrics.fearGreedIndex >= 75 ? 'Extreme Greed' : 
             metrics.fearGreedIndex >= 55 ? 'Greed' : 
             metrics.fearGreedIndex >= 45 ? 'Neutral' : 
             metrics.fearGreedIndex >= 25 ? 'Fear' : 'Extreme Fear'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RealTimeMetricsGrid; 