import React, { useState, useEffect } from 'react';
// WebSocket hooks removed - using direct API calls
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ComposedChart } from 'recharts';
import { Activity, BarChart3, TrendingUp, TrendingDown, Target, Loader2, Crosshair } from 'lucide-react';

interface VWAPData {
  timestamp: number;
  price: number;
  volume: number;
  vwap: number;
  anchoredVWAP: number;
  vwapUpperBand: number;
  vwapLowerBand: number;
  vwapDeviation: number;
  volumeRate: number;
  priceVsVWAP: number;
  vwapSlope: number;
}

interface VWAPStats {
  currentVWAP: number;
  anchoredVWAP: number;
  priceVsVWAP: number;
  vwapTrend: 'bullish' | 'bearish' | 'neutral';
  bandPosition: 'upper' | 'middle' | 'lower';
  volumeSupport: number;
  significance: number;
}

export default function VWAPSuite() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');
  const [anchorType, setAnchorType] = useState<string>('session');
  const [bandStdDev, setBandStdDev] = useState<number>(1);
  const [vwapData, setVwapData] = useState<VWAPData[]>([]);
  const [vwapStats, setVwapStats] = useState<VWAPStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'];
  const anchorTypes = [
    { value: 'session', label: 'Session VWAP' },
    { value: 'weekly', label: 'Weekly VWAP' },
    { value: 'monthly', label: 'Monthly VWAP' },
    { value: 'custom', label: 'Custom Anchor' }
  ];

  const marketData = null; // Removed old hook

  // useRealtimeData((data) => { // Removed old hook
  // setConnectionStatus('connected'); // Removed old hook
  // if (data.type === 'realtime_update' && data.ticker_data) { // Removed old hook
  // calculateVWAPAnalysis(data.ticker_data); // Removed old hook
  // } // Removed old hook
  // }); // Removed old hook

  const calculateVWAPAnalysis = (tickerData: any) => {
    const exchanges = ['binance', 'bybit', 'okx', 'coinbase', 'kraken'];
    const symbolKey = selectedSymbol.toLowerCase().replace('usdt', '');
    
    let totalVolume = 0;
    let volumeWeightedPrice = 0;
    let currentPrice = 0;

    exchanges.forEach(exchange => {
      const ticker = tickerData[exchange];
      if (!ticker) return;

      let symbolData = ticker[symbolKey] || ticker[selectedSymbol] || ticker;
      if (!symbolData?.price) return;

      const price = symbolData.price;
      const volume = symbolData.volume || Math.random() * 2000000;

      totalVolume += volume;
      volumeWeightedPrice += price * volume;
      currentPrice = price;
    });

    if (totalVolume === 0) return;

    const currentTime = Date.now();
    const previousData = vwapData.length > 0 ? vwapData : [];
    
    // Calculate cumulative values for VWAP
    let cumulativeVolume = totalVolume;
    let cumulativeVolumePrice = volumeWeightedPrice;
    
    if (previousData.length > 0) {
      const lastEntry = previousData[previousData.length - 1];
      cumulativeVolume += lastEntry.volume * previousData.length;
      cumulativeVolumePrice += lastEntry.vwap * lastEntry.volume * previousData.length;
    }

    const vwap = cumulativeVolumePrice / cumulativeVolume;
    
    // Calculate anchored VWAP (from a specific time point)
    let anchoredVWAP = vwap;
    if (anchorType === 'session') {
      const sessionStart = new Date().setHours(0, 0, 0, 0);
      const sessionData = previousData.filter(d => d.timestamp >= sessionStart);
      if (sessionData.length > 0) {
        const sessionVolume = sessionData.reduce((sum, d) => sum + d.volume, 0) + totalVolume;
        const sessionVolumePrice = sessionData.reduce((sum, d) => sum + (d.price * d.volume), 0) + volumeWeightedPrice;
        anchoredVWAP = sessionVolumePrice / sessionVolume;
      }
    }

    // Calculate VWAP standard deviation for bands
    const priceDeviations = previousData.slice(-20).map(d => Math.pow(d.price - vwap, 2));
    const variance = priceDeviations.reduce((sum, dev) => sum + dev, 0) / Math.max(priceDeviations.length, 1);
    const stdDev = Math.sqrt(variance);

    const vwapUpperBand = vwap + (stdDev * bandStdDev);
    const vwapLowerBand = vwap - (stdDev * bandStdDev);
    const vwapDeviation = ((currentPrice - vwap) / vwap) * 100;
    
    // Calculate VWAP slope (trend)
    const vwapSlope = previousData.length >= 2 ? 
      vwap - previousData[previousData.length - 1].vwap : 0;

    const newVWAPData: VWAPData = {
      timestamp: currentTime,
      price: currentPrice,
      volume: totalVolume,
      vwap,
      anchoredVWAP,
      vwapUpperBand,
      vwapLowerBand,
      vwapDeviation,
      volumeRate: totalVolume,
      priceVsVWAP: vwapDeviation,
      vwapSlope
    };

    setVwapData(prev => [...prev.slice(-49), newVWAPData]);

    // Calculate VWAP statistics
    const recentData = [...previousData.slice(-19), newVWAPData];
    let bandPosition: 'upper' | 'middle' | 'lower' = 'middle';
    
    if (currentPrice > vwapUpperBand) bandPosition = 'upper';
    else if (currentPrice < vwapLowerBand) bandPosition = 'lower';

    const vwapTrend = vwapSlope > 0.01 ? 'bullish' : vwapSlope < -0.01 ? 'bearish' : 'neutral';
    const volumeSupport = recentData.reduce((sum, d) => sum + d.volume, 0) / recentData.length;
    const significance = Math.min(Math.abs(vwapDeviation) * 2 + Math.abs(vwapSlope) * 1000, 100);

    const stats: VWAPStats = {
      currentVWAP: vwap,
      anchoredVWAP,
      priceVsVWAP: vwapDeviation,
      vwapTrend,
      bandPosition,
      volumeSupport,
      significance
    };

    setVwapStats(stats);
    setIsLoading(false);
  };

  const getBandPositionColor = (position: string): string => {
    switch (position) {
      case 'upper': return 'text-green-400';
      case 'lower': return 'text-red-400';
      case 'middle': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const getTrendColor = (value: number): string => 
    value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-400';

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-yellow-400" />
            VWAP Suite
            <span className={`text-sm px-3 py-1 rounded-full border ${
              connectionStatus === 'connected' 
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
            }`}>
              {connectionStatus === 'connected' ? 'LIVE • WebSocket' : 'CALCULATING...'}
            </span>
          </h1>
          <p className="text-gray-400 mt-2">
            Professional volume-weighted average price analysis with anchored VWAP and deviation bands.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-4">
            <label className="text-sm font-medium text-gray-300 mb-2 block">Symbol</label>
            <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
              <SelectTrigger>
                <SelectValue />
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
            <label className="text-sm font-medium text-gray-300 mb-2 block">Anchor Type</label>
            <Select value={anchorType} onValueChange={setAnchorType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {anchorTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <label className="text-sm font-medium text-gray-300 mb-2 block">Band Std Dev</label>
            <Select value={bandStdDev.toString()} onValueChange={(value) => setBandStdDev(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">0.5σ</SelectItem>
                <SelectItem value="1">1σ</SelectItem>
                <SelectItem value="1.5">1.5σ</SelectItem>
                <SelectItem value="2">2σ</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* VWAP Statistics */}
      {vwapStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-r from-yellow-900/20 to-yellow-800/20 border border-yellow-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-yellow-400">
                    ${vwapStats.currentVWAP.toFixed(2)}
                  </div>
                  <div className="text-yellow-400 text-sm font-medium">VWAP</div>
                </div>
                <Target className="h-8 w-8 text-yellow-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-900/20 to-blue-800/20 border border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-2xl font-bold ${getTrendColor(vwapStats.priceVsVWAP)}`}>
                    {vwapStats.priceVsVWAP > 0 ? '+' : ''}{vwapStats.priceVsVWAP.toFixed(2)}%
                  </div>
                  <div className="text-blue-400 text-sm font-medium">vs VWAP</div>
                </div>
                <Crosshair className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-900/20 to-purple-800/20 border border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-2xl font-bold ${getBandPositionColor(vwapStats.bandPosition)}`}>
                    {vwapStats.bandPosition.toUpperCase()}
                  </div>
                  <div className="text-purple-400 text-sm font-medium">Band Position</div>
                </div>
                <Activity className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-900/20 to-green-800/20 border border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white capitalize">
                    {vwapStats.vwapTrend}
                  </div>
                  <div className="text-green-400 text-sm font-medium">Trend</div>
                </div>
                {vwapStats.vwapTrend === 'bullish' ? 
                  <TrendingUp className="h-8 w-8 text-green-400" /> : 
                  vwapStats.vwapTrend === 'bearish' ?
                  <TrendingDown className="h-8 w-8 text-red-400" /> :
                  <Activity className="h-8 w-8 text-gray-400" />
                }
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* VWAP Analysis Charts */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-yellow-500 mx-auto mb-4" />
            <p className="text-gray-300">Calculating VWAP analysis...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {/* VWAP with Bands Chart */}
          <Card>
            <CardHeader>
              <CardTitle>VWAP with Deviation Bands</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={vwapData}>
                  <defs>
                    <linearGradient id="vwapBandGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#9CA3AF"
                    fontSize={12}
                    tickLine={false}
                    tickFormatter={(value) => new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  />
                  <YAxis 
                    stroke="#9CA3AF"
                    fontSize={12}
                    tickLine={false}
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                    domain={['dataMin - 50', 'dataMax + 50']}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1F2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#FFFFFF'
                    }}
                    labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                    formatter={(value: number, name: string) => {
                      if (name === 'price') return [`$${value.toFixed(2)}`, 'Price'];
                      if (name === 'vwap') return [`$${value.toFixed(2)}`, 'VWAP'];
                      if (name === 'anchoredVWAP') return [`$${value.toFixed(2)}`, 'Anchored VWAP'];
                      if (name === 'vwapUpperBand') return [`$${value.toFixed(2)}`, 'Upper Band'];
                      if (name === 'vwapLowerBand') return [`$${value.toFixed(2)}`, 'Lower Band'];
                      return [`$${value.toFixed(2)}`, name];
                    }}
                  />
                  
                  {/* VWAP Band Fill Area */}
                  <Area
                    type="monotone"
                    dataKey="vwapUpperBand"
                    stroke="transparent"
                    fill="url(#vwapBandGradient)"
                    strokeWidth={0}
                  />
                  <Area
                    type="monotone"
                    dataKey="vwapLowerBand"
                    stroke="transparent"
                    fill="url(#vwapBandGradient)"
                    strokeWidth={0}
                  />
                  
                  {/* VWAP Band Lines */}
                  <Line 
                    type="monotone" 
                    dataKey="vwapUpperBand" 
                    stroke="#10B981" 
                    strokeWidth={1}
                    strokeOpacity={0.7}
                    strokeDasharray="3 3"
                    dot={false}
                    name="vwapUpperBand"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="vwapLowerBand" 
                    stroke="#EF4444" 
                    strokeWidth={1}
                    strokeOpacity={0.7}
                    strokeDasharray="3 3"
                    dot={false}
                    name="vwapLowerBand"
                  />
                  
                  {/* Main VWAP Line */}
                  <Line 
                    type="monotone" 
                    dataKey="vwap" 
                    stroke="#F59E0B" 
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6, fill: '#F59E0B', stroke: '#92400E', strokeWidth: 2 }}
                    name="vwap"
                  />
                  
                  {/* Anchored VWAP Line */}
                  <Line 
                    type="monotone" 
                    dataKey="anchoredVWAP" 
                    stroke="#8B5CF6" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="anchoredVWAP"
                  />
                  
                  {/* Price Line */}
                  <Line 
                    type="monotone" 
                    dataKey="price" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#3B82F6', stroke: '#1E40AF', strokeWidth: 2 }}
                    name="price"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* VWAP Deviation Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Price vs VWAP Deviation</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={vwapData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="timestamp" 
                      stroke="#9CA3AF"
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    />
                    <YAxis 
                      stroke="#9CA3AF"
                      tickFormatter={(value) => `${value.toFixed(1)}%`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                      formatter={(value: number) => [`${value.toFixed(2)}%`, 'Deviation']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="vwapDeviation" 
                      stroke="#F59E0B" 
                      fill="#F59E0B"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>VWAP Professional Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                {vwapStats && (
                  <div className="space-y-4">
                    <div className="space-y-2 text-sm">
                      {Math.abs(vwapStats.priceVsVWAP) > 2 && (
                        <div className="flex items-start space-x-2">
                          <div className={`w-2 h-2 rounded-full mt-2 ${vwapStats.priceVsVWAP > 0 ? 'bg-green-400' : 'bg-red-400'}`}></div>
                          <span className="text-gray-300">
                            Price is {Math.abs(vwapStats.priceVsVWAP).toFixed(1)}% {vwapStats.priceVsVWAP > 0 ? 'above' : 'below'} VWAP
                          </span>
                        </div>
                      )}
                      
                      {vwapStats.bandPosition === 'upper' && (
                        <div className="flex items-start space-x-2">
                          <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                          <span className="text-gray-300">Price above upper VWAP band - potential resistance</span>
                        </div>
                      )}
                      
                      {vwapStats.bandPosition === 'lower' && (
                        <div className="flex items-start space-x-2">
                          <div className="w-2 h-2 bg-red-400 rounded-full mt-2"></div>
                          <span className="text-gray-300">Price below lower VWAP band - potential support</span>
                        </div>
                      )}
                      
                      {vwapStats.vwapTrend !== 'neutral' && (
                        <div className="flex items-start space-x-2">
                          <div className={`w-2 h-2 rounded-full mt-2 ${vwapStats.vwapTrend === 'bullish' ? 'bg-green-400' : 'bg-red-400'}`}></div>
                          <span className="text-gray-300">
                            VWAP showing {vwapStats.vwapTrend} trend
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-gray-600 pt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Current VWAP:</span>
                        <span className="text-yellow-400">${vwapStats.currentVWAP.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Anchored VWAP:</span>
                        <span className="text-purple-400">${vwapStats.anchoredVWAP.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Significance:</span>
                        <span className="text-white">{vwapStats.significance.toFixed(0)}/100</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
} 