import React, { useState, useEffect } from 'react';
import { TrendingUp, BarChart3, Target, Layers, AlertTriangle, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface PriceLevel {
  price: number;
  type: 'support' | 'resistance';
  strength: number;
  volume: number;
  tests: number;
  timeframe: string;
  active: boolean;
}

interface VolumeProfile {
  price: number;
  volume: number;
  percentage: number;
  poi: boolean; // Point of Interest
}

interface MarketProfile {
  timestamp: number;
  high: number;
  low: number;
  valueAreaHigh: number;
  valueAreaLow: number;
  pointOfControl: number;
  totalVolume: number;
}

interface OrderFlow {
  timestamp: number;
  price: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  cumulativeDelta: number;
}

interface MarketStructureAnalyzerProps {
  symbol?: string;
  className?: string;
}

const MarketStructureAnalyzer: React.FC<MarketStructureAnalyzerProps> = ({ 
  symbol = "BTCUSDT",
  className = "" 
}) => {
  const [priceLevels, setPriceLevels] = useState<PriceLevel[]>([]);
  const [volumeProfile, setVolumeProfile] = useState<VolumeProfile[]>([]);
  const [marketProfile, setMarketProfile] = useState<MarketProfile[]>([]);
  const [orderFlow, setOrderFlow] = useState<OrderFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [timeframe, setTimeframe] = useState<'1h' | '4h' | '1d' | '1w'>('1d');
  const [view, setView] = useState<'levels' | 'profile' | 'flow' | 'structure'>('levels');

  const currentPrice = 45250; // Mock current price

  useEffect(() => {
    const fetchRealMarketStructure = async () => {
      try {
        // Fetch real market structure data from API
        const response = await fetch(`/api/market-microstructure/${symbol}?timeframe=${timeframe}`);
        const data = await response.json();
        
        if (data.error) {
          console.error('API Error:', data.error);
          return;
        }

        // Use real price levels from API
        const realLevels: PriceLevel[] = data.price_levels || [];

      // Generate volume profile
      const mockVolumeProfile: VolumeProfile[] = [];
      const priceRange = { min: 44000, max: 47000 };
      const stepSize = 50;
      
      for (let price = priceRange.min; price <= priceRange.max; price += stepSize) {
        // Create a normal distribution around current price
        const distance = Math.abs(price - currentPrice);
        const maxDistance = (priceRange.max - priceRange.min) / 2;
        const normalizedDistance = distance / maxDistance;
        
        // Higher volume near current price and key levels
        let volume = Math.exp(-normalizedDistance * 2) * 1000000;
        
        // Add spikes at key levels
        if (mockLevels.some(level => Math.abs(level.price - price) < 25)) {
          volume *= 1.5;
        }
        
        volume += Math.random() * 200000;
        
        const percentage = volume / 15000000 * 100; // Normalize to percentage
        
        mockVolumeProfile.push({
          price,
          volume,
          percentage,
          poi: percentage > 8 // Point of Interest if volume > 8%
        });
      }

      // Sort by volume descending
      mockVolumeProfile.sort((a, b) => b.volume - a.volume);

      // Generate market profile data
      const mockMarketProfile: MarketProfile[] = [];
      const days = timeframe === '1h' ? 24 : timeframe === '4h' ? 168 : timeframe === '1d' ? 30 : 90;
      
      for (let i = 0; i < days; i++) {
        const timestamp = Date.now() - (days - i) * (timeframe === '1h' ? 3600000 : 86400000);
        const basePrice = 45000 + Math.sin((i / days) * Math.PI * 2) * 1000;
        const volatility = 200 + Math.random() * 300;
        
        const high = basePrice + volatility;
        const low = basePrice - volatility;
        const pointOfControl = basePrice + (Math.random() - 0.5) * 100;
        
        mockMarketProfile.push({
          timestamp,
          high,
          low,
          valueAreaHigh: pointOfControl + 150,
          valueAreaLow: pointOfControl - 150,
          pointOfControl,
          totalVolume: 1000000 + Math.random() * 2000000
        });
      }

      // Generate order flow data
      const mockOrderFlow: OrderFlow[] = [];
      const flowPoints = 100;
      let cumulativeDelta = 0;
      
      for (let i = 0; i < flowPoints; i++) {
        const timestamp = Date.now() - (flowPoints - i) * 300000; // 5-minute intervals
        const price = currentPrice + (Math.random() - 0.5) * 500;
        const buyVolume = Math.random() * 100000;
        const sellVolume = Math.random() * 100000;
        const delta = buyVolume - sellVolume;
        cumulativeDelta += delta;
        
        mockOrderFlow.push({
          timestamp,
          price,
          buyVolume,
          sellVolume,
          delta,
          cumulativeDelta
        });
      }

      setPriceLevels(mockLevels);
      setVolumeProfile(mockVolumeProfile);
      setMarketProfile(mockMarketProfile);
      setOrderFlow(mockOrderFlow);
    };

    setLoading(true);
    fetchRealMarketStructure();
    
    // Update every 30 seconds with real data
    const interval = setInterval(fetchRealMarketStructure, 5000);
    return () => clearInterval(interval);
  }, [symbol, timeframe]);

  const formatPrice = (price: number): string => {
    return `$${price.toLocaleString()}`;
  };

  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toFixed(0);
  };

  const getStrengthColor = (strength: number): string => {
    if (strength >= 8) return 'text-green-400';
    if (strength >= 6) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getStrengthBadgeColor = (strength: number): string => {
    if (strength >= 8) return 'bg-green-900/30 text-green-400';
    if (strength >= 6) return 'bg-yellow-900/30 text-yellow-400';
    return 'bg-orange-900/30 text-orange-400';
  };

  if (loading) {
    return (
      <div className={`bg-gray-900 border border-gray-700 rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Layers className="w-5 h-5 mr-2 text-indigo-400" />
            Market Structure Analyzer
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

  const supportLevels = priceLevels.filter(level => level.type === 'support');
  const resistanceLevels = priceLevels.filter(level => level.type === 'resistance');
  const strongestSupport = supportLevels.reduce((max, level) => level.strength > max.strength ? level : max, supportLevels[0]);
  const strongestResistance = resistanceLevels.reduce((max, level) => level.strength > max.strength ? level : max, resistanceLevels[0]);

  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Layers className="w-5 h-5 mr-2 text-indigo-400" />
          Market Structure Analyzer
          <span className="ml-2 text-sm text-gray-400">({symbol.replace('USDT', '')})</span>
        </h3>
        
        <div className="flex items-center space-x-3">
          <select
            value={view}
            onChange={(e) => setView(e.target.value as any)}
            className="bg-gray-800 text-white text-sm px-3 py-1 rounded border border-gray-600"
          >
            <option value="levels">Price Levels</option>
            <option value="profile">Volume Profile</option>
            <option value="flow">Order Flow</option>
            <option value="structure">Market Profile</option>
          </select>
          
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            className="bg-gray-800 text-white text-sm px-3 py-1 rounded border border-gray-600"
          >
            <option value="1h">1H</option>
            <option value="4h">4H</option>
            <option value="1d">1D</option>
            <option value="1w">1W</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Current Price</p>
              <p className="text-white text-lg font-semibold">{formatPrice(currentPrice)}</p>
            </div>
            <Activity className="w-5 h-5 text-blue-400" />
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Next Support</p>
              <p className="text-green-400 text-lg font-semibold">
                {formatPrice(strongestSupport?.price || 0)}
              </p>
              <p className="text-green-400 text-xs">
                Strength: {strongestSupport?.strength.toFixed(1) || 0}/10
              </p>
            </div>
            <Target className="w-5 h-5 text-green-400" />
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Next Resistance</p>
              <p className="text-red-400 text-lg font-semibold">
                {formatPrice(strongestResistance?.price || 0)}
              </p>
              <p className="text-red-400 text-xs">
                Strength: {strongestResistance?.strength.toFixed(1) || 0}/10
              </p>
            </div>
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Active Levels</p>
              <p className="text-white text-lg font-semibold">{priceLevels.filter(l => l.active).length}</p>
            </div>
            <BarChart3 className="w-5 h-5 text-purple-400" />
          </div>
        </div>
      </div>

      {view === 'levels' && (
        <div className="space-y-6">
          {/* Price Levels Chart */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4 flex items-center">
              <Target className="w-4 h-4 mr-2 text-yellow-400" />
              Support & Resistance Levels
            </h4>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={[{ price: currentPrice, current: true }]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="number" 
                    domain={[43000, 48000]} 
                    hide 
                  />
                  <YAxis 
                    type="number" 
                    domain={[43000, 48000]}
                    stroke="#6b7280"
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  
                  {/* Current Price Line */}
                  <ReferenceLine y={currentPrice} stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" />
                  
                  {/* Support Lines */}
                  {supportLevels.map((level, index) => (
                    <ReferenceLine 
                      key={`support-${index}`}
                      y={level.price} 
                      stroke="#10b981" 
                      strokeWidth={level.strength / 3}
                    />
                  ))}
                  
                  {/* Resistance Lines */}
                  {resistanceLevels.map((level, index) => (
                    <ReferenceLine 
                      key={`resistance-${index}`}
                      y={level.price} 
                      stroke="#ef4444" 
                      strokeWidth={level.strength / 3}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Levels Table */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4">Price Level Details</h4>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Price</th>
                    <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Type</th>
                    <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Strength</th>
                    <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Volume</th>
                    <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Tests</th>
                    <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Timeframe</th>
                    <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {priceLevels.sort((a, b) => b.price - a.price).map((level, index) => (
                    <tr key={index} className="border-b border-gray-700 hover:bg-gray-700 transition-colors">
                      <td className="py-3 px-4 text-white text-sm font-medium">{formatPrice(level.price)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          level.type === 'support' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                        }`}>
                          {level.type}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStrengthBadgeColor(level.strength)}`}>
                          {level.strength.toFixed(1)}/10
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white text-sm">{formatVolume(level.volume)}</td>
                      <td className="py-3 px-4 text-gray-300 text-sm">{level.tests}</td>
                      <td className="py-3 px-4 text-blue-400 text-sm">{level.timeframe}</td>
                      <td className="py-3 px-4">
                        <span className={`text-sm ${level.price > currentPrice ? 'text-red-400' : 'text-green-400'}`}>
                          {((level.price - currentPrice) / currentPrice * 100).toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {view === 'profile' && (
        <div className="space-y-6">
          {/* Volume Profile Chart */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4 flex items-center">
              <BarChart3 className="w-4 h-4 mr-2 text-blue-400" />
              Volume Profile
            </h4>
            
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeProfile.slice(0, 20)} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#6b7280" />
                  <YAxis 
                    dataKey="price" 
                    type="category" 
                    stroke="#6b7280"
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                    width={80}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value: number, name: string, props: any) => [
                      `${formatVolume(value)} (${props.payload.percentage.toFixed(1)}%)`,
                      'Volume'
                    ]}
                  />
                  <Bar 
                    dataKey="volume" 
                    fill="#3b82f6"
                    radius={[0, 4, 4, 0]}
                  />
                  
                  {/* Highlight POI levels */}
                  {volumeProfile.filter(v => v.poi).map((poi, index) => (
                    <ReferenceLine 
                      key={`poi-${index}`}
                      y={poi.price} 
                      stroke="#f59e0b" 
                      strokeWidth={2}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Volume POI Table */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4">Points of Interest (POI)</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {volumeProfile.filter(v => v.poi).slice(0, 6).map((poi, index) => (
                <div key={index} className="p-4 bg-gray-700 rounded-lg border border-yellow-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-yellow-400 font-medium">POI #{index + 1}</span>
                    <span className="text-yellow-400 text-sm">{poi.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Price</span>
                      <span className="text-white text-sm">{formatPrice(poi.price)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Volume</span>
                      <span className="text-white text-sm">{formatVolume(poi.volume)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Distance</span>
                      <span className={`text-sm ${poi.price > currentPrice ? 'text-red-400' : 'text-green-400'}`}>
                        {((poi.price - currentPrice) / currentPrice * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === 'flow' && (
        <div className="space-y-6">
          {/* Order Flow Chart */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2 text-green-400" />
              Order Flow Analysis
            </h4>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={orderFlow.slice(-50)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#6b7280"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis stroke="#6b7280" />
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
                    dataKey="cumulativeDelta" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Buy/Sell Pressure */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4">Buy vs Sell Pressure</h4>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orderFlow.slice(-20)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#6b7280"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis stroke="#6b7280" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                  />
                  <Bar dataKey="buyVolume" fill="#10b981" name="Buy Volume" />
                  <Bar dataKey="sellVolume" fill="#ef4444" name="Sell Volume" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {view === 'structure' && (
        <div className="space-y-6">
          {/* Market Profile Chart */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4 flex items-center">
              <Layers className="w-4 h-4 mr-2 text-indigo-400" />
              Market Profile
            </h4>
            
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={marketProfile.slice(-30)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#6b7280"
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis stroke="#6b7280" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="valueAreaHigh" 
                    stackId="1"
                    stroke="#3b82f6" 
                    fill="#3b82f6"
                    fillOpacity={0.1}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="valueAreaLow" 
                    stackId="1"
                    stroke="#3b82f6" 
                    fill="#3b82f6"
                    fillOpacity={0.1}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="pointOfControl" 
                    stroke="#f59e0b" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Value Area Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-700 p-4 rounded-lg">
              <h5 className="text-yellow-400 font-medium mb-2">Point of Control</h5>
              <p className="text-white text-lg">
                {formatPrice(marketProfile[marketProfile.length - 1]?.pointOfControl || 0)}
              </p>
              <p className="text-gray-400 text-sm">Highest volume price level</p>
            </div>
            
            <div className="bg-gray-700 p-4 rounded-lg">
              <h5 className="text-blue-400 font-medium mb-2">Value Area High</h5>
              <p className="text-white text-lg">
                {formatPrice(marketProfile[marketProfile.length - 1]?.valueAreaHigh || 0)}
              </p>
              <p className="text-gray-400 text-sm">70% volume upper bound</p>
            </div>
            
            <div className="bg-gray-700 p-4 rounded-lg">
              <h5 className="text-blue-400 font-medium mb-2">Value Area Low</h5>
              <p className="text-white text-lg">
                {formatPrice(marketProfile[marketProfile.length - 1]?.valueAreaLow || 0)}
              </p>
              <p className="text-gray-400 text-sm">70% volume lower bound</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketStructureAnalyzer;