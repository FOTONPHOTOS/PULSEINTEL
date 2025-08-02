import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ReferenceLine, Cell } from 'recharts';
import { Activity, TrendingUp, TrendingDown, Zap, Target, AlertTriangle, Loader2 } from 'lucide-react';
import { subscribeToTrades, subscribeToVWAP } from '../services/WebSocketService';

interface DeltaData {
  timestamp: number;
  price: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  cumulativeDelta: number;
  deltaRate: number;
  imbalanceRatio: number;
  momentum: number;
  strength: number;
}

interface DeltaStats {
  totalDelta: number;
  avgDelta: number;
  maxDelta: number;
  minDelta: number;
  imbalancePercentage: number;
  momentum: 'bullish' | 'bearish' | 'neutral';
  strength: number;
}

export default function AdvancedDelta() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('1m');
  const [deltaData, setDeltaData] = useState<DeltaData[]>([]);
  const [deltaStats, setDeltaStats] = useState<DeltaStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'];
  const timeframes = [
    { value: '1m', label: '1 Minute' },
    { value: '5m', label: '5 Minutes' },
    { value: '15m', label: '15 Minutes' },
    { value: '1h', label: '1 Hour' }
  ];

  useEffect(() => {
    setIsLoading(true);
    setConnectionStatus('connecting');
    
    // Subscribe to real-time trades for delta analysis
    const unsubscribeTrades = subscribeToTrades(selectedSymbol, (tradeData) => {
      setConnectionStatus('connected');
      calculateDeltaAnalysis(tradeData);
    });
    
    // Subscribe to VWAP for additional context
    const unsubscribeVWAP = subscribeToVWAP(selectedSymbol, (vwapData) => {
      // Use VWAP data for enhanced delta calculations
      console.log('VWAP data for delta analysis:', vwapData);
    });
    
    return () => {
      unsubscribeTrades();
      unsubscribeVWAP();
    };
  }, [selectedSymbol]);

  const calculateDeltaAnalysis = (tradeData: any) => {
    if (!tradeData || !tradeData.price || !tradeData.quantity) return;
    
    const price = parseFloat(tradeData.price);
    const quantity = parseFloat(tradeData.quantity);
    const side = tradeData.side; // 'buy' or 'sell'
    const volume = price * quantity;
    
    // Determine buy/sell volume based on trade side
    const buyVolume = side === 'buy' ? volume : 0;
    const sellVolume = side === 'sell' ? volume : 0;
    // Update running totals for delta calculation
    const currentDelta = buyVolume - sellVolume;
    
    // Get previous data for cumulative calculations
    const previousData = deltaData.length > 0 ? deltaData[deltaData.length - 1] : null;
    const cumulativeDelta = (previousData?.cumulativeDelta || 0) + currentDelta;
    const deltaRate = previousData ? currentDelta - previousData.delta : 0;
    const momentum = previousData ? price - previousData.price : 0;
    
    // Calculate imbalance ratio based on recent trades
    const recentTrades = deltaData.slice(-10);
    const recentBuyVolume = recentTrades.reduce((sum, d) => sum + d.buyVolume, 0) + buyVolume;
    const recentSellVolume = recentTrades.reduce((sum, d) => sum + d.sellVolume, 0) + sellVolume;
    const imbalanceRatio = recentBuyVolume / (recentBuyVolume + recentSellVolume);
    
    const strength = Math.min(Math.abs(currentDelta / Math.max(volume, 1000)) * 100, 100);

    const newDeltaData: DeltaData = {
      timestamp: Date.now(),
      price: price,
      buyVolume: buyVolume,
      sellVolume: sellVolume,
      delta: currentDelta,
      cumulativeDelta,
      deltaRate,
      imbalanceRatio,
      momentum,
      strength
    };

    setDeltaData(prev => [...prev.slice(-49), newDeltaData]);
    
    // Calculate statistics from recent data
    const recentData = [...deltaData.slice(-19), newDeltaData];
    const stats: DeltaStats = {
      totalDelta: cumulativeDelta,
      avgDelta: recentData.reduce((sum, d) => sum + d.delta, 0) / recentData.length,
      maxDelta: Math.max(...recentData.map(d => d.delta)),
      minDelta: Math.min(...recentData.map(d => d.delta)),
      imbalancePercentage: (imbalanceRatio - 0.5) * 200,
      momentum: momentum > 100 ? 'bullish' : momentum < -100 ? 'bearish' : 'neutral',
      strength: recentData.reduce((sum, d) => sum + d.strength, 0) / recentData.length
    };

    setDeltaStats(stats);
    setIsLoading(false);
  };

  const getTrendColor = (value: number): string => 
    value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-400';

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Zap className="h-8 w-8 text-orange-400" />
            Advanced Delta Analysis
            <span className={`text-sm px-3 py-1 rounded-full border ${
              connectionStatus === 'connected' 
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
            }`}>
              {connectionStatus === 'connected' ? 'LIVE • WebSocket' : 'CALCULATING...'}
            </span>
          </h1>
          <p className="text-gray-400 mt-2">
            Real-time order flow imbalance tracking with institutional-grade delta momentum analysis.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            <label className="text-sm font-medium text-gray-300 mb-2 block">Timeframe</label>
            <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
              <SelectTrigger>
                <SelectValue />
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
      </div>

      {/* Delta Statistics */}
      {deltaStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-r from-blue-900/20 to-blue-800/20 border border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-2xl font-bold ${getTrendColor(deltaStats.totalDelta)}`}>
                    {(deltaStats.totalDelta / 1000000).toFixed(2)}M
                  </div>
                  <div className="text-blue-400 text-sm font-medium">Cumulative Δ</div>
                </div>
                <Target className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-900/20 to-green-800/20 border border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-2xl font-bold ${getTrendColor(deltaStats.imbalancePercentage)}`}>
                    {deltaStats.imbalancePercentage > 0 ? '+' : ''}{deltaStats.imbalancePercentage.toFixed(1)}%
                  </div>
                  <div className="text-green-400 text-sm font-medium">Imbalance</div>
                </div>
                {deltaStats.imbalancePercentage >= 0 ? 
                  <TrendingUp className="h-8 w-8 text-green-400" /> : 
                  <TrendingDown className="h-8 w-8 text-red-400" />
                }
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-900/20 to-purple-800/20 border border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white capitalize">
                    {deltaStats.momentum}
                  </div>
                  <div className="text-purple-400 text-sm font-medium">Momentum</div>
                </div>
                <Activity className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-900/20 to-orange-800/20 border border-orange-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-orange-400">
                    {deltaStats.strength.toFixed(0)}
                  </div>
                  <div className="text-orange-400 text-sm font-medium">Strength</div>
                </div>
                <Zap className="h-8 w-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delta Analysis Charts */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-orange-500 mx-auto mb-4" />
            <p className="text-gray-300">Calculating delta analysis...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cumulative Delta Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Cumulative Delta Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={deltaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#9CA3AF"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis 
                    stroke="#9CA3AF"
                    tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                    labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                    formatter={(value: number) => [`${(value / 1000000).toFixed(2)}M`, 'Cumulative Δ']}
                  />
                  <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="2 2" />
                  <Line 
                    type="monotone" 
                    dataKey="cumulativeDelta" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Delta Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Delta Per Period</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={deltaData.slice(-20)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#9CA3AF"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis 
                    stroke="#9CA3AF"
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                    formatter={(value: number) => [`${(value / 1000).toFixed(0)}K`, 'Delta']}
                  />
                  <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="2 2" />
                  <Bar dataKey="delta">
                    {deltaData.slice(-20).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.delta > 0 ? '#22C55E' : '#EF4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Professional Analysis */}
      {deltaStats && (
        <Card>
          <CardHeader>
            <CardTitle>Professional Delta Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-white">Order Flow Analysis</h4>
                <div className="space-y-2 text-sm">
                  {Math.abs(deltaStats.imbalancePercentage) > 10 && (
                    <div className="flex items-start space-x-2">
                      <div className={`w-2 h-2 rounded-full mt-2 ${deltaStats.imbalancePercentage > 0 ? 'bg-green-400' : 'bg-red-400'}`}></div>
                      <span className="text-gray-300">
                        Strong {deltaStats.imbalancePercentage > 0 ? 'buying' : 'selling'} pressure detected
                      </span>
                    </div>
                  )}
                  {deltaStats.strength > 70 && (
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-orange-400 rounded-full mt-2"></div>
                      <span className="text-gray-300">High-conviction institutional activity</span>
                    </div>
                  )}
                  {deltaStats.momentum !== 'neutral' && (
                    <div className="flex items-start space-x-2">
                      <div className={`w-2 h-2 rounded-full mt-2 ${deltaStats.momentum === 'bullish' ? 'bg-green-400' : 'bg-red-400'}`}></div>
                      <span className="text-gray-300">
                        {deltaStats.momentum === 'bullish' ? 'Bullish' : 'Bearish'} momentum in delta flow
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-white">Trading Signals</h4>
                <div className="space-y-2 text-sm">
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded">
                    <div className="font-medium text-blue-400">
                      Cumulative Δ: {(deltaStats.totalDelta / 1000000).toFixed(2)}M
                    </div>
                    <div className="text-gray-400 text-xs mt-1">
                      Overall order flow bias indicator
                    </div>
                  </div>
                  <div className={`p-3 border rounded ${
                    Math.abs(deltaStats.imbalancePercentage) > 15 
                      ? 'bg-red-500/10 border-red-500/20' 
                      : 'bg-green-500/10 border-green-500/20'
                  }`}>
                    <div className={`font-medium ${
                      Math.abs(deltaStats.imbalancePercentage) > 15 ? 'text-red-400' : 'text-green-400'
                    }`}>
                      Imbalance: {deltaStats.imbalancePercentage.toFixed(1)}%
                    </div>
                    <div className="text-gray-400 text-xs mt-1">
                      {Math.abs(deltaStats.imbalancePercentage) > 15 ? 'Extreme' : 'Moderate'} order flow imbalance
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 