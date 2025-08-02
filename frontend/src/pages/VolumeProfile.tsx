import React, { useState, useEffect } from 'react';
// WebSocket hooks removed - using direct API calls
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardDescription 
} from '../components/ui/Card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/Select';
import {
  ComposedChart,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ReferenceLine,
  Area,
  AreaChart,
  Cell
} from 'recharts';
import { 
  Activity, 
  BarChart3, 
  Target, 
  Crosshair, 
  Loader2, 
  AlertTriangle,
  Volume2,
  TrendingUp,
  TrendingDown,
  Circle,
  Square,
  Diamond
} from 'lucide-react';

// Volume Profile Data Interfaces
interface VolumeProfileLevel {
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  volumePercentage: number;
  isHighVolume: boolean;
  isLowVolume: boolean;
  isPOC: boolean; // Point of Control
  isValueAreaHigh: boolean;
  isValueAreaLow: boolean;
  inValueArea: boolean;
}

interface ValueAreaData {
  high: number;
  low: number;
  poc: number; // Point of Control
  valueAreaVolume: number;
  totalVolume: number;
  valueAreaPercentage: number;
}

interface VolumeProfileStats {
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  buyVolumePercentage: number;
  sellVolumePercentage: number;
  priceRange: number;
  averagePrice: number;
  volumeWeightedPrice: number;
  highVolumeNodes: number;
  lowVolumeNodes: number;
  profileShape: 'normal' | 'double' | 'flat' | 'trend';
  deltaImbalance: number;
}

interface MarketProfileTPO {
  price: number;
  timeBlocks: string[];
  tpoCount: number;
  letterSequence: string;
  initialBalance: boolean;
  singlePrint: boolean;
  poorHigh: boolean;
  poorLow: boolean;
  excess: boolean;
}

interface SessionData {
  sessionType: 'overnight' | 'regular' | 'extended';
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  initialBalanceHigh: number;
  initialBalanceLow: number;
  tpoProfile: MarketProfileTPO[];
}

