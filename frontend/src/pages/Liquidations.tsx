import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import LiquidationFeed from '../components/LiquidationFeed';
import GenericHeatmap from '../components/GenericHeatmap';
import { 
  fetchLiquidationHeatmap, 
  fetchLiquidations, 
  fetchWhaleAlerts, 
  fetchLiquidationCascade, 
  fetchOIAnalysis,
  subscribeToLiquidations,
  subscribeToWhaleAlerts,

} from '../api';
import type { LiquidationEvent, HeatmapData } from '../types';
import type { LiquidationData } from '../api';
import { TrendingUp, TrendingDown, Volume2, AlertTriangle, Activity, Zap, Target, BarChart3, PieChart, Settings, Filter, Bell, Maximize2, RefreshCw, Brain, DollarSign } from 'lucide-react';
import LiquidationCascadePredictor from '../components/LiquidationCascadePredictor';
import AdvancedLiquidationAnalytics from '../components/AdvancedLiquidationAnalytics';

// Enhanced liquidation statistics interface
interface EnhancedLiquidationStats {
  totalAmount: number;
  longAmount: number;
  shortAmount: number;
  longCount: number;
  shortCount: number;
  averageSize: number;
  largestLiquidation: LiquidationEvent | null;
  exchangeBreakdown: { exchange: string; count: number; volume: number; percentage: number }[];
  timeDistribution: { hour: number; count: number; volume: number }[];
  sizeCategories: {
    small: { count: number; volume: number; threshold: number };
    medium: { count: number; volume: 0, threshold: 100000 };
    large: { count: 0, volume: 0, threshold: 1000000 };
    whale: { count: 0, volume: 0, threshold: 1000000 };
  };
}

// Liquidation cascade risk levels
interface CascadeRisk {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  probability: number;
  description: string;
  priceLevel: number;
  volumeAtRisk: number;
}

