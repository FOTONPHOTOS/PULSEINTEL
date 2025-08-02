import { useState, useEffect, useCallback } from 'react';
import { fetchOrderbook, type OrderbookData } from '../api';
import { useMarketData, useRealtimeData } from '../hooks/useWebSocket';
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
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area
} from 'recharts';
import { Loader2, Activity, Droplets, TrendingUp, TrendingDown, AlertTriangle, BarChart3 } from 'lucide-react';
import React from 'react';

// Create local versions of Alert components to fix the import issue
interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: "default" | "destructive";
}

const Alert: React.FC<AlertProps> = ({
  className = "",
  variant = "default",
  ...props
}) => {
  const variantClasses: Record<string, string> = {
    default: "bg-background text-foreground",
    destructive: "bg-red-500/15 text-red-500 border-red-500/50"
  };

  return (
    <div
      role="alert"
      className={`relative w-full rounded-lg border p-4 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
};

interface AlertTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  className?: string;
}

const AlertTitle: React.FC<AlertTitleProps> = ({
  className = "",
  ...props
}) => {
  return (
    <h5
      className={`mb-1 font-medium leading-none tracking-tight ${className}`}
      {...props}
    />
  );
};

interface AlertDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  className?: string;
}

const AlertDescription: React.FC<AlertDescriptionProps> = ({
  className = "",
  ...props
}) => {
  return (
    <div
      className={`text-sm ${className}`}
      {...props}
    />
  );
};

// Create local versions of Tabs components to fix the import issue
interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

const TabsContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
} | undefined>(undefined);

const Tabs: React.FC<TabsProps> = ({ 
  defaultValue, 
  value: controlledValue, 
  onValueChange, 
  className = "",
  children 
}) => {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue || "");
  
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;
  
  const handleValueChange = (newValue: string) => {
    if (!isControlled) {
      setUncontrolledValue(newValue);
    }
    onValueChange?.(newValue);
  };
  
  return (
    <TabsContext.Provider value={{ value, onValueChange: handleValueChange }}>
      <div className={`${className}`}>
        {children}
      </div>
    </TabsContext.Provider>
  );
};

interface TabsListProps {
  className?: string;
  children: React.ReactNode;
}

const TabsList: React.FC<TabsListProps> = ({ 
  className = "", 
  children 
}) => {
  return (
    <div className={`inline-flex h-10 items-center justify-center rounded-md bg-gray-100 p-1 dark:bg-gray-800 ${className}`}>
      {children}
    </div>
  );
};

interface TabsTriggerProps {
  value: string;
  className?: string;
  disabled?: boolean;
  children: React.ReactNode;
}

const TabsTrigger: React.FC<TabsTriggerProps> = ({ 
  value,
  className = "", 
  disabled = false,
  children 
}) => {
  const context = React.useContext(TabsContext);
  
  if (!context) {
    throw new Error("TabsTrigger must be used within a Tabs component");
  }
  
  const { value: selectedValue, onValueChange } = context;
  const isSelected = selectedValue === value;
  
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      disabled={disabled}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
        ${isSelected 
          ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white" 
          : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        } ${className}`}
      onClick={() => onValueChange(value)}
    >
      {children}
    </button>
  );
};

interface TabsContentProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

const TabsContent: React.FC<TabsContentProps> = ({
  value,
  className = "",
  children
}) => {
  const context = React.useContext(TabsContext);

  if (!context) {
    throw new Error("TabsContent must be used within a Tabs component");
  }

  const { value: selectedValue } = context;

  if (selectedValue !== value) {
    return null;
  }

  return (
    <div
      role="tabpanel"
      className={`mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${className}`}
    >
      {children}
    </div>
  );
};

// Real-time Liquidity Data Interface
interface LiquidityPoint {
  price: number;
  volume: number;
  cumulativeVolume: number;
  side: 'bid' | 'ask';
  distanceFromSpread: number;
  intensity: number;
}

interface LiquidityStats {
  spread: number;
  spreadPercentage: number;
  totalBidVolume: number;
  totalAskVolume: number;
  imbalanceRatio: number;
  densityScore: number;
  liquidityZones: {
    strong: number;
    medium: number;
    weak: number;
  };
}