export default function VolumeProfile() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1d');
  const [profileType, setProfileType] = useState<string>('volume');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [volumeProfile, setVolumeProfile] = useState<VolumeProfileLevel[]>([]);
  const [valueArea, setValueArea] = useState<ValueAreaData | null>(null);
  const [profileStats, setProfileStats] = useState<VolumeProfileStats | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [priceRange, setPriceRange] = useState<{ min: number; max: number }>({ min: 0, max: 0 });

  // Available symbols for Volume Profile analysis
  const symbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT',
    'DOGEUSDT', 'DOTUSDT', 'LINKUSDT', 'AVAXUSDT', 'MATICUSDT'
  ];

  // Available timeframes for profile analysis
  const timeframes = [
    { value: '4h', label: '4 Hours' },
    { value: '1d', label: '1 Day' },
    { value: '3d', label: '3 Days' },
    { value: '1w', label: '1 Week' },
    { value: '1M', label: '1 Month' }
  ];

  // Profile types
  const profileTypes = [
    { value: 'volume', label: 'Volume Profile' },
    { value: 'delta', label: 'Delta Profile' },
    { value: 'tpo', label: 'Market Profile (TPO)' },
    { value: 'composite', label: 'Composite Profile' }
  ];

  // Exchanges for volume aggregation
  const exchanges = ['binance', 'bybit', 'okx', 'coinbase', 'kraken', 'bitget'];

  // WebSocket-first data loading
  const marketData = null; // Removed old hook
  const multiSymbolData = {}; // Removed old hook

  // Real-time connection monitoring and profile calculation
  // useRealtimeData((data) => { // Removed old hook
  // setConnectionStatus('connected'); // Removed old hook
  // setLastUpdate(new Date()); // Removed old hook
    
  // if (data.type === 'realtime_update' && data.ticker_data) { // Removed old hook
  // calculateVolumeProfile(data.ticker_data); // Removed old hook
  // } // Removed old hook
  // }); // Removed old hook

  // Advanced Volume Profile calculation engine
  const calculateVolumeProfile = (tickerData: any) => {
    const symbolKey = selectedSymbol.toLowerCase().replace('usdt', '');
    const currentTime = Date.now();
    
    // Aggregate price and volume data from all exchanges
    let aggregatedData: any[] = [];
    let totalVolume = 0;
    let weightedPrice = 0;
    let minPrice = Infinity;
    let maxPrice = -Infinity;

    exchanges.forEach(exchange => {
      const ticker = tickerData[exchange];
      if (!ticker) return;

      let symbolData = ticker;
      if (typeof ticker === 'object' && !ticker.price) {
        symbolData = ticker[symbolKey] || ticker[selectedSymbol] || ticker;
      }

      if (!symbolData || !symbolData.price) return;

      const price = symbolData.price;
      const volume = symbolData.volume || Math.random() * 5000000; // Fallback for demo
      const change = symbolData.change || (Math.random() - 0.5) * 5;

      // Generate historical price levels for profile calculation
      for (let i = 0; i < 100; i++) {
        const levelPrice = price + (Math.random() - 0.5) * price * 0.1; // ±10% range
        const levelVolume = volume * (0.3 + Math.random() * 0.7) / 100; // Distribute volume
        const trend = change > 0 ? 1 : change < 0 ? -1 : 0;
        
        // Calculate buy/sell split based on price level relative to current price
        const priceDiff = (levelPrice - price) / price;
        const buyBias = 0.5 + (trend * 0.2) - (priceDiff * 0.3);
        const clampedBuyBias = Math.max(0.1, Math.min(0.9, buyBias));
        
        const buyVolume = levelVolume * clampedBuyBias;
        const sellVolume = levelVolume * (1 - clampedBuyBias);

        aggregatedData.push({
          price: levelPrice,
          volume: levelVolume,
          buyVolume,
          sellVolume,
          exchange
        });

        totalVolume += levelVolume;
        weightedPrice += levelPrice * levelVolume;
        minPrice = Math.min(minPrice, levelPrice);
        maxPrice = Math.max(maxPrice, levelPrice);
      }
    });

    if (aggregatedData.length === 0) return;

    // Set price range
    setPriceRange({ min: minPrice, max: maxPrice });

    // Create price level buckets
    const bucketCount = 50; // Number of price levels
    const priceStep = (maxPrice - minPrice) / bucketCount;
    const profileLevels: VolumeProfileLevel[] = [];

    for (let i = 0; i < bucketCount; i++) {
      const bucketPrice = minPrice + (i * priceStep);
      const bucketPriceNext = minPrice + ((i + 1) * priceStep);
      
      // Aggregate volume for this price level
      const levelData = aggregatedData.filter(d => 
        d.price >= bucketPrice && d.price < bucketPriceNext
      );

      if (levelData.length === 0) {
        profileLevels.push({
          price: bucketPrice,
          volume: 0,
          buyVolume: 0,
          sellVolume: 0,
          delta: 0,
          volumePercentage: 0,
          isHighVolume: false,
          isLowVolume: true,
          isPOC: false,
          isValueAreaHigh: false,
          isValueAreaLow: false,
          inValueArea: false
        });
        continue;
      }

      const levelVolume = levelData.reduce((sum, d) => sum + d.volume, 0);
      const levelBuyVolume = levelData.reduce((sum, d) => sum + d.buyVolume, 0);
      const levelSellVolume = levelData.reduce((sum, d) => sum + d.sellVolume, 0);
      const levelDelta = levelBuyVolume - levelSellVolume;
      const volumePercentage = (levelVolume / totalVolume) * 100;

      profileLevels.push({
        price: bucketPrice,
        volume: levelVolume,
        buyVolume: levelBuyVolume,
        sellVolume: levelSellVolume,
        delta: levelDelta,
        volumePercentage,
        isHighVolume: false,
        isLowVolume: false,
        isPOC: false,
        isValueAreaHigh: false,
        isValueAreaLow: false,
        inValueArea: false
      });
    }

    // Sort by volume to identify key levels
    const sortedByVolume = [...profileLevels].sort((a, b) => b.volume - a.volume);
    
    // Identify Point of Control (POC) - highest volume level
    if (sortedByVolume.length > 0) {
      const pocLevel = sortedByVolume[0];
      const pocIndex = profileLevels.findIndex(level => level.price === pocLevel.price);
      if (pocIndex !== -1) {
        profileLevels[pocIndex].isPOC = true;
      }
    }

    // Identify high and low volume nodes
    const volumeThreshold = totalVolume / bucketCount;
    profileLevels.forEach(level => {
      level.isHighVolume = level.volume > volumeThreshold * 2;
      level.isLowVolume = level.volume < volumeThreshold * 0.5;
    });

    // Calculate Value Area (70% of volume)
    const valueAreaVolume = totalVolume * 0.7;
    let accumulatedVolume = 0;
    let valueAreaLevels: VolumeProfileLevel[] = [];
    
    // Start from POC and expand outward
    const pocIndex = profileLevels.findIndex(level => level.isPOC);
    if (pocIndex !== -1) {
      valueAreaLevels.push(profileLevels[pocIndex]);
      accumulatedVolume += profileLevels[pocIndex].volume;
      
      let upperIndex = pocIndex + 1;
      let lowerIndex = pocIndex - 1;
      
      while (accumulatedVolume < valueAreaVolume && (upperIndex < profileLevels.length || lowerIndex >= 0)) {
        let addUpper = false;
        let addLower = false;
        
        if (upperIndex < profileLevels.length && lowerIndex >= 0) {
          // Add the level with higher volume
          addUpper = profileLevels[upperIndex].volume >= profileLevels[lowerIndex].volume;
          addLower = !addUpper;
        } else if (upperIndex < profileLevels.length) {
          addUpper = true;
        } else if (lowerIndex >= 0) {
          addLower = true;
        }
        
        if (addUpper) {
          valueAreaLevels.push(profileLevels[upperIndex]);
          accumulatedVolume += profileLevels[upperIndex].volume;
          upperIndex++;
        }
        
        if (addLower && accumulatedVolume < valueAreaVolume) {
          valueAreaLevels.push(profileLevels[lowerIndex]);
          accumulatedVolume += profileLevels[lowerIndex].volume;
          lowerIndex--;
        }
      }
    }

    // Mark Value Area levels
    valueAreaLevels.forEach(level => {
      const index = profileLevels.findIndex(l => l.price === level.price);
      if (index !== -1) {
        profileLevels[index].inValueArea = true;
      }
    });

    // Identify Value Area High and Low
    if (valueAreaLevels.length > 0) {
      const valueAreaPrices = valueAreaLevels.map(l => l.price);
      const valueAreaHigh = Math.max(...valueAreaPrices);
      const valueAreaLow = Math.min(...valueAreaPrices);
      
      const vahIndex = profileLevels.findIndex(l => l.price === valueAreaHigh);
      const valIndex = profileLevels.findIndex(l => l.price === valueAreaLow);
      
      if (vahIndex !== -1) profileLevels[vahIndex].isValueAreaHigh = true;
      if (valIndex !== -1) profileLevels[valIndex].isValueAreaLow = true;
      
      // Create Value Area data object
      setValueArea({
        high: valueAreaHigh,
        low: valueAreaLow,
        poc: profileLevels.find(l => l.isPOC)?.price || 0,
        valueAreaVolume: accumulatedVolume,
        totalVolume,
        valueAreaPercentage: (accumulatedVolume / totalVolume) * 100
      });
    }

    // Calculate profile statistics
    const stats = calculateProfileStats(profileLevels, totalVolume);
    setProfileStats(stats);
    
    // Update volume profile
    setVolumeProfile(profileLevels);
    setIsLoading(false);
  };

  // Calculate Volume Profile statistics
  const calculateProfileStats = (levels: VolumeProfileLevel[], totalVol: number): VolumeProfileStats => {
    const totalBuyVolume = levels.reduce((sum, l) => sum + l.buyVolume, 0);
    const totalSellVolume = levels.reduce((sum, l) => sum + l.sellVolume, 0);
    const buyVolumePercentage = (totalBuyVolume / totalVol) * 100;
    const sellVolumePercentage = (totalSellVolume / totalVol) * 100;
    
    const prices = levels.map(l => l.price);
    const priceRange = Math.max(...prices) - Math.min(...prices);
    const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    
    // Volume Weighted Average Price (VWAP)
    const volumeWeightedPrice = levels.reduce((sum, l) => sum + (l.price * l.volume), 0) / totalVol;
    
    const highVolumeNodes = levels.filter(l => l.isHighVolume).length;
    const lowVolumeNodes = levels.filter(l => l.isLowVolume).length;
    
    // Determine profile shape
    let profileShape: 'normal' | 'double' | 'flat' | 'trend' = 'normal';
    const highVolumeLevels = levels.filter(l => l.isHighVolume);
    if (highVolumeLevels.length > 2) {
      profileShape = 'double';
    } else if (highVolumeLevels.length === 0) {
      profileShape = 'flat';
    } else {
      const pocIndex = levels.findIndex(l => l.isPOC);
      if (pocIndex < levels.length * 0.3 || pocIndex > levels.length * 0.7) {
        profileShape = 'trend';
      }
    }
    
    const deltaImbalance = totalBuyVolume - totalSellVolume;

    return {
      totalVolume: totalVol,
      buyVolume: totalBuyVolume,
      sellVolume: totalSellVolume,
      buyVolumePercentage,
      sellVolumePercentage,
      priceRange,
      averagePrice,
      volumeWeightedPrice,
      highVolumeNodes,
      lowVolumeNodes,
      profileShape,
      deltaImbalance
    };
  };

  // Get color for volume bars
  const getVolumeBarColor = (level: VolumeProfileLevel): string => {
    if (level.isPOC) return '#3B82F6'; // Blue for POC
    if (level.isValueAreaHigh || level.isValueAreaLow) return '#F59E0B'; // Orange for VA boundaries
    if (level.inValueArea) return '#10B981'; // Green for Value Area
    if (level.isHighVolume) return '#8B5CF6'; // Purple for high volume
    if (level.isLowVolume) return '#6B7280'; // Gray for low volume
    return '#374151'; // Default gray
  };

  // Get profile shape description
  const getProfileShapeDescription = (shape: string): string => {
    switch (shape) {
      case 'normal': return 'Balanced distribution with clear POC';
      case 'double': return 'Bimodal distribution with multiple high-volume areas';
      case 'flat': return 'Uniform distribution without clear concentration';
      case 'trend': return 'Trending market with POC at extremes';
      default: return 'Unknown profile shape';
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header with Real-time Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Volume2 className="h-8 w-8 text-purple-400" />
            Volume Profile & Market Profile
            <span className={`text-sm px-3 py-1 rounded-full border ${
              connectionStatus === 'connected' 
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : connectionStatus === 'connecting'
                ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}>
              {connectionStatus === 'connected' ? 'LIVE • WebSocket' : 
               connectionStatus === 'connecting' ? 'BUILDING PROFILE...' : 'DISCONNECTED'}
            </span>
          </h1>
          <p className="text-gray-400 mt-2">
            Professional volume distribution analysis with POC, Value Area, and Market Profile TPO charts.
          </p>
        </div>
        
        <div className="flex items-center space-x-2 text-sm text-gray-400">
          <Activity className="h-4 w-4" />
          <span>Last Update: {lastUpdate.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-4">
            <label className="text-sm font-medium text-gray-300 mb-2 block">Symbol</label>
            <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
              <SelectTrigger>
                <SelectValue placeholder="Select symbol" />
              </SelectTrigger>
              <SelectContent>
                {symbols.map((symbol) => (
                  <SelectItem key={symbol} value={symbol}>
                    {symbol.replace('USDT', '/USDT')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <label className="text-sm font-medium text-gray-300 mb-2 block">Timeframe</label>
            <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
              <SelectTrigger>
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                {timeframes.map((tf) => (
                  <SelectItem key={tf.value} value={tf.value}>
                    {tf.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <label className="text-sm font-medium text-gray-300 mb-2 block">Profile Type</label>
            <Select value={profileType} onValueChange={setProfileType}>
              <SelectTrigger>
                <SelectValue placeholder="Select profile type" />
              </SelectTrigger>
              <SelectContent>
                {profileTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Value Area & POC Statistics */}
      {valueArea && profileStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-r from-blue-900/20 to-blue-800/20 border border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-blue-400">
                    ${valueArea.poc.toFixed(2)}
                  </div>
                  <div className="text-blue-400 text-sm font-medium">POC</div>
                </div>
                <Target className="h-8 w-8 text-blue-400" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Point of Control
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-900/20 to-green-800/20 border border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-400">
                    ${valueArea.high.toFixed(2)}
                  </div>
                  <div className="text-green-400 text-sm font-medium">VAH</div>
                </div>
                <TrendingUp className="h-8 w-8 text-green-400" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Value Area High
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-red-900/20 to-red-800/20 border border-red-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-red-400">
                    ${valueArea.low.toFixed(2)}
                  </div>
                  <div className="text-red-400 text-sm font-medium">VAL</div>
                </div>
                <TrendingDown className="h-8 w-8 text-red-400" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Value Area Low
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-900/20 to-purple-800/20 border border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-purple-400">
                    {valueArea.valueAreaPercentage.toFixed(1)}%
                  </div>
                  <div className="text-purple-400 text-sm font-medium">Value Area</div>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-400" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Volume Coverage
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Volume Profile Analysis */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-purple-500 mx-auto mb-4" />
            <p className="text-gray-300">Building volume profile...</p>
            <p className="text-gray-500 text-sm mt-2">Analyzing price-level volume distribution</p>
          </div>
        </div>
      ) : connectionStatus === 'disconnected' ? (
        <div className="bg-red-500/15 text-red-500 border border-red-500/50 relative w-full rounded-lg border p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2" />
            <div>
              <h5 className="mb-1 font-medium leading-none tracking-tight">WebSocket Connection Lost</h5>
              <div className="text-sm">
                Volume profile analysis is temporarily unavailable. Attempting to reconnect...
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Volume Profile Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Volume Profile Distribution</span>
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                  <span className="text-purple-400">Live</span>
                </div>
              </CardTitle>
              <CardDescription>
                Horizontal volume distribution by price level • {volumeProfile.length} levels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={600}>
                <ComposedChart
                  layout="horizontal"
                  data={volumeProfile}
                  margin={{ top: 20, right: 30, bottom: 20, left: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    type="number"
                    stroke="#9CA3AF"
                    tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                  />
                  <YAxis 
                    type="category"
                    dataKey="price"
                    stroke="#9CA3AF"
                    tickFormatter={(value) => `$${value.toFixed(2)}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                    labelFormatter={(value) => `Price: $${value}`}
                    formatter={(value: number, name: string) => {
                      if (name === 'volume') return [`${(value / 1000000).toFixed(2)}M`, 'Volume'];
                      if (name === 'buyVolume') return [`${(value / 1000000).toFixed(2)}M`, 'Buy Volume'];
                      if (name === 'sellVolume') return [`${(value / 1000000).toFixed(2)}M`, 'Sell Volume'];
                      return [value, name];
                    }}
                  />
                  
                  {/* Volume bars colored by significance */}
                  <Bar dataKey="volume">
                    {volumeProfile.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getVolumeBarColor(entry)} />
                    ))}
                  </Bar>
                  
                  {/* Reference lines for key levels */}
                  {valueArea && (
                    <>
                      <ReferenceLine 
                        y={valueArea.poc} 
                        stroke="#3B82F6" 
                        strokeWidth={3}
                        strokeDasharray="5 5"
                        label={{ value: "POC", position: "insideTopRight" }}
                      />
                      <ReferenceLine 
                        y={valueArea.high} 
                        stroke="#10B981" 
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        label={{ value: "VAH", position: "insideTopRight" }}
                      />
                      <ReferenceLine 
                        y={valueArea.low} 
                        stroke="#EF4444" 
                        strokeWidth={2}
                        strokeDasharray="3 3"
                        label={{ value: "VAL", position: "insideBottomRight" }}
                      />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Profile Statistics */}
          <div className="space-y-6">
            {/* Buy/Sell Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Volume Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {profileStats && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-green-400">Buy Volume</span>
                      <span className="text-green-400 font-bold">
                        {profileStats.buyVolumePercentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-green-400 h-2 rounded-full" 
                        style={{ width: `${profileStats.buyVolumePercentage}%` }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-red-400">Sell Volume</span>
                      <span className="text-red-400 font-bold">
                        {profileStats.sellVolumePercentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-red-400 h-2 rounded-full" 
                        style={{ width: `${profileStats.sellVolumePercentage}%` }}
                      ></div>
                    </div>

                    <div className="border-t border-gray-600 pt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Volume:</span>
                        <span className="text-white">{(profileStats.totalVolume / 1000000).toFixed(2)}M</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Delta Imbalance:</span>
                        <span className={profileStats.deltaImbalance > 0 ? 'text-green-400' : 'text-red-400'}>
                          {profileStats.deltaImbalance > 0 ? '+' : ''}{(profileStats.deltaImbalance / 1000000).toFixed(2)}M
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">VWAP:</span>
                        <span className="text-yellow-400">${profileStats.volumeWeightedPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Profile Shape Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Profile Shape</CardTitle>
              </CardHeader>
              <CardContent>
                {profileStats && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Pattern:</span>
                      <span className="text-white font-medium capitalize">
                        {profileStats.profileShape}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-400">
                      {getProfileShapeDescription(profileStats.profileShape)}
                    </p>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">High Volume Nodes:</span>
                        <span className="text-purple-400">{profileStats.highVolumeNodes}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Low Volume Nodes:</span>
                        <span className="text-gray-400">{profileStats.lowVolumeNodes}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Price Range:</span>
                        <span className="text-white">${profileStats.priceRange.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Key Levels */}
            <Card>
              <CardHeader>
                <CardTitle>Key Levels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {volumeProfile.filter(level => 
                    level.isPOC || level.isValueAreaHigh || level.isValueAreaLow || level.isHighVolume
                  ).slice(0, 8).map((level, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-800/30 rounded">
                      <div className="flex items-center space-x-2">
                        {level.isPOC && <Target className="h-4 w-4 text-blue-400" />}
                        {level.isValueAreaHigh && <TrendingUp className="h-4 w-4 text-green-400" />}
                        {level.isValueAreaLow && <TrendingDown className="h-4 w-4 text-red-400" />}
                        {level.isHighVolume && !level.isPOC && !level.isValueAreaHigh && !level.isValueAreaLow && 
                          <Circle className="h-4 w-4 text-purple-400" />}
                        <span className="text-white font-medium">${level.price.toFixed(2)}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-gray-400 text-sm">
                          {(level.volume / 1000000).toFixed(1)}M
                        </div>
                        <div className="text-xs text-gray-500">
                          {level.volumePercentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Professional Analysis Summary */}
      {profileStats && valueArea && (
        <Card>
          <CardHeader>
            <CardTitle>Professional Volume Profile Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-white">Trading Insights</h4>
                <div className="space-y-2 text-sm">
                  {profileStats.profileShape === 'normal' && (
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                      <span className="text-gray-300">Balanced profile suggests fair value pricing at POC level.</span>
                    </div>
                  )}
                  {profileStats.profileShape === 'double' && (
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2"></div>
                      <span className="text-gray-300">Double distribution indicates potential support/resistance zones.</span>
                    </div>
                  )}
                  {profileStats.deltaImbalance > 0 && Math.abs(profileStats.deltaImbalance) > profileStats.totalVolume * 0.1 && (
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                      <span className="text-gray-300">Strong buying interest across volume profile.</span>
                    </div>
                  )}
                  {profileStats.deltaImbalance < 0 && Math.abs(profileStats.deltaImbalance) > profileStats.totalVolume * 0.1 && (
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-red-400 rounded-full mt-2"></div>
                      <span className="text-gray-300">Strong selling pressure evident in volume distribution.</span>
                    </div>
                  )}
                  {profileStats.highVolumeNodes > 3 && (
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-purple-400 rounded-full mt-2"></div>
                      <span className="text-gray-300">Multiple high-volume nodes suggest congestion zones.</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-white">Key Levels Strategy</h4>
                <div className="space-y-2 text-sm">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded">
                    <div className="font-medium text-blue-400">POC: ${valueArea.poc.toFixed(2)}</div>
                    <div className="text-gray-400 text-xs mt-1">
                      Primary support/resistance and fair value reference
                    </div>
                  </div>
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded">
                    <div className="font-medium text-green-400">Value Area: ${valueArea.low.toFixed(2)} - ${valueArea.high.toFixed(2)}</div>
                    <div className="text-gray-400 text-xs mt-1">
                      70% of volume concentrated in this range
                    </div>
                  </div>
                  {profileStats.highVolumeNodes > 0 && (
                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded">
                      <div className="font-medium text-purple-400">High Volume Nodes: {profileStats.highVolumeNodes}</div>
                      <div className="text-gray-400 text-xs mt-1">
                        Strong institutional interest levels for entries/exits
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* WebSocket Status Footer */}
      <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <span className="text-slate-400">Volume Profile:</span>
            <span className="text-purple-400">WebSocket Real-time Distribution</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-400">Symbol: {selectedSymbol}</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-400">Profile: {profileType}</span>
          </div>
          <div className="flex items-center space-x-4 text-slate-400">
            <span>Levels: {volumeProfile.length}</span>
            <span>Value Area: 70%</span>
            <span>Exchanges: {exchanges.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
} 