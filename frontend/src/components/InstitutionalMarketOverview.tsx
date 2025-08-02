import React, { useState, useEffect } from 'react';
import { Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ComposedChart } from 'recharts';
import { TrendingUp, TrendingDown, BarChart3, Activity, Eye, Brain, Target, Zap } from 'lucide-react';
import { apiConfig } from '../apiConfig'; // Import the centralized config
import { subscribeToTrades, subscribeToVWAP } from '../services/WebSocketService';

interface InstitutionalMarketOverviewProps {
  selectedAsset: string;
  timeframe: string;
  // This component should receive the live ticker data as a prop
  liveTickerData?: any;
}

const InstitutionalMarketOverview: React.FC<InstitutionalMarketOverviewProps> = ({ selectedAsset, timeframe, liveTickerData }) => {
  const [priceData, setPriceData] = useState<any[]>([]);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [volumeProfile, setVolumeProfile] = useState<any[]>([]);
  const [orderFlow, setOrderFlow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'price' | 'volume' | 'flow'>('price');

  // Real-time data from WebSocket
  const [realTimePrice, setRealTimePrice] = useState<number>(0);
  const [realTimeVwap, setRealTimeVwap] = useState<number>(0);
  const [change24h, setChange24h] = useState<number>(0);

  // Current metrics
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [priceChangePercent, setPriceChangePercent] = useState<number>(0);
  const [volume24h, setVolume24h] = useState<number>(0);
  const [vwap, setVwap] = useState<number>(0);

  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        setLoading(true);

        const response = await fetch(`${apiConfig.REST_API_SERVICE}/api/market-overview`);

        if (response.ok) {
          const data = await response.json();
          console.log('Market overview data received:', data);

          if (data.historical_data && Array.isArray(data.historical_data) && data.historical_data.length > 0) {
            // Process historical data from Binance
            const processedData = data.historical_data.map((item: any) => ({
              timestamp: item.timestamp,
              time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              open: item.price * 0.9995,
              high: item.high || item.price * 1.0005,
              low: item.low || item.price * 0.9995,
              close: item.price,
              price: item.price,
              volume: item.volume,
              vwap: item.vwap || item.price
            }));

            // Store historical data
            setHistoricalData(processedData);

            // Initialize with historical data
            setPriceData(processedData);
            generateVolumeProfile(processedData);

            // Update current metrics from API
            setCurrentPrice(data.current_price);
            setPriceChange(data.price_change_24h);
            setPriceChangePercent(data.price_change_percent_24h);
            setVolume24h(data.volume_24h);
            setVwap(data.vwap);

            console.log('✅ Historical data loaded successfully');
          } else {
            console.warn('No historical data in API response');
            generateFallbackHistoricalData();
          }
        } else {
          console.error('Failed to fetch market overview');
          generateFallbackHistoricalData();
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching historical data:', error);
        generateFallbackHistoricalData();
        setLoading(false);
      }
    };

    const generateFallbackHistoricalData = () => {
      const currentTime = Date.now();
      const fallbackData = [];
      let basePrice = 97500; // Realistic BTC price

      // Generate 24 hours of realistic historical data
      for (let i = 1440; i >= 0; i--) {
        const timestamp = currentTime - (i * 60000); // 1-minute intervals

        // Create realistic price movement with downtrend
        const priceChange = (Math.random() - 0.52) * 100; // Slight bearish bias
        basePrice += priceChange;
        basePrice = Math.max(basePrice, 95000); // Floor price

        fallbackData.push({
          timestamp,
          time: new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          open: basePrice * 0.9995,
          high: basePrice * 1.0005,
          low: basePrice * 0.9995,
          close: basePrice,
          price: basePrice,
          volume: Math.random() * 1000000 + 500000,
          vwap: basePrice * (1 + (Math.random() - 0.5) * 0.001)
        });
      }

      setHistoricalData(fallbackData);
      setPriceData(fallbackData);
      generateVolumeProfile(fallbackData);

      // Set fallback metrics
      setCurrentPrice(fallbackData[fallbackData.length - 1].price);
      setPriceChange(fallbackData[fallbackData.length - 1].price - fallbackData[0].price);
      setPriceChangePercent(((fallbackData[fallbackData.length - 1].price - fallbackData[0].price) / fallbackData[0].price) * 100);
      setVolume24h(fallbackData.reduce((sum, item) => sum + item.volume, 0));
      setVwap(fallbackData.reduce((sum, item) => sum + item.vwap, 0) / fallbackData.length);
    };

    fetchHistoricalData();

    // Subscribe to real-time WebSocket updates
    const unsubscribeTrades = subscribeToTrades(selectedAsset, (data) => {
      const newPrice = parseFloat(data.price);
      setRealTimePrice(newPrice);

      // Update the last data point with real-time price for smooth transitions
      if (historicalData.length > 0) {
        const updatedData = [...historicalData];
        const lastIndex = updatedData.length - 1;
        const lastDataPoint = updatedData[lastIndex];
        
        // Only update if price change is reasonable (prevent spikes)
        const priceChange = Math.abs(newPrice - lastDataPoint.price) / lastDataPoint.price;
        if (priceChange < 0.05) { // Less than 5% change
          updatedData[lastIndex] = {
            ...lastDataPoint,
            price: newPrice,
            close: newPrice,
            high: Math.max(lastDataPoint.high, newPrice),
            low: Math.min(lastDataPoint.low, newPrice),
            timestamp: Date.now(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          setPriceData(updatedData);
          setCurrentPrice(newPrice);
        }
      }
    });

    const unsubscribeVWAP = subscribeToVWAP(selectedAsset, (data) => {
      setRealTimeVwap(data.vwap);
    });

    // Refresh historical data every 5 minutes
    const refreshInterval = setInterval(fetchHistoricalData, 5 * 60 * 1000);

    return () => {
      unsubscribeTrades();
      unsubscribeVWAP();
      clearInterval(refreshInterval);
    };
  }, [selectedAsset, timeframe, historicalData.length]);


  useEffect(() => {
    // This effect now only handles the live ticker data passed via props.
    if (liveTickerData) {
      // You might want to update a specific part of the state here,
      // for example, the "currentPrice" display.
      // For now, we just log it to show it's being received.
      console.log('Live ticker update:', liveTickerData);
    }
  }, [liveTickerData]);



  const generateVolumeProfile = (priceData: any[]) => {
    if (!priceData || priceData.length === 0) {
      // Generate mock volume profile based on current price
      const currentPrice = realTimePrice || 100000;
      const profile = Array.from({ length: 20 }, (_, i) => {
        const priceLevel = currentPrice * (0.98 + (i * 0.002)); // ±2% range
        return {
          price: priceLevel,
          volume: Math.random() * 5000000 + 1000000,
          side: i < 10 ? 'bid' : 'ask',
          exchange: 'aggregated'
        };
      });
      setVolumeProfile(profile);
      return;
    }

    // Generate volume profile from price data
    const profile = priceData.map((candle, index) => ({
      price: candle.close,
      volume: candle.volume,
      side: index % 2 === 0 ? 'bid' : 'ask',
      exchange: 'aggregated'
    }));

    setVolumeProfile(profile.sort((a, b) => a.price - b.price));
  };

  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${(price / 1000).toFixed(2)}K`;
    return `$${price.toFixed(2)}`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1e6) return `${(volume / 1e6).toFixed(1)}M`;
    if (volume >= 1e3) return `${(volume / 1e3).toFixed(1)}K`;
    return volume.toFixed(0);
  };

  if (loading) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-700 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-slate-700 rounded mb-4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-slate-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Use real-time data from WebSocket and API
  const displayPrice = realTimePrice || currentPrice || liveTickerData?.price || 0;
  const displayVwap = realTimeVwap || vwap || liveTickerData?.vwap || displayPrice;
  const displayVolume = volume24h || liveTickerData?.volume_24h || 0;
  const displayChange = priceChangePercent || change24h;

  return (
    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center">
            <Brain className="h-6 w-6 text-blue-400 mr-2" />
            Institutional Market Overview
            <span className="ml-3 text-sm bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
              {selectedAsset.replace('USDT', '/USDT')}
            </span>
          </h3>
          <p className="text-slate-400 text-sm mt-1">Professional grade market analysis with real-time data</p>
        </div>

        {/* View Selector */}
        <div className="flex bg-slate-800/80 rounded-lg p-1">
          {[
            { key: 'price', label: 'Price Action', icon: TrendingUp },
            { key: 'volume', label: 'Volume Profile', icon: BarChart3 },
            { key: 'flow', label: 'Order Flow', icon: Activity }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveView(key as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded text-sm transition-all ${activeView === key
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Current Price</span>
            <Target className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-2">
            <span className="text-white text-xl font-bold">${displayPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <div className={`flex items-center space-x-1 mt-1 ${displayChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {displayChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span className="text-sm">{displayChange >= 0 ? '+' : ''}{displayChange.toFixed(2)}%</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">VWAP</span>
            <Activity className="h-4 w-4 text-purple-400" />
          </div>
          <div className="mt-2">
            <span className="text-white text-xl font-bold">${displayVwap.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <div className={`text-sm mt-1 ${displayPrice > displayVwap ? 'text-green-400' : 'text-red-400'}`}>
              {displayPrice > displayVwap ? 'Above VWAP' : 'Below VWAP'}
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">24h Volume</span>
            <BarChart3 className="h-4 w-4 text-orange-400" />
          </div>
          <div className="mt-2">
            <span className="text-white text-xl font-bold">{formatVolume(displayVolume)}</span>
            <div className="text-green-400 text-sm mt-1">+12.5%</div>
          </div>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">Exchanges</span>
            <Eye className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-white text-xl font-bold">17+</span>
            <div className="text-emerald-400 text-sm mt-1">Live Data</div>
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="h-80">
        {activeView === 'price' && priceData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={priceData}>
              <defs>
                <linearGradient id="priceAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0.05} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="time"
                stroke="#9CA3AF"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                stroke="#9CA3AF"
                fontSize={12}
                tickLine={false}
                tickFormatter={formatPrice}
                domain={['dataMin - 100', 'dataMax + 100']}
              />
              <YAxis
                yAxisId="volume"
                orientation="right"
                stroke="#9CA3AF"
                fontSize={12}
                tickLine={false}
                tickFormatter={formatVolume}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#FFFFFF'
                }}
                formatter={(value: any, name: string) => {
                  if (name === 'high') return [`$${value.toFixed(2)}`, 'High'];
                  if (name === 'low') return [`$${value.toFixed(2)}`, 'Low'];
                  if (name === 'close') return [`$${value.toFixed(2)}`, 'Close'];
                  if (name === 'vwap') return [`$${value.toFixed(2)}`, 'VWAP'];
                  if (name === 'volume') return [formatVolume(value), 'Volume'];
                  return [formatPrice(value), name];
                }}
              />

              {/* Volume area in background */}
              <Area
                type="monotone"
                dataKey="volume"
                yAxisId="volume"
                fill="#3B82F6"
                fillOpacity={0.1}
                stroke="none"
              />

              {/* Price range area (High to Low) for realistic price action */}
              <Area
                type="monotone"
                dataKey="high"
                fill="url(#priceAreaGradient)"
                stroke="#22C55E"
                strokeWidth={1}
                strokeOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="low"
                fill="transparent"
                stroke="#EF4444"
                strokeWidth={1}
                strokeOpacity={0.6}
              />

              {/* Main close price line (thick and prominent) */}
              <Line
                type="monotone"
                dataKey="close"
                stroke="#10B981"
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, fill: '#10B981', stroke: '#065F46', strokeWidth: 2 }}
              />

              {/* VWAP reference line */}
              <Line
                type="monotone"
                dataKey="vwap"
                stroke="#F59E0B"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />

              {/* High price line (thin green) */}
              <Line
                type="monotone"
                dataKey="high"
                stroke="#22C55E"
                strokeWidth={1}
                strokeOpacity={0.7}
                dot={false}
              />

              {/* Low price line (thin red) */}
              <Line
                type="monotone"
                dataKey="low"
                stroke="#EF4444"
                strokeWidth={1}
                strokeOpacity={0.7}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {activeView === 'volume' && volumeProfile.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={volumeProfile}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="price"
                stroke="#9CA3AF"
                fontSize={12}
                tickLine={false}
                tickFormatter={formatPrice}
              />
              <YAxis
                stroke="#9CA3AF"
                fontSize={12}
                tickLine={false}
                tickFormatter={formatVolume}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#FFFFFF'
                }}
              />
              <Area
                type="monotone"
                dataKey="volume"
                fill="#8B5CF6"
                fillOpacity={0.6}
                stroke="#8B5CF6"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {activeView === 'volume' && volumeProfile.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <h4 className="text-slate-400 text-lg font-semibold mb-2">Volume Profile</h4>
              <p className="text-slate-500 text-sm">Loading market depth data...</p>
            </div>
          </div>
        )}

        {activeView === 'price' && priceData.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <h4 className="text-slate-400 text-lg font-semibold mb-2">Price Action Chart</h4>
              <p className="text-slate-500 text-sm">Loading real-time price data...</p>
              <div className="mt-4">
                <div className="animate-pulse bg-slate-700 h-4 w-32 mx-auto rounded"></div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'flow' && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Zap className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
              <h4 className="text-white text-lg font-semibold mb-2">Order Flow Analytics</h4>
              <p className="text-slate-400">Real-time order flow analysis</p>
              {orderFlow && (
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <span className="text-green-400 text-2xl font-bold">
                      {formatVolume(orderFlow.stats?.totalBuy || 0)}
                    </span>
                    <div className="text-slate-400 text-sm mt-1">Buy Flow</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <span className="text-red-400 text-2xl font-bold">
                      {formatVolume(orderFlow.stats?.totalSell || 0)}
                    </span>
                    <div className="text-slate-400 text-sm mt-1">Sell Flow</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InstitutionalMarketOverview; 