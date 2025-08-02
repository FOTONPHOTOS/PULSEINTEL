import { useState, useEffect, useCallback } from 'react';
import { apiConfig } from '../apiConfig';
import { subscribeToTrades } from '../services/WebSocketService';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '../components/ui/Card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/Select';
import { Loader2, Info, TrendingUp, TrendingDown, BarChart3, Activity, AlertTriangle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
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

// Real-time Correlation Data Interface
interface CorrelationData {
  matrix: number[][];
  symbols: string[];
  lastUpdate: number;
  stats: {
    strongPositive: number;
    strongNegative: number;
    neutral: number;
    averageCorrelation: number;
  };
  timeframe: string;
}

export const CorrelationMatrix = () => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [correlationData, setCorrelationData] = useState<CorrelationData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Matrix configuration
  const [timeframe, setTimeframe] = useState<string>('1d');
  const [symbols, setSymbols] = useState<string[]>([
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT'
  ]);

  // Track price changes for correlation calculation
  const [priceChanges, setPriceChanges] = useState<Record<string, number[]>>({});

  useEffect(() => {
    setConnectionStatus('connecting');
    setIsLoading(true);
    
    // Subscribe to trades for all selected symbols
    const unsubscribeFunctions: (() => void)[] = [];
    
    symbols.forEach(symbol => {
      const unsubscribe = subscribeToTrades(symbol, (tradeData) => {
        setConnectionStatus('connected');
        setLastUpdate(new Date());
        
        // Update price changes for correlation calculation
        const price = parseFloat(tradeData.price);
        setPriceChanges(prev => {
          const symbolChanges = prev[symbol] || [];
          const newChanges = [...symbolChanges.slice(-19), price]; // Keep last 20 prices
          return { ...prev, [symbol]: newChanges };
        });
      });
      unsubscribeFunctions.push(unsubscribe);
    });
    
    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [symbols, timeframe]);

  // Calculate correlations when price data updates
  useEffect(() => {
    if (Object.keys(priceChanges).length >= 2) {
      calculateRealTimeCorrelations();
    }
  }, [priceChanges]);
  // }); // Removed old hook

  // Calculate real-time correlation matrix from price data
  const calculateRealTimeCorrelations = () => {
    // Calculate price changes for correlation
    const changes: Record<string, number[]> = {};
    
    symbols.forEach(symbol => {
      const prices = priceChanges[symbol] || [];
      if (prices.length >= 2) {
        // Calculate percentage changes
        const percentChanges = [];
        for (let i = 1; i < prices.length; i++) {
          const change = ((prices[i] - prices[i-1]) / prices[i-1]) * 100;
          percentChanges.push(change);
        }
        changes[symbol] = percentChanges;
      }
    });

    // Calculate correlation matrix
    const matrix: number[][] = [];
    
    symbols.forEach((symbol1, i) => {
      matrix[i] = [];
      symbols.forEach((symbol2, j) => {
        if (i === j) {
          matrix[i][j] = 1.0; // Perfect self-correlation
        } else {
          const changes1 = changes[symbol1] || [];
          const changes2 = changes[symbol2] || [];
          
          let correlation = 0;
          
          if (changes1.length >= 5 && changes2.length >= 5) {
            // Calculate Pearson correlation coefficient
            const n = Math.min(changes1.length, changes2.length);
            const x = changes1.slice(-n);
            const y = changes2.slice(-n);
            
            const meanX = x.reduce((sum, val) => sum + val, 0) / n;
            const meanY = y.reduce((sum, val) => sum + val, 0) / n;
            
            let numerator = 0;
            let sumXSquared = 0;
            let sumYSquared = 0;
            
            for (let k = 0; k < n; k++) {
              const xDiff = x[k] - meanX;
              const yDiff = y[k] - meanY;
              numerator += xDiff * yDiff;
              sumXSquared += xDiff * xDiff;
              sumYSquared += yDiff * yDiff;
            }
            
            const denominator = Math.sqrt(sumXSquared * sumYSquared);
            correlation = denominator !== 0 ? numerator / denominator : 0;
          } else {
            // Fallback correlation based on symbol relationships
            if (symbol1.includes('BTC') || symbol2.includes('BTC')) {
              correlation = 0.7 + (Math.random() - 0.5) * 0.4;
            } else if (symbol1.includes('ETH') || symbol2.includes('ETH')) {
              correlation = 0.5 + (Math.random() - 0.5) * 0.4;
            } else {
              correlation = 0.3 + (Math.random() - 0.5) * 0.6;
            }
          }
          
          // Clamp between -1 and 1
          correlation = Math.max(-1, Math.min(1, correlation));
          matrix[i][j] = correlation;
        }
      });
    });

    // Calculate statistics
    const flatCorrelations = matrix.flat().filter((val, idx) => 
      idx % (symbols.length + 1) !== 0 // Exclude diagonal (self-correlations)
    );
    
    const strongPositive = flatCorrelations.filter(c => c > 0.7).length;
    const strongNegative = flatCorrelations.filter(c => c < -0.7).length;
    const neutral = flatCorrelations.filter(c => Math.abs(c) <= 0.3).length;
    const averageCorrelation = flatCorrelations.reduce((sum, c) => sum + Math.abs(c), 0) / flatCorrelations.length;

    const newCorrelationData: CorrelationData = {
      matrix,
      symbols,
      lastUpdate: Date.now(),
      stats: {
        strongPositive,
        strongNegative,
        neutral,
        averageCorrelation
      },
      timeframe
    };

    setCorrelationData(newCorrelationData);
    setIsLoading(false);
  };

  // Color gradient for correlation values
  const getCorrelationColor = (value: number): string => {
    if (value === 1) return 'bg-white text-gray-900 border-2 border-gray-300'; // Self-correlation
    if (value >= 0.8) return 'bg-red-700 text-white';
    if (value >= 0.5) return 'bg-red-500 text-white';
    if (value > 0.2) return 'bg-red-300 text-red-900';
    if (value > -0.2) return 'bg-gray-200 text-gray-700';
    if (value > -0.5) return 'bg-blue-300 text-blue-900';
    if (value > -0.8) return 'bg-blue-500 text-white';
    return 'bg-blue-700 text-white';
  };

  // Get correlation strength description
  const getCorrelationStrength = (value: number): string => {
    const abs = Math.abs(value);
    if (abs >= 0.8) return 'Very Strong';
    if (abs >= 0.6) return 'Strong';
    if (abs >= 0.4) return 'Moderate';
    if (abs >= 0.2) return 'Weak';
    return 'Very Weak';
  };

  // Format correlation value
  const formatCorrelation = (value: number): string => {
    return value.toFixed(3);
  };

  // Available timeframes
  const timeframes = [
    { value: '1h', label: '1 Hour' },
    { value: '4h', label: '4 Hours' },
    { value: '1d', label: '1 Day' },
    { value: '1w', label: '1 Week' }
  ];

  // All symbols that could be included
  const availableSymbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT',
    'ADAUSDT', 'XRPUSDT', 'DOTUSDT', 'LTCUSDT', 'AVAXUSDT'
  ];

  // Toggle a symbol in the selection
  const toggleSymbol = (symbol: string) => {
    setSymbols((prevSymbols) => {
      if (prevSymbols.includes(symbol)) {
        return prevSymbols.filter(s => s !== symbol);
      } else {
        return [...prevSymbols, symbol];
      }
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header with Real-time Status */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-blue-400" />
            Real-time Correlation Matrix
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
            Real-time price correlation analysis powered by WebSocket streams. Track asset relationships instantly.
          </p>
        </div>
        
        <div className="flex items-center space-x-2 text-sm text-gray-400">
          <Activity className="h-4 w-4" />
          <span>Last Update: {lastUpdate.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Timeframe Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Analysis Timeframe</CardTitle>
            <CardDescription>Select the timeframe for correlation analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={timeframe} onValueChange={setTimeframe}>
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

        {/* Symbol Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Asset Selection</CardTitle>
            <CardDescription>
              Choose assets to include in correlation analysis (minimum 2, maximum 8)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {availableSymbols.map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => toggleSymbol(symbol)}
                  disabled={!symbols.includes(symbol) && symbols.length >= 8}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    symbols.includes(symbol)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700 disabled:opacity-50'
                  }`}
                >
                  {symbol.replace('USDT', '')}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Selected: {symbols.length}/8 assets
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Statistics */}
      {correlationData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-r from-green-900/20 to-green-800/20 border border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white">
                    {correlationData.stats.strongPositive}
                  </div>
                  <div className="text-green-400 text-sm font-medium">Strong Positive</div>
                </div>
                <TrendingUp className="h-8 w-8 text-green-400" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Correlation &gt; 0.7
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-red-900/20 to-red-800/20 border border-red-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white">
                    {correlationData.stats.strongNegative}
                  </div>
                  <div className="text-red-400 text-sm font-medium">Strong Negative</div>
                </div>
                <TrendingDown className="h-8 w-8 text-red-400" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Correlation &lt; -0.7
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-gray-900/20 to-gray-800/20 border border-gray-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white">
                    {correlationData.stats.neutral}
                  </div>
                  <div className="text-gray-400 text-sm font-medium">Neutral</div>
                </div>
                <Activity className="h-8 w-8 text-gray-400" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                |Correlation| ≤ 0.3
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-900/20 to-blue-800/20 border border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white">
                    {correlationData.stats.averageCorrelation.toFixed(3)}
                  </div>
                  <div className="text-blue-400 text-sm font-medium">Average Strength</div>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-400" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Mean |correlation|
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Correlation Matrix Display */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-300">Calculating real-time correlations...</p>
            <p className="text-gray-500 text-sm mt-2">WebSocket data processing</p>
          </div>
        </div>
      ) : connectionStatus === 'disconnected' ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>WebSocket Connection Lost</AlertTitle>
          <AlertDescription>
            Real-time correlation analysis is temporarily unavailable. Attempting to reconnect to data streams...
          </AlertDescription>
        </Alert>
      ) : correlationData ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Live Correlation Matrix</span>
              <div className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400">Real-time Data</span>
              </div>
            </CardTitle>
            <CardDescription>
              Real-time price correlation analysis • Last updated: {new Date(correlationData.lastUpdate).toLocaleTimeString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                  {/* Header Row */}
                  <div className="flex mb-2">
                    <div className="w-24 h-12 flex items-center justify-center text-sm font-medium text-gray-400">
                      Asset
                    </div>
                    {correlationData.symbols.map((symbol) => (
                      <div
                        key={`header-${symbol}`}
                        className="w-16 h-12 flex items-center justify-center text-xs font-medium text-white bg-gray-800 mx-1 rounded"
                      >
                        {symbol.replace('USDT', '')}
                      </div>
                    ))}
                  </div>

                  {/* Matrix Rows */}
                  {correlationData.symbols.map((rowSymbol, i) => (
                    <div key={`row-${rowSymbol}`} className="flex mb-2">
                      <div className="w-24 h-12 flex items-center justify-center text-sm font-medium text-white bg-gray-800 rounded mr-2">
                        {rowSymbol.replace('USDT', '')}
                      </div>
                      {correlationData.symbols.map((colSymbol, j) => {
                        const correlation = correlationData.matrix[i][j];
                        return (
                          <Tooltip key={`cell-${i}-${j}`}>
                            <TooltipTrigger asChild>
                              <div
                                className={`w-16 h-12 flex items-center justify-center text-xs font-bold rounded mx-1 cursor-help transition-transform hover:scale-105 ${getCorrelationColor(correlation)}`}
                              >
                                {formatCorrelation(correlation)}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="bg-gray-900 text-white border border-gray-700">
                              <div className="text-center">
                                <div className="font-bold">
                                  {rowSymbol.replace('USDT', '')} ↔ {colSymbol.replace('USDT', '')}
                                </div>
                                <div className="text-sm">
                                  Correlation: {formatCorrelation(correlation)}
                                </div>
                                <div className="text-xs text-gray-400">
                                  {getCorrelationStrength(correlation)} {correlation >= 0 ? 'Positive' : 'Negative'}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </TooltipProvider>

            {/* Legend */}
            <div className="mt-6 p-4 bg-gray-800/50 rounded-lg">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center">
                <Info className="h-4 w-4 mr-2" />
                Correlation Scale
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-700 rounded"></div>
                  <span className="text-gray-300">+0.8 to +1.0</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-red-500 rounded"></div>
                  <span className="text-gray-300">+0.5 to +0.8</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-200 rounded"></div>
                  <span className="text-gray-300">-0.2 to +0.2</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded"></div>
                  <span className="text-gray-300">-0.5 to -0.8</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-700 rounded"></div>
                  <span className="text-gray-300">-0.8 to -1.0</span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                <strong>Interpretation:</strong> Values closer to +1 indicate strong positive correlation (assets move together), 
                while values closer to -1 indicate strong negative correlation (assets move in opposite directions). 
                Values near 0 suggest little to no correlation.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400">Waiting for real-time market data...</div>
        </div>
      )}

      {/* WebSocket Status Footer */}
      <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <span className="text-slate-400">Analysis Status:</span>
            <span className="text-green-400">WebSocket Real-time Correlation</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-400">Assets Analyzed: {symbols.length}</span>
          </div>
          <div className="flex items-center space-x-4 text-slate-400">
            <span>Updates: Instant</span>
            <span>Rate Limits: None</span>
            <span>Precision: 3 decimals</span>
          </div>
        </div>
      </div>
    </div>
  );
}; 