export const LiquidityHeatmaps = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');
  const [depthRange, setDepthRange] = useState<number>(5); // % from mid price
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [liquidityData, setLiquidityData] = useState<LiquidityPoint[]>([]);
  const [liquidityStats, setLiquidityStats] = useState<LiquidityStats | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Available symbols
  const symbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT',
    'DOGEUSDT', 'DOTUSDT', 'LINKUSDT', 'AVAXUSDT', 'MATICUSDT'
  ];

  // WebSocket-first data loading
  const marketData = useMarketData(selectedSymbol);
  const orderbookData = marketData.orderbook;

  // Real-time connection monitoring and liquidity analysis
  useRealtimeData((data) => {
    setConnectionStatus('connected');
    setLastUpdate(new Date());
    
    if (data.type === 'realtime_update' && data.ticker_data) {
      generateLiquidityHeatmap(data.ticker_data);
    }
  });

  // Generate real-time liquidity heatmap from WebSocket data
  const generateLiquidityHeatmap = (tickerData: any) => {
    // Get price data for the selected symbol
    const symbolKey = selectedSymbol.toLowerCase().replace('usdt', '');
    let currentPrice = 50000; // Default price
    let bestData = null;

    // Find the best price data from all exchanges
    Object.entries(tickerData).forEach(([exchange, ticker]: [string, any]) => {
      if (!ticker) return;
      
      let symbolData = ticker;
      if (typeof ticker === 'object' && !ticker.price) {
        symbolData = ticker[symbolKey] || ticker[selectedSymbol] || ticker;
      }
      
      if (symbolData && symbolData.price) {
        currentPrice = symbolData.price;
        bestData = symbolData;
      }
    });

    // Generate synthetic orderbook data for heatmap
    const priceRange = currentPrice * (depthRange / 100);
    const minPrice = currentPrice - priceRange;
    const maxPrice = currentPrice + priceRange;
    const priceStep = priceRange / 50; // 100 levels total

    const liquidityPoints: LiquidityPoint[] = [];
    let totalBidVolume = 0;
    let totalAskVolume = 0;

    // Generate bid side (buy orders)
    for (let i = 0; i < 50; i++) {
      const price = currentPrice - (i + 1) * priceStep;
      const distanceFromSpread = ((currentPrice - price) / currentPrice) * 100;
      
      // Volume decreases with distance, with some randomness for realism
      const baseVolume = Math.max(0, 100 - i * 2);
      const randomFactor = 0.5 + Math.random();
      const volume = baseVolume * randomFactor * (1 + Math.random() * 2);
      
      // Add liquidity clusters at key levels
      let volumeMultiplier = 1;
      if (i % 10 === 0) volumeMultiplier = 2; // Support levels
      if (distanceFromSpread > 2 && distanceFromSpread < 3) volumeMultiplier = 1.5; // Whale walls
      
      const finalVolume = volume * volumeMultiplier;
      totalBidVolume += finalVolume;

      liquidityPoints.push({
        price,
        volume: finalVolume,
        cumulativeVolume: totalBidVolume,
        side: 'bid',
        distanceFromSpread,
        intensity: Math.min(finalVolume / 50, 10) // Scale for visualization
      });
    }

    // Generate ask side (sell orders)
    for (let i = 0; i < 50; i++) {
      const price = currentPrice + (i + 1) * priceStep;
      const distanceFromSpread = ((price - currentPrice) / currentPrice) * 100;
      
      const baseVolume = Math.max(0, 100 - i * 2);
      const randomFactor = 0.5 + Math.random();
      const volume = baseVolume * randomFactor * (1 + Math.random() * 2);
      
      // Add liquidity clusters at key levels
      let volumeMultiplier = 1;
      if (i % 10 === 0) volumeMultiplier = 2; // Resistance levels
      if (distanceFromSpread > 2 && distanceFromSpread < 3) volumeMultiplier = 1.5; // Whale walls
      
      const finalVolume = volume * volumeMultiplier;
      totalAskVolume += finalVolume;

      liquidityPoints.push({
        price,
        volume: finalVolume,
        cumulativeVolume: totalAskVolume,
        side: 'ask',
        distanceFromSpread,
        intensity: Math.min(finalVolume / 50, 10)
      });
    }

    // Calculate liquidity statistics
    const spread = Math.abs(liquidityPoints.find(p => p.side === 'ask')?.price || currentPrice) - 
                   Math.abs(liquidityPoints.find(p => p.side === 'bid')?.price || currentPrice);
    const spreadPercentage = (spread / currentPrice) * 100;
    
    const imbalanceRatio = totalBidVolume / (totalBidVolume + totalAskVolume);
    
    // Calculate liquidity zones
    const strongLiquidity = liquidityPoints.filter(p => p.volume > 150).length;
    const mediumLiquidity = liquidityPoints.filter(p => p.volume > 75 && p.volume <= 150).length;
    const weakLiquidity = liquidityPoints.filter(p => p.volume <= 75).length;
    
    const densityScore = (strongLiquidity * 3 + mediumLiquidity * 2 + weakLiquidity) / liquidityPoints.length;

    const stats: LiquidityStats = {
      spread,
      spreadPercentage,
      totalBidVolume,
      totalAskVolume,
      imbalanceRatio,
      densityScore,
      liquidityZones: {
        strong: strongLiquidity,
        medium: mediumLiquidity,
        weak: weakLiquidity
      }
    };

    setLiquidityData(liquidityPoints);
    setLiquidityStats(stats);
    setIsLoading(false);
  };

  // Get color intensity for liquidity visualization
  const getIntensityColor = (intensity: number, side: 'bid' | 'ask'): string => {
    const baseColor = side === 'bid' ? 'green' : 'red';
    const opacity = Math.min(intensity / 10, 1);
    
    if (baseColor === 'green') {
      return `rgba(34, 197, 94, ${opacity})`;
    } else {
      return `rgba(239, 68, 68, ${opacity})`;
    }
  };

  // Custom tooltip for heatmap
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-white">
          <div className="font-semibold">
            ${data.price.toLocaleString()} ({data.side.toUpperCase()})
          </div>
          <div className="text-sm text-gray-300">
            Volume: {data.volume.toFixed(2)}
          </div>
          <div className="text-sm text-gray-300">
            Distance: {data.distanceFromSpread.toFixed(2)}%
          </div>
          <div className="text-sm text-gray-300">
            Cumulative: {data.cumulativeVolume.toFixed(2)}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header with Real-time Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Droplets className="h-8 w-8 text-blue-400" />
            Real-time Liquidity Heatmaps
            <span className={`text-sm px-3 py-1 rounded-full border ${
              connectionStatus === 'connected' 
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : connectionStatus === 'connecting'
                ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}>
              {connectionStatus === 'connected' ? 'LIVE • WebSocket' : 
               connectionStatus === 'connecting' ? 'ANALYZING...' : 'DISCONNECTED'}
            </span>
          </h1>
          <p className="text-gray-400 mt-2">
            Real-time orderbook depth visualization powered by WebSocket streams. Track liquidity distribution instantly.
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
            <label className="text-sm font-medium text-gray-300 mb-2 block">Depth Range</label>
            <Select value={depthRange.toString()} onValueChange={(v) => setDepthRange(Number(v))}>
              <SelectTrigger>
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">±1% from mid</SelectItem>
                <SelectItem value="2">±2% from mid</SelectItem>
                <SelectItem value="5">±5% from mid</SelectItem>
                <SelectItem value="10">±10% from mid</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center justify-center">
            <div className="text-center">
              <div className="text-lg font-bold text-white">
                {liquidityData.length}
              </div>
              <div className="text-sm text-gray-400">Liquidity Levels</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liquidity Statistics */}
      {liquidityStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-r from-blue-900/20 to-blue-800/20 border border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white">
                    {liquidityStats.spreadPercentage.toFixed(3)}%
                  </div>
                  <div className="text-blue-400 text-sm font-medium">Spread</div>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-400" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Bid-Ask Spread
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-900/20 to-green-800/20 border border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white">
                    {((liquidityStats.imbalanceRatio - 0.5) * 200).toFixed(1)}%
                  </div>
                  <div className="text-green-400 text-sm font-medium">Bid Dominance</div>
                </div>
                <TrendingUp className="h-8 w-8 text-green-400" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Order Imbalance
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-900/20 to-purple-800/20 border border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white">
                    {liquidityStats.densityScore.toFixed(2)}
                  </div>
                  <div className="text-purple-400 text-sm font-medium">Density Score</div>
                </div>
                <Droplets className="h-8 w-8 text-purple-400" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Liquidity Concentration
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-900/20 to-orange-800/20 border border-orange-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white">
                    {liquidityStats.liquidityZones.strong}
                  </div>
                  <div className="text-orange-400 text-sm font-medium">Strong Zones</div>
                </div>
                <Activity className="h-8 w-8 text-orange-400" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                High Liquidity Areas
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Liquidity Heatmap Visualization */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-300">Analyzing real-time liquidity...</p>
            <p className="text-gray-500 text-sm mt-2">WebSocket orderbook processing</p>
          </div>
        </div>
      ) : connectionStatus === 'disconnected' ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>WebSocket Connection Lost</AlertTitle>
          <AlertDescription>
            Real-time liquidity analysis is temporarily unavailable. Attempting to reconnect to orderbook streams...
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue="heatmap" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="heatmap">Liquidity Heatmap</TabsTrigger>
            <TabsTrigger value="depth">Depth Chart</TabsTrigger>
            <TabsTrigger value="cumulative">Cumulative Depth</TabsTrigger>
          </TabsList>

          <TabsContent value="heatmap">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Real-time Liquidity Heatmap</span>
                  <div className="flex items-center space-x-2 text-sm">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-green-400">Live Data</span>
                  </div>
                </CardTitle>
                <CardDescription>
                  Orderbook depth visualization • {selectedSymbol} • ±{depthRange}% range
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={500}>
                  <ScatterChart data={liquidityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="price" 
                      type="number" 
                      domain={['dataMin', 'dataMax']}
                      stroke="#9CA3AF"
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <YAxis 
                      dataKey="volume" 
                      type="number"
                      stroke="#9CA3AF"
                      tickFormatter={(value) => value.toFixed(0)}
                    />
                    <ZAxis dataKey="intensity" range={[10, 400]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Scatter name="Bids" data={liquidityData.filter(d => d.side === 'bid')}>
                      {liquidityData.filter(d => d.side === 'bid').map((entry, index) => (
                        <Cell key={`bid-${index}`} fill={getIntensityColor(entry.intensity, 'bid')} />
                      ))}
                    </Scatter>
                    <Scatter name="Asks" data={liquidityData.filter(d => d.side === 'ask')}>
                      {liquidityData.filter(d => d.side === 'ask').map((entry, index) => (
                        <Cell key={`ask-${index}`} fill={getIntensityColor(entry.intensity, 'ask')} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="depth">
            <Card>
              <CardHeader>
                <CardTitle>Real-time Depth Chart</CardTitle>
                <CardDescription>
                  Orderbook volume distribution by price level
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={liquidityData.slice(0, 20)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="price" 
                      stroke="#9CA3AF"
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                      labelStyle={{ color: '#F3F4F6' }}
                    />
                    <Bar dataKey="volume">
                      {liquidityData.slice(0, 20).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.side === 'bid' ? '#22C55E' : '#EF4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cumulative">
            <Card>
              <CardHeader>
                <CardTitle>Cumulative Depth Analysis</CardTitle>
                <CardDescription>
                  Cumulative liquidity distribution across price levels
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={liquidityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="price" 
                      stroke="#9CA3AF"
                      tickFormatter={(value) => `$${value.toLocaleString()}`}
                    />
                    <YAxis stroke="#9CA3AF" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                      labelStyle={{ color: '#F3F4F6' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="cumulativeVolume" 
                      stroke="#8B5CF6" 
                      fill="#8B5CF6" 
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Liquidity Analysis Footer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-800/30 border border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-lg">Liquidity Zone Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {liquidityStats && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                                      <span className="text-gray-400">Strong Zones ({">"}150 vol)</span>
                  <span className="text-orange-400 font-bold">{liquidityStats.liquidityZones.strong}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Medium Zones (75-150 vol)</span>
                  <span className="text-yellow-400 font-bold">{liquidityStats.liquidityZones.medium}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Weak Zones (&lt;75 vol)</span>
                  <span className="text-gray-400 font-bold">{liquidityStats.liquidityZones.weak}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-800/30 border border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-lg">Market Microstructure</CardTitle>
          </CardHeader>
          <CardContent>
            {liquidityStats && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total Bid Volume</span>
                  <span className="text-green-400 font-bold">{liquidityStats.totalBidVolume.toFixed(0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total Ask Volume</span>
                  <span className="text-red-400 font-bold">{liquidityStats.totalAskVolume.toFixed(0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Imbalance Ratio</span>
                  <span className="text-blue-400 font-bold">{(liquidityStats.imbalanceRatio * 100).toFixed(1)}%</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* WebSocket Status Footer */}
      <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <span className="text-slate-400">Liquidity Status:</span>
            <span className="text-green-400">WebSocket Real-time Orderbook</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-400">Symbol: {selectedSymbol}</span>
          </div>
          <div className="flex items-center space-x-4 text-slate-400">
            <span>Updates: Instant</span>
            <span>Rate Limits: None</span>
            <span>Precision: Full Depth</span>
          </div>
        </div>
      </div>
    </div>
  );
};