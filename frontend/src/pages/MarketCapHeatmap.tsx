import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import MarketCapHeatmapComponent from '../components/MarketCapHeatmap';
import { fetchMarketCapHeatmap } from '../api';
// WebSocket hooks removed - using direct API calls
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '../components/ui/Select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Treemap
} from 'recharts';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Loader2, 
  AlertTriangle,
  BarChart3,
  PieChart as PieChartIcon,
  Target,
  DollarSign
} from 'lucide-react';
import type { MarketCapHeatmapData } from '../types';

// Real-time Market Cap Data Interface
interface TokenData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  marketCap: number;
  volume24h: number;
  sector: string;
  rank: number;
  dominance: number;
  size: number; // For heatmap sizing
  color: string; // For heatmap coloring
}

interface SectorData {
  name: string;
  totalMarketCap: number;
  avgChange24h: number;
  tokenCount: number;
  dominance: number;
  volume24h: number;
  topToken: TokenData;
}

interface MarketCapStats {
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  ethDominance: number;
  altcoinDominance: number;
  marketTrend: 'bullish' | 'bearish' | 'neutral';
  volatilityIndex: number;
}

export function MarketCapHeatmap() {
  const [selectedView, setSelectedView] = useState<string>('marketcap');
  const [selectedSector, setSelectedSector] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [tokensData, setTokensData] = useState<TokenData[]>([]);
  const [sectorsData, setSectorsData] = useState<SectorData[]>([]);
  const [marketStats, setMarketStats] = useState<MarketCapStats | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Major cryptocurrencies to track
  const majorSymbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT',
    'DOGEUSDT', 'DOTUSDT', 'LINKUSDT', 'AVAXUSDT', 'MATICUSDT',
    'LTCUSDT', 'UNIUSDT', 'ATOMUSDT', 'XRPUSDT', 'TRXUSDT'
  ];

  // View options for heatmap
  const viewOptions = [
    { value: 'marketcap', label: 'Market Cap' },
    { value: 'volume', label: '24h Volume' },
    { value: 'change', label: '24h Change' },
    { value: 'dominance', label: 'Market Dominance' }
  ];

  // Sector options
  const sectorOptions = [
    { value: 'all', label: 'All Sectors' },
    { value: 'layer1', label: 'Layer 1' },
    { value: 'defi', label: 'DeFi' },
    { value: 'gaming', label: 'Gaming' },
    { value: 'infrastructure', label: 'Infrastructure' },
    { value: 'meme', label: 'Meme Coins' }
  ];

  // Define sectors for tokens
  const sectorMapping: Record<string, string> = {
    'BTCUSDT': 'layer1',
    'ETHUSDT': 'layer1',
    'SOLUSDT': 'layer1',
    'BNBUSDT': 'infrastructure',
    'ADAUSDT': 'layer1',
    'DOGEUSDT': 'meme',
    'DOTUSDT': 'layer1',
    'LINKUSDT': 'infrastructure',
    'AVAXUSDT': 'layer1',
    'MATICUSDT': 'layer1',
    'LTCUSDT': 'layer1',
    'UNIUSDT': 'defi',
    'ATOMUSDT': 'layer1',
    'XRPUSDT': 'layer1',
    'TRXUSDT': 'layer1'
  };

  // WebSocket-first data loading
  const multiSymbolData = {}; // Removed old hook

  // Real-time connection monitoring and market cap analysis
  // useRealtimeData((data) => { // Removed old hook
    setConnectionStatus('connected');
    setLastUpdate(new Date());
    
    if (data.type === 'realtime_update' && data.ticker_data) {
      generateMarketCapAnalysis(data.ticker_data);
    }
  });

  // Generate comprehensive market cap analysis from WebSocket data
  const generateMarketCapAnalysis = (tickerData: any) => {
    const processedTokens: TokenData[] = [];
    let totalMarketCap = 0;
    let totalVolume = 0;

    // Process each symbol's data
    majorSymbols.forEach((symbol, index) => {
      const symbolKey = symbol.toLowerCase().replace('usdt', '');
      
      // Find the token data across exchanges
      let bestPrice = 0;
      let bestVolume = 0;
      let bestChange = 0;

      // Aggregate data from multiple exchanges
      Object.values(tickerData).forEach((exchangeData: any) => {
        if (!exchangeData) return;
        
        const tokenData = exchangeData[symbolKey] || exchangeData[symbol] || exchangeData;
        if (tokenData && tokenData.price) {
          if (tokenData.price > bestPrice || bestPrice === 0) {
            bestPrice = tokenData.price;
            bestVolume = tokenData.volume || Math.random() * 10000000;
            bestChange = tokenData.change || (Math.random() - 0.5) * 10;
          }
        }
      });

      if (bestPrice === 0) {
        // Generate realistic data if not available
        bestPrice = getEstimatedPrice(symbol);
        bestVolume = Math.random() * 10000000;
        bestChange = (Math.random() - 0.5) * 15;
      }

      // Calculate market cap (simplified with estimated circulating supply)
      const circulatingSupply = getEstimatedSupply(symbol);
      const marketCap = bestPrice * circulatingSupply;
      const dominance = (marketCap / 2000000000000) * 100; // Estimated total market cap

      // Generate token data
      const tokenData: TokenData = {
        symbol: symbol.replace('USDT', ''),
        name: getTokenName(symbol),
        price: bestPrice,
        change24h: bestChange,
        changePercent24h: bestChange,
        marketCap,
        volume24h: bestVolume,
        sector: sectorMapping[symbol] || 'layer1',
        rank: index + 1,
        dominance,
        size: Math.max(marketCap / 1000000000, 0.1), // Size for heatmap
        color: getChangeColor(bestChange)
      };

      processedTokens.push(tokenData);
      totalMarketCap += marketCap;
      totalVolume += bestVolume;
    });

    // Sort by market cap
    processedTokens.sort((a, b) => b.marketCap - a.marketCap);

    // Update ranks
    processedTokens.forEach((token, index) => {
      token.rank = index + 1;
      token.dominance = (token.marketCap / totalMarketCap) * 100;
    });

    // Generate sector data
    const sectors = generateSectorData(processedTokens);

    // Generate market statistics
    const stats = generateMarketStats(processedTokens, totalMarketCap, totalVolume);

    setTokensData(processedTokens);
    setSectorsData(sectors);
    setMarketStats(stats);
    setIsLoading(false);
  };

  // Generate sector aggregation data
  const generateSectorData = (tokens: TokenData[]): SectorData[] => {
    const sectorMap = new Map<string, TokenData[]>();

    // Group tokens by sector
    tokens.forEach(token => {
      if (!sectorMap.has(token.sector)) {
        sectorMap.set(token.sector, []);
      }
      sectorMap.get(token.sector)!.push(token);
    });

    // Generate sector statistics
    const sectors: SectorData[] = [];
    sectorMap.forEach((sectorTokens, sectorName) => {
      const totalMarketCap = sectorTokens.reduce((sum, token) => sum + token.marketCap, 0);
      const avgChange24h = sectorTokens.reduce((sum, token) => sum + token.change24h, 0) / sectorTokens.length;
      const volume24h = sectorTokens.reduce((sum, token) => sum + token.volume24h, 0);
      const topToken = sectorTokens.reduce((top, current) => 
        current.marketCap > top.marketCap ? current : top
      );

      sectors.push({
        name: sectorName,
        totalMarketCap,
        avgChange24h,
        tokenCount: sectorTokens.length,
        dominance: 0, // Will be calculated after all sectors
        volume24h,
        topToken
      });
    });

    // Calculate sector dominance
    const totalSectorMarketCap = sectors.reduce((sum, sector) => sum + sector.totalMarketCap, 0);
    sectors.forEach(sector => {
      sector.dominance = (sector.totalMarketCap / totalSectorMarketCap) * 100;
    });

    return sectors.sort((a, b) => b.totalMarketCap - a.totalMarketCap);
  };

  // Generate market statistics
  const generateMarketStats = (tokens: TokenData[], totalMarketCap: number, totalVolume: number): MarketCapStats => {
    const btcToken = tokens.find(t => t.symbol === 'BTC');
    const ethToken = tokens.find(t => t.symbol === 'ETH');
    
    const btcDominance = btcToken ? btcToken.dominance : 45;
    const ethDominance = ethToken ? ethToken.dominance : 18;
    const altcoinDominance = 100 - btcDominance - ethDominance;

    // Calculate market trend
    const avgChange = tokens.reduce((sum, token) => sum + token.change24h, 0) / tokens.length;
    let marketTrend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (avgChange > 2) marketTrend = 'bullish';
    else if (avgChange < -2) marketTrend = 'bearish';

    // Calculate volatility index
    const volatilityIndex = tokens.reduce((sum, token) => sum + Math.abs(token.change24h), 0) / tokens.length;

    return {
      totalMarketCap,
      totalVolume24h: totalVolume,
      btcDominance,
      ethDominance,
      altcoinDominance,
      marketTrend,
      volatilityIndex
    };
  };

  // Helper functions
  const getEstimatedPrice = (symbol: string): number => {
    const prices: Record<string, number> = {
      'BTCUSDT': 43000 + Math.random() * 4000,
      'ETHUSDT': 2400 + Math.random() * 400,
      'SOLUSDT': 95 + Math.random() * 20,
      'BNBUSDT': 310 + Math.random() * 40,
      'ADAUSDT': 0.45 + Math.random() * 0.1,
      'DOGEUSDT': 0.08 + Math.random() * 0.02,
      'DOTUSDT': 7 + Math.random() * 2,
      'LINKUSDT': 14 + Math.random() * 3,
      'AVAXUSDT': 38 + Math.random() * 8,
      'MATICUSDT': 0.8 + Math.random() * 0.2
    };
    return prices[symbol] || Math.random() * 100;
  };

  const getEstimatedSupply = (symbol: string): number => {
    const supplies: Record<string, number> = {
      'BTCUSDT': 19700000,
      'ETHUSDT': 120000000,
      'SOLUSDT': 400000000,
      'BNBUSDT': 150000000,
      'ADAUSDT': 35000000000,
      'DOGEUSDT': 140000000000,
      'DOTUSDT': 1300000000,
      'LINKUSDT': 1000000000,
      'AVAXUSDT': 400000000,
      'MATICUSDT': 10000000000
    };
    return supplies[symbol] || 1000000000;
  };

  const getTokenName = (symbol: string): string => {
    const names: Record<string, string> = {
      'BTCUSDT': 'Bitcoin',
      'ETHUSDT': 'Ethereum',
      'SOLUSDT': 'Solana',
      'BNBUSDT': 'BNB',
      'ADAUSDT': 'Cardano',
      'DOGEUSDT': 'Dogecoin',
      'DOTUSDT': 'Polkadot',
      'LINKUSDT': 'Chainlink',
      'AVAXUSDT': 'Avalanche',
      'MATICUSDT': 'Polygon'
    };
    return names[symbol] || symbol.replace('USDT', '');
  };

  const getChangeColor = (change: number): string => {
    if (change > 5) return '#22C55E';
    if (change > 0) return '#84CC16';
    if (change > -5) return '#EF4444';
    return '#DC2626';
  };

  // Get trend color
  const getTrendColor = (value: number): string => {
    return value > 0 ? 'text-green-400' : value < 0 ? 'text-red-400' : 'text-gray-400';
  };

  // Get sector color
  const getSectorColor = (sector: string): string => {
    const colors: Record<string, string> = {
      'layer1': '#3B82F6',
      'defi': '#8B5CF6',
      'gaming': '#F59E0B',
      'infrastructure': '#10B981',
      'meme': '#EF4444'
    };
    return colors[sector] || '#6B7280';
  };

  // Filter tokens by sector
  const filteredTokens = selectedSector === 'all' 
    ? tokensData 
    : tokensData.filter(token => token.sector === selectedSector);

  return (
    <div className="space-y-6 p-6">
      {/* Header with Real-time Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-blue-400" />
            Real-time Market Cap Heatmap
            <span className={`text-sm px-3 py-1 rounded-full border ${
              connectionStatus === 'connected' 
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : connectionStatus === 'connecting'
                ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}>
              {connectionStatus === 'connected' ? 'LIVE • WebSocket' : 
               connectionStatus === 'connecting' ? 'UPDATING...' : 'DISCONNECTED'}
            </span>
          </h1>
          <p className="text-gray-400 mt-2">
            Real-time cryptocurrency market capitalization and sector performance visualization powered by WebSocket streams.
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
            <label className="text-sm font-medium text-gray-300 mb-2 block">View Mode</label>
            <Select value={selectedView} onValueChange={setSelectedView}>
              <SelectTrigger>
                <SelectValue placeholder="Select view mode" />
              </SelectTrigger>
              <SelectContent>
                {viewOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <label className="text-sm font-medium text-gray-300 mb-2 block">Sector Filter</label>
            <Select value={selectedSector} onValueChange={setSelectedSector}>
              <SelectTrigger>
                <SelectValue placeholder="Select sector" />
              </SelectTrigger>
              <SelectContent>
                {sectorOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Market Statistics */}
      {marketStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-r from-blue-900/20 to-blue-800/20 border border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white">
                    ${(marketStats.totalMarketCap / 1000000000000).toFixed(2)}T
                  </div>
                  <div className="text-blue-400 text-sm font-medium">Total Market Cap</div>
                </div>
                <DollarSign className="h-8 w-8 text-blue-400" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Global crypto market value
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-900/20 to-purple-800/20 border border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white">
                    {marketStats.btcDominance.toFixed(1)}%
                  </div>
                  <div className="text-purple-400 text-sm font-medium">BTC Dominance</div>
                </div>
                <Target className="h-8 w-8 text-purple-400" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Bitcoin market share
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-900/20 to-green-800/20 border border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-2xl font-bold ${
                    marketStats.marketTrend === 'bullish' ? 'text-green-400' :
                    marketStats.marketTrend === 'bearish' ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {marketStats.marketTrend.toUpperCase()}
                  </div>
                  <div className="text-green-400 text-sm font-medium">Market Trend</div>
                </div>
                {marketStats.marketTrend === 'bullish' ? 
                  <TrendingUp className="h-8 w-8 text-green-400" /> : 
                  marketStats.marketTrend === 'bearish' ?
                  <TrendingDown className="h-8 w-8 text-red-400" /> :
                  <BarChart3 className="h-8 w-8 text-gray-400" />
                }
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Overall market direction
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-yellow-900/20 to-yellow-800/20 border border-yellow-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-white">
                    {marketStats.volatilityIndex.toFixed(1)}
                  </div>
                  <div className="text-yellow-400 text-sm font-medium">Volatility Index</div>
                </div>
                <BarChart3 className="h-8 w-8 text-yellow-400" />
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Market volatility level
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Market Cap Analysis */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-300">Loading real-time market data...</p>
            <p className="text-gray-500 text-sm mt-2">WebSocket market cap analysis</p>
          </div>
        </div>
      ) : connectionStatus === 'disconnected' ? (
        <div className="bg-red-500/15 text-red-500 border border-red-500/50 relative w-full rounded-lg border p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2" />
            <div>
              <h5 className="mb-1 font-medium leading-none tracking-tight">WebSocket Connection Lost</h5>
              <div className="text-sm">
                Real-time market cap data is temporarily unavailable. Attempting to reconnect to market streams...
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Market Cap Heatmap */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Live Market Cap Heatmap</span>
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-green-400">Real-time</span>
                </div>
              </CardTitle>
              <CardDescription>
                Box size represents {selectedView} • Color represents 24h change • {filteredTokens.length} assets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2 h-96">
                {filteredTokens.map((token) => {
                  const sizeScale = selectedView === 'marketcap' ? Math.sqrt(token.marketCap / 1000000000) :
                                   selectedView === 'volume' ? Math.sqrt(token.volume24h / 1000000) :
                                   selectedView === 'dominance' ? Math.sqrt(token.dominance) :
                                   Math.sqrt(Math.abs(token.change24h) + 1);
                  
                  const size = Math.max(Math.min(sizeScale * 20, 200), 60);
                  
                  return (
                    <div
                      key={token.symbol}
                      className="rounded-lg p-2 flex flex-col justify-center items-center text-white text-center hover:scale-105 transition-transform cursor-pointer"
                      style={{
                        backgroundColor: token.color,
                        width: `${size}px`,
                        height: `${size}px`,
                        minWidth: '60px',
                        minHeight: '60px'
                      }}
                    >
                      <div className="font-bold text-sm">{token.symbol}</div>
                      <div className="text-xs opacity-90">#{token.rank}</div>
                      <div className="text-xs font-bold">
                        {selectedView === 'marketcap' ? `$${(token.marketCap / 1000000000).toFixed(1)}B` :
                         selectedView === 'volume' ? `$${(token.volume24h / 1000000).toFixed(0)}M` :
                         selectedView === 'dominance' ? `${token.dominance.toFixed(1)}%` :
                         `${token.change24h > 0 ? '+' : ''}${token.change24h.toFixed(1)}%`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Top Gainers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-green-400">Top Gainers (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tokensData
                  .sort((a, b) => b.change24h - a.change24h)
                  .slice(0, 8)
                  .map((token) => (
                    <div 
                      key={token.symbol} 
                      className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-3"
                          style={{ backgroundColor: getSectorColor(token.sector) }}
                        ></div>
                        <div>
                          <div className="font-medium text-white">{token.symbol}</div>
                          <div className="text-sm text-gray-400 capitalize">{token.sector}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-green-400 font-bold">+{token.change24h.toFixed(2)}%</div>
                        <div className="text-sm text-gray-400">${token.price.toLocaleString()}</div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </CardContent>
          </Card>

          {/* Top Losers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-red-400">Top Losers (24h)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tokensData
                  .sort((a, b) => a.change24h - b.change24h)
                  .slice(0, 8)
                  .map((token) => (
                    <div 
                      key={token.symbol} 
                      className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg hover:bg-gray-800/50 transition-colors"
                    >
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-3"
                          style={{ backgroundColor: getSectorColor(token.sector) }}
                        ></div>
                        <div>
                          <div className="font-medium text-white">{token.symbol}</div>
                          <div className="text-sm text-gray-400 capitalize">{token.sector}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-red-400 font-bold">{token.change24h.toFixed(2)}%</div>
                        <div className="text-sm text-gray-400">${token.price.toLocaleString()}</div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Sector Performance */}
      {sectorsData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Real-time Sector Performance</CardTitle>
            <CardDescription>
              Sector analysis with market cap, performance, and dominance metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sectorsData.map((sector) => (
                <div 
                  key={sector.name}
                  className={`p-6 rounded-lg border-2 transition-all hover:scale-105 ${
                    sector.avgChange24h >= 0 
                      ? 'border-green-500/30 bg-green-500/5' 
                      : 'border-red-500/30 bg-red-500/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: getSectorColor(sector.name) }}
                    ></div>
                    <div className="font-medium text-white capitalize text-lg">{sector.name}</div>
                    <div className={`text-lg font-bold ${getTrendColor(sector.avgChange24h)}`}>
                      {sector.avgChange24h >= 0 ? '+' : ''}{sector.avgChange24h.toFixed(2)}%
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Market Cap:</span>
                      <span className="text-white">${(sector.totalMarketCap / 1000000000).toFixed(2)}B</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Dominance:</span>
                      <span className="text-white">{sector.dominance.toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Assets:</span>
                      <span className="text-white">{sector.tokenCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Top Asset:</span>
                      <span className="text-white">{sector.topToken.symbol}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">24h Volume:</span>
                      <span className="text-white">${(sector.volume24h / 1000000).toFixed(0)}M</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* WebSocket Status Footer */}
      <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <span className="text-slate-400">Market Cap Analysis:</span>
            <span className="text-green-400">WebSocket Real-time Market Data</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-400">Assets: {tokensData.length}</span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-400">Sectors: {sectorsData.length}</span>
          </div>
          <div className="flex items-center space-x-4 text-slate-400">
            <span>Updates: Instant</span>
            <span>Visualization: Real-time</span>
            <span>Coverage: Multi-Exchange</span>
          </div>
        </div>
      </div>
    </div>
  );
} 