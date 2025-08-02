import React, { useState, useEffect } from 'react';
import { subscribeToTrades, subscribeToVWAP } from '../services/WebSocketService';
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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ReferenceLine,
  Cell
} from 'recharts';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  Loader2, 
  AlertTriangle,
  Zap,
  Target,
  DollarSign,
  Clock
} from 'lucide-react';

// CVD Data Interfaces
interface CVDData {
  timestamp: number;
  price: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  cumulativeDelta: number;
  deltaPercentage: number;
  volumeRate: number;
  deltaSlope: number;
  divergenceSignal: 'bullish' | 'bearish' | 'neutral';
  strength: number; // 0-100
}

interface CVDStats {
  totalCVD: number;
  deltaSum24h: number;
  averageDelta: number;
  maxDelta: number;
  minDelta: number;
  deltaSlope: number;
  volumeAcceleration: number;
  divergenceCount: number;
  bullishSignals: number;
  bearishSignals: number;
}

interface CVDAlert {
  id: string;
  type: 'divergence' | 'spike' | 'exhaustion' | 'acceleration';
  message: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cvdValue: number;
  priceValue: number;
}

interface CVDTimeframe {
  period: string;
  data: CVDData[];
  stats: CVDStats;
  lastUpdate: number;
}

export default function CVD() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('5m');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [cvdTimeframes, setCvdTimeframes] = useState<Record<string, CVDTimeframe>>({});
  const [cvdAlerts, setCvdAlerts] = useState<CVDAlert[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Available symbols for CVD analysis
  const symbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT',
    'DOGEUSDT', 'DOTUSDT', 'LINKUSDT', 'AVAXUSDT', 'MATICUSDT'
  ];

  // Available timeframes for CVD analysis
  const timeframes = [
    { value: '1m', label: '1 Minute' },
    { value: '5m', label: '5 Minutes' },
    { value: '15m', label: '15 Minutes' },
    { value: '1h', label: '1 Hour' },
    { value: '4h', label: '4 Hours' },
    { value: '1d', label: '1 Day' }
  ];

  // Exchanges for CVD calculation
  const exchanges = ['binance', 'bybit', 'okx', 'coinbase', 'kraken', 'bitget'];

  useEffect(() => {
    setConnectionStatus('connecting');
    setIsLoading(true);
    
    // Subscribe to real-time trades for CVD calculation
    const unsubscribeTrades = subscribeToTrades(selectedSymbol, (tradeData) => {
      setConnectionStatus('connected');
      setLastUpdate(new Date());
      calculateCVDAnalysis(tradeData);
    });
    
    // Subscribe to VWAP for additional context
    const unsubscribeVWAP = subscribeToVWAP(selectedSymbol, (vwapData) => {
      console.log('VWAP data for CVD analysis:', vwapData);
    });
    
    return () => {
      unsubscribeTrades();
      unsubscribeVWAP();
    };
  }, [selectedSymbol, selectedTimeframe]);

  // Advanced CVD calculation engine
  const calculateCVDAnalysis = (tradeData: any) => {
    if (!tradeData || !tradeData.price || !tradeData.quantity) return;
    
    const currentTime = Date.now();
    const price = parseFloat(tradeData.price);
    const quantity = parseFloat(tradeData.quantity);
    const side = tradeData.side; // 'buy' or 'sell'
    const volume = price * quantity;
    
    // Determine buy/sell volume based on trade side
    const buyVolume = side === 'buy' ? volume : 0;
    const sellVolume = side === 'sell' ? volume : 0;
    
    // Calculate delta and CVD metrics
    const currentDelta = buyVolume - sellVolume;
    const deltaPercentage = volume > 0 ? (currentDelta / volume) * 100 : 0;
    const volumeRate = volume; // Volume per time period
    
    // Get previous CVD data for calculations
    const currentTimeframe = cvdTimeframes[selectedTimeframe];
    const previousData = currentTimeframe?.data || [];
    
    // Calculate cumulative delta
    const previousCVD = previousData.length > 0 ? previousData[previousData.length - 1].cumulativeDelta : 0;
    const cumulativeDelta = previousCVD + currentDelta;
    
    // Calculate delta slope (rate of change)
    const deltaSlope = previousData.length >= 2 ? 
      currentDelta - previousData[previousData.length - 1].delta : 0;
    
    // Detect divergence signals
    const priceChange = previousData.length > 0 ? 
      price - previousData[previousData.length - 1].price : 0;
    const cvdChange = currentDelta - (previousData.length > 0 ? previousData[previousData.length - 1].delta : 0);
    
    let divergenceSignal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (priceChange > 0 && cvdChange < 0) {
      divergenceSignal = 'bearish'; // Price up, CVD down = bearish divergence
    } else if (priceChange < 0 && cvdChange > 0) {
      divergenceSignal = 'bullish'; // Price down, CVD up = bullish divergence
    }
    
    // Calculate signal strength
    const strength = Math.min(Math.abs(deltaPercentage) * 2 + Math.abs(deltaSlope) / 1000, 100);

    // Create new CVD data point
    const newCVDData: CVDData = {
      timestamp: currentTime,
      price: price,
      buyVolume: buyVolume,
      sellVolume: sellVolume,
      delta: currentDelta,
      cumulativeDelta,
      deltaPercentage,
      volumeRate,
      deltaSlope,
      divergenceSignal,
      strength
    };

    // Update timeframe data
    timeframes.forEach(tf => {
      const period = tf.value;
      const periodMs = getPeriodMs(period);
      
      // Filter data for timeframe
      const cutoffTime = currentTime - (50 * periodMs); // Keep 50 periods
      const filteredData = [...(cvdTimeframes[period]?.data || []), newCVDData]
        .filter(d => d.timestamp > cutoffTime)
        .slice(-100); // Limit to 100 data points

      // Calculate timeframe statistics
      const stats = calculateCVDStats(filteredData);
      
      // Update timeframe data
      setCvdTimeframes(prev => ({
        ...prev,
        [period]: {
          period,
          data: filteredData,
          stats,
          lastUpdate: currentTime
        }
      }));
    });

    // Generate CVD alerts
    generateCVDAlerts(newCVDData, previousData);
    
    setIsLoading(false);
  };

  // Calculate CVD statistics
  const calculateCVDStats = (data: CVDData[]): CVDStats => {
    if (data.length === 0) {
      return {
        totalCVD: 0,
        deltaSum24h: 0,
        averageDelta: 0,
        maxDelta: 0,
        minDelta: 0,
        deltaSlope: 0,
        volumeAcceleration: 0,
        divergenceCount: 0,
        bullishSignals: 0,
        bearishSignals: 0
      };
    }

    const totalCVD = data[data.length - 1]?.cumulativeDelta || 0;
    const deltaSum24h = data.reduce((sum, d) => sum + d.delta, 0);
    const averageDelta = deltaSum24h / data.length;
    const maxDelta = Math.max(...data.map(d => d.delta));
    const minDelta = Math.min(...data.map(d => d.delta));
    
    // Calculate slope trend
    const recentData = data.slice(-10);
    const deltaSlope = recentData.length >= 2 ?
      recentData[recentData.length - 1].delta - recentData[0].delta : 0;
    
    // Calculate volume acceleration
    const volumeAcceleration = recentData.length >= 2 ?
      recentData[recentData.length - 1].volumeRate - recentData[0].volumeRate : 0;
    
    // Count divergence signals
    const divergenceCount = data.filter(d => d.divergenceSignal !== 'neutral').length;
    const bullishSignals = data.filter(d => d.divergenceSignal === 'bullish').length;
    const bearishSignals = data.filter(d => d.divergenceSignal === 'bearish').length;

    return {
      totalCVD,
      deltaSum24h,
      averageDelta,
      maxDelta,
      minDelta,
      deltaSlope,
      volumeAcceleration,
      divergenceCount,
      bullishSignals,
      bearishSignals
    };
  };

  // Generate CVD alerts
  const generateCVDAlerts = (newData: CVDData, previousData: CVDData[]) => {
    const alerts: CVDAlert[] = [];
    const currentTime = newData.timestamp;

    // Divergence alert
    if (newData.divergenceSignal !== 'neutral') {
      alerts.push({
        id: `divergence-${currentTime}`,
        type: 'divergence',
        message: `📊 CVD DIVERGENCE: ${newData.divergenceSignal.toUpperCase()} divergence detected - Price vs Volume Delta conflict`,
        timestamp: currentTime,
        severity: newData.strength > 70 ? 'critical' : newData.strength > 40 ? 'high' : 'medium',
        cvdValue: newData.cumulativeDelta,
        priceValue: newData.price
      });
    }

    // Delta spike alert
    if (Math.abs(newData.deltaPercentage) > 15) {
      alerts.push({
        id: `spike-${currentTime}`,
        type: 'spike',
        message: `⚡ DELTA SPIKE: ${newData.deltaPercentage > 0 ? 'BUY' : 'SELL'} delta spike of ${Math.abs(newData.deltaPercentage).toFixed(1)}%`,
        timestamp: currentTime,
        severity: Math.abs(newData.deltaPercentage) > 25 ? 'critical' : 'high',
        cvdValue: newData.delta,
        priceValue: newData.price
      });
    }

    // Delta acceleration alert
    if (Math.abs(newData.deltaSlope) > 10000) {
      alerts.push({
        id: `acceleration-${currentTime}`,
        type: 'acceleration',
        message: `🚀 DELTA ACCELERATION: ${newData.deltaSlope > 0 ? 'Increasing' : 'Decreasing'} buying pressure acceleration`,
        timestamp: currentTime,
        severity: 'medium',
        cvdValue: newData.deltaSlope,
        priceValue: newData.price
      });
    }

    // CVD exhaustion alert
    if (previousData.length >= 5) {
      const recentDeltas = previousData.slice(-5).map(d => d.delta);
      const allSameDirection = recentDeltas.every(d => d > 0) || recentDeltas.every(d => d < 0);
      const decreasingMagnitude = Math.abs(newData.delta) < Math.abs(previousData[previousData.length - 1].delta);
      
      if (allSameDirection && decreasingMagnitude) {
        alerts.push({
          id: `exhaustion-${currentTime}`,
          type: 'exhaustion',
          message: `🔄 CVD EXHAUSTION: Weakening ${newData.delta > 0 ? 'buying' : 'selling'} pressure - potential reversal`,
          timestamp: currentTime,
          severity: 'medium',
          cvdValue: newData.delta,
          priceValue: newData.price
        });
      }
    }

    // Update alerts (keep last 20)
    setCvdAlerts(prev => {
      const combined = [...alerts, ...prev];
      return combined.slice(0, 20);
    });
  };

  // Helper function to convert timeframe to milliseconds
  const getPeriodMs = (period: string): number => {
    const periodMap: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return periodMap[period] || 60 * 1000;
  };

  // Get current timeframe data
  const currentTimeframe = cvdTimeframes[selectedTimeframe];
  const cvdData = currentTimeframe?.data || [];
  const cvdStats = currentTimeframe?.stats;

  // Get trend color
  const getTrendColor = (value: number): string => {
    return value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-400';
  };

  // Get divergence color
  const getDivergenceColor = (signal: string): string => {
    switch (signal) {
      case 'bullish': return 'text-green-400 bg-green-500/20';
      case 'bearish': return 'text-red-400 bg-red-500/20';
      case 'neutral': return 'text-gray-400 bg-gray-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  // Get alert severity color
  const getAlertColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'border-l-red-500 bg-red-500/10';
      case 'high': return 'border-l-orange-500 bg-orange-500/10';
      case 'medium': return 'border-l-yellow-500 bg-yellow-500/10';
      case 'low': return 'border-l-blue-500 bg-blue-500/10';
      default: return 'border-l-gray-500 bg-gray-500/10';
    }
  };

  return (
    <div className="h-full w-full bg-gray-900/50 relative">
      <div className="space-y-6 p-6 max-w-7xl mx-auto overflow-y-auto">
        {/* Header with Real-time Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-blue-400" />
            CVD (Cumulative Volume Delta)
            <span className={`text-sm px-3 py-1 rounded-full border ${
              connectionStatus === 'connected' 
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : connectionStatus === 'connecting'
                ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}>
              {connectionStatus === 'connected' ? 'LIVE • WebSocket' : 
               connectionStatus === 'connecting' ? 'CALCULATING...' : 'DISCONNECTED'}
            </span>
          </h1>
          <p className="text-gray-400 mt-2">
            Professional order flow analysis with real-time CVD tracking. Monitor institutional buying vs selling pressure instantly.
          </p>
        </div>
        
        <div className="flex items-center space-x-2 text-sm text-gray-400">
          <Activity className="h-4 w-4" />
          <span>Last Update: {lastUpdate.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      </div>

      {/* CVD Statistics */}
      {cvdStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-r from-blue-900/20 to-blue-800/20 border border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-2xl font-bold ${getTrendColor(cvdStats.totalCVD)}`}>
                    {(cvdStats.totalCVD / 1000000).toFixed(2)}M
                  </div>
                  <div className="text-blue-400 text-sm font-medium">Total CVD</div>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-400" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Cumulative volume delta
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-900/20 to-green-800/20 border border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-2xl font-bold ${getTrendColor(cvdStats.deltaSlope)}`}>
                    {cvdStats.deltaSlope > 0 ? '+' : ''}{(cvdStats.deltaSlope / 1000).toFixed(1)}K
                  </div>
                  <div className="text-green-400 text-sm font-medium">Delta Slope</div>
                </div>
                {cvdStats.deltaSlope >= 0 ? 
                  <TrendingUp className="h-8 w-8 text-green-400" /> : 
                  <TrendingDown className="h-8 w-8 text-red-400" />
                }
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Rate of delta change
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-900/20 to-purple-800/20 border border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white">
                    {cvdStats.divergenceCount}
                  </div>
                  <div className="text-purple-400 text-sm font-medium">Divergences</div>
                </div>
                <Target className="h-8 w-8 text-purple-400" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                {cvdStats.bullishSignals}B / {cvdStats.bearishSignals}B signals
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-yellow-900/20 to-yellow-800/20 border border-yellow-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-2xl font-bold ${getTrendColor(cvdStats.averageDelta)}`}>
                    {(Math.abs(cvdStats.averageDelta) / 1000).toFixed(1)}K
                  </div>
                  <div className="text-yellow-400 text-sm font-medium">Avg Delta</div>
                </div>
                <DollarSign className="h-8 w-8 text-yellow-400" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Average delta per period
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CVD Alerts */}
      {cvdAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Live CVD Alerts
            </CardTitle>
            <CardDescription>
              Real-time notifications for CVD divergences and significant delta movements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {cvdAlerts.slice(0, 10).map((alert) => (
                <div 
                  key={alert.id}
                  className={`border-l-4 p-4 rounded-r-lg ${getAlertColor(alert.severity)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-white font-medium">{alert.message}</p>
                      <p className="text-gray-400 text-sm mt-1">
                        {new Date(alert.timestamp).toLocaleTimeString()} • CVD: {(alert.cvdValue / 1000).toFixed(0)}K • Price: ${alert.priceValue.toFixed(2)}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      alert.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                      alert.severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                      alert.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {alert.severity.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CVD Analysis */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-300">Calculating real-time CVD...</p>
            <p className="text-gray-500 text-sm mt-2">WebSocket order flow analysis</p>
          </div>
        </div>
      ) : connectionStatus === 'disconnected' ? (
        <div className="bg-red-500/15 text-red-500 border border-red-500/50 relative w-full rounded-lg border p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2" />
            <div>
              <h5 className="mb-1 font-medium leading-none tracking-tight">WebSocket Connection Lost</h5>
              <div className="text-sm">
                Real-time CVD analysis is temporarily unavailable. Attempting to reconnect to order flow streams...
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CVD Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Real-time CVD Analysis</span>
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-green-400">Live</span>
                </div>
              </CardTitle>
              <CardDescription>
                Cumulative Volume Delta with price overlay • {selectedTimeframe} • {cvdData.length} data points
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={500}>
                <LineChart data={cvdData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="timestamp" 
                    stroke="#9CA3AF"
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                  />
                  <YAxis 
                    yAxisId="cvd"
                    stroke="#3B82F6"
                    tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                  />
                  <YAxis 
                    yAxisId="price"
                    orientation="right"
                    stroke="#F59E0B"
                    tickFormatter={(value) => `$${value.toFixed(0)}`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                    labelStyle={{ color: '#F3F4F6' }}
                    labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                    formatter={(value: number, name: string) => {
                      if (name === 'cumulativeDelta') return [`${(value / 1000000).toFixed(2)}M`, 'CVD'];
                      if (name === 'price') return [`$${value.toFixed(2)}`, 'Price'];
                      if (name === 'delta') return [`${(value / 1000).toFixed(0)}K`, 'Delta'];
                      return [value, name];
                    }}
                  />
                  <ReferenceLine y={0} yAxisId="cvd" stroke="#6B7280" strokeDasharray="2 2" />
                  
                  {/* CVD Line */}
                  <Line 
                    yAxisId="cvd"
                    type="monotone" 
                    dataKey="cumulativeDelta" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    dot={false}
                    name="cumulativeDelta"
                  />
                  
                  {/* Price Line */}
                  <Line 
                    yAxisId="price"
                    type="monotone" 
                    dataKey="price" 
                    stroke="#F59E0B" 
                    strokeWidth={2}
                    dot={false}
                    name="price"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Delta Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Delta Per Period</CardTitle>
              <CardDescription>
                Buy vs Sell delta for each time period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={cvdData.slice(-20)}>
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
                    labelFormatter={(value) => new Date(value).toLocaleTimeString()}
                    formatter={(value: number) => [`${(value / 1000).toFixed(0)}K`, 'Delta']}
                  />
                  <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="2 2" />
                  <Bar dataKey="delta">
                    {cvdData.slice(-20).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.delta > 0 ? '#22C55E' : '#EF4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Divergence Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Divergence Signals</CardTitle>
              <CardDescription>
                Recent price vs CVD divergence patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cvdData.slice(-10).reverse().map((data, index) => (
                  <div key={data.timestamp} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="text-sm text-gray-400">
                        {new Date(data.timestamp).toLocaleTimeString()}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getDivergenceColor(data.divergenceSignal)}`}>
                        {data.divergenceSignal.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-medium">${data.price.toFixed(2)}</div>
                      <div className={`text-sm ${getTrendColor(data.delta)}`}>
                        Δ: {(data.delta / 1000).toFixed(0)}K
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CVD Insights */}
      {cvdStats && (
        <Card>
          <CardHeader>
            <CardTitle>CVD Professional Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-3">
                <h4 className="font-semibold text-white">Volume Flow Analysis</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">24h Delta Sum:</span>
                    <span className={getTrendColor(cvdStats.deltaSum24h)}>
                      {(cvdStats.deltaSum24h / 1000000).toFixed(2)}M
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Max Delta:</span>
                    <span className="text-green-400">{(cvdStats.maxDelta / 1000).toFixed(0)}K</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Min Delta:</span>
                    <span className="text-red-400">{(cvdStats.minDelta / 1000).toFixed(0)}K</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-white">Momentum Analysis</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Delta Acceleration:</span>
                    <span className={getTrendColor(cvdStats.volumeAcceleration)}>
                      {cvdStats.volumeAcceleration > 0 ? 'INCREASING' : 'DECREASING'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Trend Strength:</span>
                    <span className="text-blue-400">
                      {Math.abs(cvdStats.deltaSlope) > 5000 ? 'STRONG' :
                       Math.abs(cvdStats.deltaSlope) > 1000 ? 'MODERATE' : 'WEAK'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Signal Quality:</span>
                    <span className="text-yellow-400">
                      {cvdStats.divergenceCount > 3 ? 'HIGH' :
                       cvdStats.divergenceCount > 1 ? 'MEDIUM' : 'LOW'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-white">Trading Signals</h4>
                <div className="space-y-2 text-sm">
                  {cvdStats.deltaSlope > 5000 && (
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                      <span className="text-gray-300">Strong buying pressure acceleration detected.</span>
                    </div>
                  )}
                  {cvdStats.deltaSlope < -5000 && (
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-red-400 rounded-full mt-2"></div>
                      <span className="text-gray-300">Strong selling pressure acceleration detected.</span>
                    </div>
                  )}
                  {cvdStats.bullishSignals > cvdStats.bearishSignals && (
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
                      <span className="text-gray-300">Bullish divergence pattern dominance.</span>
                    </div>
                  )}
                  {cvdStats.divergenceCount === 0 && (
                    <div className="flex items-start space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full mt-2"></div>
                      <span className="text-gray-300">Price and volume in sync - no divergences.</span>
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
            <span className="text-slate-400">CVD Analysis:</span>
            <span className="text-green-400">WebSocket Real-time Order Flow</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-400">Symbol: {selectedSymbol}</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-400">Timeframe: {selectedTimeframe}</span>
          </div>
          <div className="flex items-center space-x-4 text-slate-400">
            <span>Updates: Instant</span>
            <span>Divergence Detection: AI</span>
            <span>Exchanges: {exchanges.length}</span>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
} 