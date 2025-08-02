import { useState, useEffect, useCallback } from 'react';
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
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '../components/ui/Table';
import { Badge } from '../components/ui/badge';
import { Loader2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
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

// Types for signals data
interface Signal {
  id: string;
  symbol: string;
  timestamp: number;
  type: 'entry' | 'exit' | 'alert';
  direction: 'long' | 'short' | 'neutral';
  price: number;
  source: string;
  confidence: number;
  description: string;
  metadata: {
    indicators: {
      name: string;
      value: number;
      signal: 'bullish' | 'bearish' | 'neutral';
    }[];
    timeframe: string;
  };
}

export function Signals() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('all');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('all');
  const [selectedDirection, setSelectedDirection] = useState<string>('all');
  
  // Available trading pairs
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT'];
  
  // Available timeframes
  const timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'];
  
  // Load signals data
  const loadSignals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch signals from the backend API
              const response = await fetch('/api/signals');
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }
      
      const data = await response.json();
      setSignals(data);
    } catch (err) {
      console.error('Failed to fetch signals:', err);
      setError('Failed to load signals. Please ensure the backend server is running and the signals endpoint is available.');
      setSignals([]); // Clear any existing signals
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Load signals on mount
  useEffect(() => {
    loadSignals();
    
    // Refresh signals every minute
    const interval = setInterval(() => {
      loadSignals();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [loadSignals]);
  
  // Filter signals based on selected criteria
  const filteredSignals = signals.filter(signal => {
    const symbolMatch = selectedSymbol === 'all' || signal.symbol === selectedSymbol;
    const timeframeMatch = selectedTimeframe === 'all' || signal.metadata.timeframe === selectedTimeframe;
    const directionMatch = selectedDirection === 'all' || signal.direction === selectedDirection;
    
    return symbolMatch && timeframeMatch && directionMatch;
  });
  
  // Helper function to format timestamp
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString() + ' ' + date.toLocaleDateString();
  };
  
  // Helper to get badge color for signal type
  const getTypeBadgeColor = (type: string): string => {
    switch (type) {
      case 'entry':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'exit':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'alert':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };
  
  // Helper to get badge color for direction
  const getDirectionBadgeColor = (direction: string): string => {
    switch (direction) {
      case 'long':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300';
      case 'short':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };
  
  // Helper to get icon for direction
  const getDirectionIcon = (direction: string) => {
    switch (direction) {
      case 'long':
        return <TrendingUp className="h-4 w-4 text-emerald-500 inline mr-1" />;
      case 'short':
        return <TrendingDown className="h-4 w-4 text-red-500 inline mr-1" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500 inline mr-1" />;
    }
  };
  
  // Get confidence color
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 65) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading trading signals...</p>
      </div>
    );
  }
  
  if (error) {
    return (
      <Alert variant="destructive" className="mx-auto my-8 max-w-2xl">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {error}
          <button 
            onClick={loadSignals}
            className="ml-4 underline text-sm text-primary"
          >
            Retry
          </button>
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Trading Signals</h1>
          <p className="text-muted-foreground">
            AI-powered trading signals and market opportunities
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Symbol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Symbols</SelectItem>
              {symbols.map(symbol => (
                <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Timeframes</SelectItem>
              {timeframes.map(timeframe => (
                <SelectItem key={timeframe} value={timeframe}>{timeframe}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedDirection} onValueChange={setSelectedDirection}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Direction" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Directions</SelectItem>
              <SelectItem value="long">Long</SelectItem>
              <SelectItem value="short">Short</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Signal Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Total Signals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {filteredSignals.length}
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Last 24 hours
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Long/Short Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                const longCount = filteredSignals.filter(s => s.direction === 'long').length;
                const shortCount = filteredSignals.filter(s => s.direction === 'short').length;
                
                if (shortCount === 0) return "∞";
                return (longCount / shortCount).toFixed(2);
              })()}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                {filteredSignals.filter(s => s.direction === 'long').length} Long
              </span>
              <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                {filteredSignals.filter(s => s.direction === 'short').length} Short
              </span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Avg. Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                if (filteredSignals.length === 0) return "0";
                
                const totalConfidence = filteredSignals.reduce((sum, signal) => {
                  return sum + signal.confidence;
                }, 0);
                
                return (totalConfidence / filteredSignals.length).toFixed(0) + "%";
              })()}
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ 
                  width: filteredSignals.length === 0 
                    ? "0%" 
                    : `${filteredSignals.reduce((sum, signal) => sum + signal.confidence, 0) / filteredSignals.length}%` 
                }}
              ></div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Signal Table */}
      <Card>
        <CardHeader>
          <CardTitle>Trading Signals</CardTitle>
          <CardDescription>
            Real-time signals from multiple technical and on-chain indicators
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Timeframe</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSignals.length > 0 ? (
                  filteredSignals.map(signal => (
                    <TableRow key={signal.id} className="group cursor-pointer hover:bg-gray-50">
                      <TableCell>
                        <div className="text-sm">{formatTimestamp(signal.timestamp)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{signal.symbol}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeBadgeColor(signal.type)}>
                          {signal.type.charAt(0).toUpperCase() + signal.type.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getDirectionBadgeColor(signal.direction)}>
                          {getDirectionIcon(signal.direction)}
                          {signal.direction.charAt(0).toUpperCase() + signal.direction.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono">${signal.price.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}</div>
                      </TableCell>
                      <TableCell>
                        <div>{signal.metadata.timeframe}</div>
                      </TableCell>
                      <TableCell>
                        <div>{signal.source}</div>
                      </TableCell>
                      <TableCell>
                        <div className={`font-bold ${getConfidenceColor(signal.confidence)}`}>
                          {signal.confidence}%
                        </div>
                        <div 
                          className="bg-gray-200 h-1 w-16 mt-1 rounded-full"
                        >
                          <div 
                            className={`h-1 rounded-full ${
                              signal.confidence > 80 ? 'bg-green-500' : 
                              signal.confidence > 65 ? 'bg-yellow-500' : 'bg-red-500'
                            }`} 
                            style={{ width: `${signal.confidence}%` }}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6">
                      <p className="text-muted-foreground">No signals found with current filter criteria</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          <div className="text-sm text-muted-foreground mt-4">
            <p>
              Signals are generated using a combination of technical indicators, order flow analysis, and market sentiment.
              Each signal includes a confidence score indicating the strength of the signal based on multiple factors.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Signals;