export function Liquidations() {
  const [activeSymbol, setActiveSymbol] = useState<string>('BTCUSDT');
  const [activeTimeframe, setActiveTimeframe] = useState<string>('1d');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [liquidations, setLiquidations] = useState<LiquidationEvent[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [enhancedStats, setEnhancedStats] = useState<EnhancedLiquidationStats>({
    totalAmount: 0,
    longAmount: 0,
    shortAmount: 0,
    longCount: 0,
    shortCount: 0,
    averageSize: 0,
    largestLiquidation: null,
    exchangeBreakdown: [],
    timeDistribution: [],
    sizeCategories: {
      small: { count: 0, volume: 0, threshold: 10000 },
      medium: { count: 0, volume: 0, threshold: 100000 },
      large: { count: 0, volume: 0, threshold: 1000000 },
      whale: { count: 0, volume: 0, threshold: 1000000 }
    }
  });
  
  const [cascadeRisk, setCascadeRisk] = useState<CascadeRisk>({
    level: 'LOW',
    probability: 0.12,
    description: 'Minimal liquidation cascade risk detected',
    priceLevel: 0,
    volumeAtRisk: 0
  });

  const [realTimeEnabled, setRealTimeEnabled] = useState<boolean>(true);
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState<boolean>(false);
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>(['all']);
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<string>('all');
  
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT', 'ADAUSDT', 'XRPUSDT', 'AVAXUSDT'];
  const timeframes = [
    { id: '1h', label: '1 Hour' },
    { id: '4h', label: '4 Hours' },
    { id: '1d', label: '1 Day' },
    { id: '1w', label: '1 Week' }
  ];

  const exchanges = ['binance', 'bybit', 'okx', 'deribit', 'bitmex', 'kucoin', 'gate', 'mexc'];
  const sizeFilters = [
    { id: 'all', label: 'All Sizes' },
    { id: 'small', label: 'Small (<$10K)' },
    { id: 'medium', label: 'Medium ($10K-$100K)' },
    { id: 'large', label: 'Large ($100K-$1M)' },
    { id: 'whale', label: 'Whale (>$1M)' }
  ];

  // Calculate enhanced statistics
  const calculateEnhancedStats = (liquidationData: LiquidationEvent[]) => {
    if (!liquidationData.length) return;

    const totalAmount = liquidationData.reduce((sum, liq) => sum + liq.amount, 0);
    const longLiquidations = liquidationData.filter(liq => liq.side === 'long');
    const shortLiquidations = liquidationData.filter(liq => liq.side === 'short');
    
    const longAmount = longLiquidations.reduce((sum, liq) => sum + liq.amount, 0);
    const shortAmount = shortLiquidations.reduce((sum, liq) => sum + liq.amount, 0);
    
    // Find largest liquidation
    const largestLiquidation = liquidationData.reduce((largest, current) => 
      current.amount > largest.amount ? current : largest, liquidationData[0]
    );

    // Exchange breakdown
    const exchangeMap = new Map<string, { count: number; volume: number }>();
    liquidationData.forEach(liq => {
      const exchange = liq.exchange;
      if (exchangeMap.has(exchange)) {
        const existing = exchangeMap.get(exchange)!;
        existing.count += 1;
        existing.volume += liq.amount;
      } else {
        exchangeMap.set(exchange, { count: 1, volume: liq.amount });
      }
    });

    const exchangeBreakdown = Array.from(exchangeMap.entries()).map(([exchange, data]) => ({
      exchange,
      count: data.count,
      volume: data.volume,
      percentage: (data.count / liquidationData.length) * 100
    })).sort((a, b) => b.volume - a.volume);

    // Time distribution (by hour)
    const timeMap = new Map<number, { count: number; volume: number }>();
    liquidationData.forEach(liq => {
      const hour = new Date(liq.timestamp).getHours();
      if (timeMap.has(hour)) {
        const existing = timeMap.get(hour)!;
        existing.count += 1;
        existing.volume += liq.amount;
      } else {
        timeMap.set(hour, { count: 1, volume: liq.amount });
      }
    });

    const timeDistribution = Array.from(timeMap.entries()).map(([hour, data]) => ({
      hour,
      count: data.count,
      volume: data.volume
    })).sort((a, b) => a.hour - b.hour);

    // Size categorization
    const sizeCategories = {
      small: { count: 0, volume: 0, threshold: 10000 },
      medium: { count: 0, volume: 0, threshold: 100000 },
      large: { count: 0, volume: 0, threshold: 1000000 },
      whale: { count: 0, volume: 0, threshold: 1000000 }
    };

    liquidationData.forEach(liq => {
      const value = liq.amount * liq.price;
      if (value < 10000) {
        sizeCategories.small.count++;
        sizeCategories.small.volume += value;
      } else if (value < 100000) {
        sizeCategories.medium.count++;
        sizeCategories.medium.volume += value;
      } else if (value < 1000000) {
        sizeCategories.large.count++;
        sizeCategories.large.volume += value;
      } else {
        sizeCategories.whale.count++;
        sizeCategories.whale.volume += value;
      }
    });

    // Calculate cascade risk
    const whaleVolume = sizeCategories.whale.volume + sizeCategories.large.volume;
    const totalVolume = totalAmount * liquidationData[0]?.price || 1;
    const cascadeProbability = Math.min(0.95, (whaleVolume / totalVolume) * 1.5);
    
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (cascadeProbability > 0.7) riskLevel = 'CRITICAL';
    else if (cascadeProbability > 0.5) riskLevel = 'HIGH';
    else if (cascadeProbability > 0.3) riskLevel = 'MEDIUM';

    setCascadeRisk({
      level: riskLevel,
      probability: cascadeProbability,
      description: `${riskLevel.toLowerCase()} liquidation cascade risk based on position clustering`,
      priceLevel: largestLiquidation?.price || 0,
      volumeAtRisk: whaleVolume
    });

    setEnhancedStats({
      totalAmount,
      longAmount,
      shortAmount,
      longCount: longLiquidations.length,
      shortCount: shortLiquidations.length,
      averageSize: totalAmount / liquidationData.length,
      largestLiquidation,
      exchangeBreakdown,
      timeDistribution,
      sizeCategories
    });
  };

  // WebSocket-first data loading with REST fallback to avoid rate limits
  useEffect(() => {
    let unsubscribeLiquidations: (() => void) | null = null;
    let unsubscribeWhaleAlerts: (() => void) | null = null;
    let unsubscribeRealTime: (() => void) | null = null;

    const loadInitialData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('📊 Loading initial liquidation data via REST...');
        
        // Fetch liquidation events
        const data = await fetchLiquidations(activeSymbol);
        if (data && Array.isArray(data)) {
          const mappedLiquidations: LiquidationEvent[] = data.map(liq => ({
            symbol: activeSymbol,
            exchange: liq.exchange || 'unknown',
            side: (liq.side === 'sell' || liq.side === 'long') ? 'long' : 'short',
            amount: liq.size,
            price: liq.price,
            timestamp: liq.timestamp
          }));
          
          setLiquidations(mappedLiquidations);
          calculateEnhancedStats(mappedLiquidations);
        }

        // Fetch heatmap data
        const heatmapResponse = await fetchLiquidationHeatmap(activeSymbol, activeTimeframe);
        if (heatmapResponse && heatmapResponse.data) {
          const times = [...new Set(heatmapResponse.data.map(d => new Date(d.time * 1000).toLocaleTimeString()))];
          const minPrice = Math.min(...heatmapResponse.data.map(d => d.price));
          const maxPrice = Math.max(...heatmapResponse.data.map(d => d.price));
          const priceRange = maxPrice - minPrice;
          const priceStep = priceRange / 10;
          
          const prices: string[] = [];
          for (let i = 0; i <= 10; i++) {
            const price = minPrice + i * priceStep;
            prices.push(price.toFixed(2));
          }
          
          const values: number[][] = [];
          prices.forEach((priceStr, priceIndex) => {
            const row: number[] = [];
            const price = parseFloat(priceStr);
            const nextPrice = priceIndex < prices.length - 1 ? parseFloat(prices[priceIndex + 1]) : Infinity;
            
            times.forEach(time => {
              const liquidationsInRange = heatmapResponse.data.filter(d => {
                const timeMatch = new Date(d.time * 1000).toLocaleTimeString() === time;
                const priceMatch = d.price >= price && d.price < nextPrice;
                return timeMatch && priceMatch;
              });
              
              const intensity = liquidationsInRange.reduce((sum, d) => sum + d.intensity, 0);
              row.push(intensity);
            });
            
            values.push(row);
          });
          
          setHeatmapData({
            type: 'liquidation',
            timeframe: activeTimeframe,
            data: {
              x: times,
              y: prices.reverse(),
              values: values.reverse()
            }
          });
        }
      } catch (err) {
        console.error('Error fetching liquidation data:', err);
        setError('Failed to load liquidation data');
      } finally {
        setLoading(false);
      }
    };

    const setupWebSocketFeeds = () => {
      if (!realTimeEnabled) return;
      
      console.log('🚀 Setting up WebSocket feeds to avoid rate limits...');
      
      // Subscribe to real-time liquidations
      unsubscribeLiquidations = subscribeToLiquidations(activeSymbol, (data) => {
        console.log('📡 Real-time liquidation data received:', data);
        
        if (data.type === 'liquidation_alert' && data.data) {
          const newLiquidations = data.data.map((item: any) => ({
            symbol: activeSymbol,
            exchange: item.exchange,
            side: item.side,
            amount: item.size,
            price: item.liquidation_price,
            timestamp: item.timestamp
          }));
          
          setLiquidations(prev => {
            const combined = [...newLiquidations, ...prev].slice(0, 500); // Keep last 500
            calculateEnhancedStats(combined);
            return combined;
          });
        }
      });

      // Subscribe to whale alerts
      unsubscribeWhaleAlerts = subscribeToWhaleAlerts(activeSymbol, (data) => {
        console.log('🐋 Whale alert received:', data);
        
        if (soundAlertsEnabled && data.type === 'whale_alert') {
          try {
            new Audio('/whale-alert.mp3').play().catch(() => {
              console.log('🔇 Could not play whale alert sound');
            });
          } catch (e) {
            console.log('🔇 Audio not available');
          }
        }
      });

      
    };

    // Load initial data first, then setup WebSocket feeds
    loadInitialData().then(() => {
      setupWebSocketFeeds();
    });

    // Cleanup function
    return () => {
      if (unsubscribeLiquidations) unsubscribeLiquidations();
      if (unsubscribeWhaleAlerts) unsubscribeWhaleAlerts();
      if (unsubscribeRealTime) unsubscribeRealTime();
    };
  }, [activeSymbol, activeTimeframe, realTimeEnabled, soundAlertsEnabled]);

  // Format currency with enhanced precision
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(2)}B`;
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(2)}K`;
    return `$${amount.toFixed(2)}`;
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'HIGH': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'MEDIUM': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      default: return 'text-green-500 bg-green-500/10 border-green-500/20';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Enhanced Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Liquidation Intelligence Platform</h2>
            <p className="text-gray-400">
              Professional-grade liquidation tracking with predictive analytics and cascade risk assessment
            </p>
          </div>
          
          {/* Real-time Controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRealTimeEnabled(!realTimeEnabled)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  realTimeEnabled 
                    ? 'bg-green-600 text-white' 
                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  {realTimeEnabled ? <Activity className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
                  {realTimeEnabled ? 'Live' : 'Paused'}
                </div>
              </button>
              
              <button
                onClick={() => setSoundAlertsEnabled(!soundAlertsEnabled)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  soundAlertsEnabled 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Bell className="h-4 w-4" />
              </button>
              
              <button className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-800/50 text-gray-300 hover:bg-gray-700">
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Symbol and Controls Row */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {/* Symbol selector */}
          <div className="flex flex-wrap gap-2">
            {symbols.map((symbol) => (
              <button
                key={symbol}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeSymbol === symbol
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700'
                }`}
                onClick={() => setActiveSymbol(symbol)}
              >
                {symbol}
              </button>
            ))}
          </div>
          
          {/* Timeframe selector */}
          <div className="flex gap-2">
            {timeframes.map((timeframe) => (
              <button
                key={timeframe.id}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                  activeTimeframe === timeframe.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700'
                }`}
                onClick={() => setActiveTimeframe(timeframe.id)}
              >
                {timeframe.label}
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Filters */}
        <div className="flex items-center gap-4 p-4 bg-gray-800/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-400">Filters:</span>
          </div>
          
          {/* Exchange Filter */}
          <select 
            className="bg-gray-700 text-white text-sm rounded px-3 py-1"
            value={selectedExchanges[0]}
            onChange={(e) => setSelectedExchanges([e.target.value])}
          >
            <option value="all">All Exchanges</option>
            {exchanges.map(exchange => (
              <option key={exchange} value={exchange}>{exchange.toUpperCase()}</option>
            ))}
          </select>
          
          {/* Size Filter */}
          <select 
            className="bg-gray-700 text-white text-sm rounded px-3 py-1"
            value={selectedSizeFilter}
            onChange={(e) => setSelectedSizeFilter(e.target.value)}
          >
            {sizeFilters.map(filter => (
              <option key={filter.id} value={filter.id}>{filter.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 p-4 bg-red-500/10 rounded-lg">{error}</div>
      ) : (
        <>
          {/* Enhanced Statistics Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Total Liquidations */}
            <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-gray-400 mb-1">Total Liquidations</div>
                  <div className="text-2xl font-bold text-white">{formatCurrency(enhancedStats.totalAmount)}</div>
                  <div className="text-sm text-gray-500 mt-1">{liquidations.length} events</div>
                  <div className="text-xs text-blue-400 mt-1">
                    Avg: {formatCurrency(enhancedStats.averageSize)}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Long Liquidations */}
            <Card className="bg-gradient-to-br from-red-900/30 to-red-800/20">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-gray-400 mb-1">Long Liquidations</div>
                  <div className="text-2xl font-bold text-red-400">{formatCurrency(enhancedStats.longAmount)}</div>
                  <div className="text-sm text-gray-500 mt-1">{enhancedStats.longCount} events</div>
                  <div className="text-xs text-red-300 mt-1">
                    {((enhancedStats.longAmount / (enhancedStats.totalAmount || 1)) * 100).toFixed(1)}% of volume
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Short Liquidations */}
            <Card className="bg-gradient-to-br from-green-900/30 to-green-800/20">
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-gray-400 mb-1">Short Liquidations</div>
                  <div className="text-2xl font-bold text-green-400">{formatCurrency(enhancedStats.shortAmount)}</div>
                  <div className="text-sm text-gray-500 mt-1">{enhancedStats.shortCount} events</div>
                  <div className="text-xs text-green-300 mt-1">
                    {((enhancedStats.shortAmount / (enhancedStats.totalAmount || 1)) * 100).toFixed(1)}% of volume
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cascade Risk Assessment */}
            <Card className={`border-2 ${getRiskColor(cascadeRisk.level)}`}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-gray-400 mb-1">Cascade Risk</div>
                  <div className={`text-2xl font-bold ${cascadeRisk.level === 'CRITICAL' ? 'text-red-500' : 
                    cascadeRisk.level === 'HIGH' ? 'text-orange-500' :
                    cascadeRisk.level === 'MEDIUM' ? 'text-yellow-500' : 'text-green-500'}`}>
                    {cascadeRisk.level}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {(cascadeRisk.probability * 100).toFixed(1)}% probability
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {formatCurrency(cascadeRisk.volumeAtRisk)} at risk
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Position Size Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            {Object.entries(enhancedStats.sizeCategories).map(([category, data]) => (
              <Card key={category} className="bg-gray-800/30">
                <CardContent className="pt-4">
                  <div className="text-center">
                    <div className="text-gray-400 text-sm mb-1 capitalize">{category} Positions</div>
                    <div className="text-lg font-bold text-white">{data.count}</div>
                    <div className="text-xs text-gray-500">{formatCurrency(data.volume)}</div>
                    <div className="text-xs text-blue-400 mt-1">
                      {category === 'whale' ? '>$1M' : 
                       category === 'large' ? '$100K-$1M' :
                       category === 'medium' ? '$10K-$100K' : '<$10K'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Main Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Enhanced Liquidation Heatmap */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  {activeSymbol} Liquidation Density Map
                </CardTitle>
                <div className="flex gap-2">
                  <button className="px-3 py-1 rounded text-xs font-medium bg-gray-800/50 text-gray-300 hover:bg-gray-700">
                    <Maximize2 className="h-3 w-3" />
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                {heatmapData ? (
                  <div className="space-y-4">
                    <GenericHeatmap 
                      data={heatmapData}
                      symbol={activeSymbol}
                    />
                    
                    {/* Heatmap Legend and Stats */}
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-gray-400">High Density Zones</div>
                        <div className="text-red-400 font-bold">
                          {heatmapData.data?.values?.flat().filter(v => v > 100000).length || 0}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400">Price Range</div>
                        <div className="text-white font-bold">
                          {heatmapData.data?.y?.[0]} - {heatmapData.data?.y?.[heatmapData.data.y.length - 1]}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-gray-400">Time Span</div>
                        <div className="text-white font-bold">{activeTimeframe.toUpperCase()}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p>No heatmap data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Real-time Liquidation Feed */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Live Liquidation Feed
                  {realTimeEnabled && (
                    <div className="ml-auto">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <LiquidationFeed 
                  liquidations={liquidations.slice(0, 20)} 
                  symbol={activeSymbol}
                  limit={20}
                />
              </CardContent>
            </Card>
          </div>

          {/* Advanced Analytics Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Exchange Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Exchange Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {enhancedStats.exchangeBreakdown.slice(0, 6).map((exchange, index) => (
                    <div key={exchange.exchange} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full`} 
                             style={{ backgroundColor: `hsl(${index * 60}, 70%, 60%)` }}>
                        </div>
                        <span className="text-white capitalize">{exchange.exchange}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-white font-bold">{exchange.count}</div>
                        <div className="text-xs text-gray-400">{formatCurrency(exchange.volume)}</div>
                      </div>
                      <div className="text-xs text-gray-500 w-12 text-right">
                        {exchange.percentage.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Time Distribution Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Hourly Activity Pattern
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {enhancedStats.timeDistribution.slice(0, 8).map((hour) => (
                    <div key={hour.hour} className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">
                        {hour.hour.toString().padStart(2, '0')}:00
                      </span>
                      <div className="flex-1 mx-3">
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full transition-all"
                            style={{ 
                              width: `${(hour.count / Math.max(...enhancedStats.timeDistribution.map(h => h.count))) * 100}%` 
                            }}
                          ></div>
                        </div>
                      </div>
                      <span className="text-white text-sm font-bold">{hour.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Largest Liquidation Alert */}
          {enhancedStats.largestLiquidation && (
            <Card className="border-2 border-orange-500/30 bg-orange-500/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-8 w-8 text-orange-500" />
                    <div>
                      <div className="text-white font-bold">Largest Liquidation Detected</div>
                      <div className="text-gray-400 text-sm">
                        {enhancedStats.largestLiquidation.side.toUpperCase()} position on {enhancedStats.largestLiquidation.exchange}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-orange-500">
                      {formatCurrency(enhancedStats.largestLiquidation.amount)}
                    </div>
                    <div className="text-sm text-gray-400">
                      at ${enhancedStats.largestLiquidation.price.toFixed(2)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Advanced Liquidation Intelligence Section */}
          <div className="mt-8">
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-white mb-2">Advanced Liquidation Intelligence</h3>
              <p className="text-gray-400">
                Professional-grade predictive analytics and institutional intelligence powered by AI
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Liquidation Cascade Predictor */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    AI Cascade Predictor
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LiquidationCascadePredictor symbol={activeSymbol} />
                </CardContent>
              </Card>

              {/* Whale Alert System */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Whale Detection System
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-gray-500">
                    <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p>Whale Alert System</p>
                    <p className="text-sm">Coming Soon - Advanced whale detection</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Advanced Analytics Dashboard */}
            <div className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Institutional Analytics Dashboard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <AdvancedLiquidationAnalytics symbol={activeSymbol} />
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}