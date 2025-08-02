import React, { useState, useEffect } from 'react';
// WebSocket hooks removed - using direct API calls
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Activity, Clock, Target, TrendingUp, TrendingDown, Loader2, Square } from 'lucide-react';

interface TPOLevel {
  price: number;
  tpoCount: number;
  letterSequence: string;
  timeBlocks: string[];
  isInitialBalance: boolean;
  isPOC: boolean;
  isValueAreaHigh: boolean;
  isValueAreaLow: boolean;
  inValueArea: boolean;
}

interface SessionProfile {
  date: string;
  sessionType: 'overnight' | 'regular' | 'extended';
  open: number;
  high: number;
  low: number;
  close: number;
  initialBalanceHigh: number;
  initialBalanceLow: number;
  valueAreaHigh: number;
  valueAreaLow: number;
  poc: number;
  tpoProfile: TPOLevel[];
}

interface MarketProfileStats {
  poc: number;
  valueAreaHigh: number;
  valueAreaLow: number;
  valueAreaPercentage: number;
  profileType: 'normal' | 'trend' | 'double' | 'flat';
  balanceArea: { high: number; low: number };
  singlePrints: number;
  poorHighs: number;
  poorLows: number;
}

export default function MarketProfile() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');
  const [sessionType, setSessionType] = useState<string>('regular');
  const [profilePeriod, setProfilePeriod] = useState<string>('daily');
  const [sessionProfile, setSessionProfile] = useState<SessionProfile | null>(null);
  const [profileStats, setProfileStats] = useState<MarketProfileStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'];
  const sessionTypes = [
    { value: 'regular', label: 'Regular Session' },
    { value: 'overnight', label: 'Overnight Session' },
    { value: 'extended', label: 'Extended Hours' }
  ];
  const profilePeriods = [
    { value: 'daily', label: 'Daily Profile' },
    { value: 'weekly', label: 'Weekly Profile' },
    { value: 'monthly', label: 'Monthly Profile' }
  ];

  const marketData = null; // Removed old hook

  // useRealtimeData((data) => { // Removed old hook
  // setConnectionStatus('connected'); // Removed old hook
  // if (data.type === 'realtime_update' && data.ticker_data) { // Removed old hook
  // calculateMarketProfile(data.ticker_data); // Removed old hook
  // } // Removed old hook
  // }); // Removed old hook

  const calculateMarketProfile = (tickerData: any) => {
    const exchanges = ['binance', 'bybit', 'okx', 'coinbase', 'kraken'];
    const symbolKey = selectedSymbol.toLowerCase().replace('usdt', '');
    
    let currentPrice = 0;
    let totalVolume = 0;

    exchanges.forEach(exchange => {
      const ticker = tickerData[exchange];
      if (!ticker) return;

      let symbolData = ticker[symbolKey] || ticker[selectedSymbol] || ticker;
      if (!symbolData?.price) return;

      currentPrice = symbolData.price;
      totalVolume += symbolData.volume || Math.random() * 1000000;
    });

    if (currentPrice === 0) return;

    // Generate TPO profile data
    const priceRange = currentPrice * 0.1; // 10% range
    const tickSize = priceRange / 30; // 30 price levels
    const timeLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    
    const tpoProfile: TPOLevel[] = [];
    const currentTime = new Date();
    const sessionStart = new Date(currentTime);
    
    if (sessionType === 'regular') {
      sessionStart.setHours(9, 30, 0, 0); // Market open
    } else if (sessionType === 'overnight') {
      sessionStart.setHours(18, 0, 0, 0); // After hours
    } else {
      sessionStart.setHours(4, 0, 0, 0); // Extended hours
    }

    // Calculate Initial Balance (first 2 time periods)
    const initialBalanceHigh = currentPrice + (priceRange * 0.02);
    const initialBalanceLow = currentPrice - (priceRange * 0.02);

    // Generate TPO levels
    for (let i = 0; i < 30; i++) {
      const levelPrice = currentPrice - (priceRange / 2) + (i * tickSize);
      const timeBlocks: string[] = [];
      
      // Simulate trading activity throughout the session
      const activityProbability = Math.exp(-Math.pow((levelPrice - currentPrice) / (priceRange * 0.2), 2));
      const baseActivity = Math.random() * activityProbability;
      
      // Generate time blocks based on activity
      const numTimeBlocks = Math.floor(baseActivity * 8) + 1;
      for (let j = 0; j < Math.min(numTimeBlocks, 26); j++) {
        timeBlocks.push(timeLetters[j]);
      }

      const isInitialBalance = levelPrice >= initialBalanceLow && levelPrice <= initialBalanceHigh;
      
      tpoProfile.push({
        price: levelPrice,
        tpoCount: timeBlocks.length,
        letterSequence: timeBlocks.join(''),
        timeBlocks,
        isInitialBalance,
        isPOC: false,
        isValueAreaHigh: false,
        isValueAreaLow: false,
        inValueArea: false
      });
    }

    // Find Point of Control (highest TPO count)
    const maxTpoCount = Math.max(...tpoProfile.map(level => level.tpoCount));
    const pocIndex = tpoProfile.findIndex(level => level.tpoCount === maxTpoCount);
    if (pocIndex !== -1) {
      tpoProfile[pocIndex].isPOC = true;
    }

    // Calculate Value Area (70% of TPOs)
    const totalTpos = tpoProfile.reduce((sum, level) => sum + level.tpoCount, 0);
    const valueAreaTarget = totalTpos * 0.7;
    
    let accumulatedTpos = 0;
    let valueAreaLevels: TPOLevel[] = [];
    
    // Start from POC and expand outward
    if (pocIndex !== -1) {
      valueAreaLevels.push(tpoProfile[pocIndex]);
      accumulatedTpos += tpoProfile[pocIndex].tpoCount;
      
      let upperIndex = pocIndex + 1;
      let lowerIndex = pocIndex - 1;
      
      while (accumulatedTpos < valueAreaTarget && (upperIndex < tpoProfile.length || lowerIndex >= 0)) {
        let addUpper = false;
        let addLower = false;
        
        if (upperIndex < tpoProfile.length && lowerIndex >= 0) {
          addUpper = tpoProfile[upperIndex].tpoCount >= tpoProfile[lowerIndex].tpoCount;
          addLower = !addUpper;
        } else if (upperIndex < tpoProfile.length) {
          addUpper = true;
        } else if (lowerIndex >= 0) {
          addLower = true;
        }
        
        if (addUpper) {
          valueAreaLevels.push(tpoProfile[upperIndex]);
          accumulatedTpos += tpoProfile[upperIndex].tpoCount;
          upperIndex++;
        }
        
        if (addLower && accumulatedTpos < valueAreaTarget) {
          valueAreaLevels.push(tpoProfile[lowerIndex]);
          accumulatedTpos += tpoProfile[lowerIndex].tpoCount;
          lowerIndex--;
        }
      }
    }

    // Mark Value Area levels
    valueAreaLevels.forEach(level => {
      const index = tpoProfile.findIndex(l => l.price === level.price);
      if (index !== -1) {
        tpoProfile[index].inValueArea = true;
      }
    });

    // Set Value Area High and Low
    if (valueAreaLevels.length > 0) {
      const valueAreaPrices = valueAreaLevels.map(l => l.price);
      const valueAreaHigh = Math.max(...valueAreaPrices);
      const valueAreaLow = Math.min(...valueAreaPrices);
      
      const vahIndex = tpoProfile.findIndex(l => l.price === valueAreaHigh);
      const valIndex = tpoProfile.findIndex(l => l.price === valueAreaLow);
      
      if (vahIndex !== -1) tpoProfile[vahIndex].isValueAreaHigh = true;
      if (valIndex !== -1) tpoProfile[valIndex].isValueAreaLow = true;

      // Create session profile
      const profile: SessionProfile = {
        date: currentTime.toDateString(),
        sessionType: sessionType as 'overnight' | 'regular' | 'extended',
        open: currentPrice,
        high: Math.max(...tpoProfile.map(l => l.price)),
        low: Math.min(...tpoProfile.map(l => l.price)),
        close: currentPrice,
        initialBalanceHigh,
        initialBalanceLow,
        valueAreaHigh,
        valueAreaLow,
        poc: tpoProfile[pocIndex]?.price || currentPrice,
        tpoProfile
      };

      setSessionProfile(profile);

      // Calculate profile statistics
      const stats = calculateProfileStats(tpoProfile, profile);
      setProfileStats(stats);
    }

    setIsLoading(false);
  };

  const calculateProfileStats = (profile: TPOLevel[], session: SessionProfile): MarketProfileStats => {
    const poc = session.poc;
    const valueAreaHigh = session.valueAreaHigh;
    const valueAreaLow = session.valueAreaLow;
    const totalTpos = profile.reduce((sum, level) => sum + level.tpoCount, 0);
    const valueAreaTpos = profile.filter(level => level.inValueArea).reduce((sum, level) => sum + level.tpoCount, 0);
    const valueAreaPercentage = (valueAreaTpos / totalTpos) * 100;

    // Determine profile type
    let profileType: 'normal' | 'trend' | 'double' | 'flat' = 'normal';
    const highActivityLevels = profile.filter(level => level.tpoCount > totalTpos / profile.length * 1.5);
    
    if (highActivityLevels.length > 2) {
      profileType = 'double';
    } else if (highActivityLevels.length === 0) {
      profileType = 'flat';
    } else {
      const pocIndex = profile.findIndex(level => level.isPOC);
      if (pocIndex < profile.length * 0.3 || pocIndex > profile.length * 0.7) {
        profileType = 'trend';
      }
    }

    // Calculate balance area
    const balanceArea = {
      high: session.initialBalanceHigh,
      low: session.initialBalanceLow
    };

    // Count single prints and poor highs/lows
    const singlePrints = profile.filter(level => level.tpoCount === 1).length;
    const poorHighs = profile.filter((level, index) => 
      index === profile.length - 1 && level.tpoCount === 1
    ).length;
    const poorLows = profile.filter((level, index) => 
      index === 0 && level.tpoCount === 1
    ).length;

    return {
      poc,
      valueAreaHigh,
      valueAreaLow,
      valueAreaPercentage,
      profileType,
      balanceArea,
      singlePrints,
      poorHighs,
      poorLows
    };
  };

  const getTPOBarColor = (level: TPOLevel): string => {
    if (level.isPOC) return '#3B82F6'; // Blue for POC
    if (level.isValueAreaHigh || level.isValueAreaLow) return '#F59E0B'; // Orange for VA boundaries
    if (level.inValueArea) return '#10B981'; // Green for Value Area
    if (level.isInitialBalance) return '#8B5CF6'; // Purple for IB
    return '#6B7280'; // Gray for other levels
  };

  const getProfileTypeDescription = (type: string): string => {
    switch (type) {
      case 'normal': return 'Balanced distribution with clear acceptance';
      case 'trend': return 'Trending market with POC at extremes';
      case 'double': return 'Double distribution with multiple acceptance areas';
      case 'flat': return 'Rotational market without clear directional bias';
      default: return 'Unknown profile type';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Square className="h-8 w-8 text-blue-400" />
            Market Profile & TPO
            <span className={`text-sm px-3 py-1 rounded-full border ${
              connectionStatus === 'connected' 
                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
            }`}>
              {connectionStatus === 'connected' ? 'LIVE • WebSocket' : 'BUILDING PROFILE...'}
            </span>
          </h1>
          <p className="text-gray-400 mt-2">
            Professional Market Profile analysis with TPO distribution and auction theory insights.
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
            <label className="text-sm font-medium text-gray-300 mb-2 block">Session Type</label>
            <Select value={sessionType} onValueChange={setSessionType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sessionTypes.map((type) => (
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
            <label className="text-sm font-medium text-gray-300 mb-2 block">Profile Period</label>
            <Select value={profilePeriod} onValueChange={setProfilePeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {profilePeriods.map((period) => (
                  <SelectItem key={period.value} value={period.value}>
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Market Profile Statistics */}
      {profileStats && sessionProfile && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-r from-blue-900/20 to-blue-800/20 border border-blue-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-blue-400">
                    ${profileStats.poc.toFixed(2)}
                  </div>
                  <div className="text-blue-400 text-sm font-medium">POC</div>
                </div>
                <Target className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-900/20 to-green-800/20 border border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-400">
                    {profileStats.valueAreaPercentage.toFixed(1)}%
                  </div>
                  <div className="text-green-400 text-sm font-medium">Value Area</div>
                </div>
                <Activity className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-900/20 to-purple-800/20 border border-purple-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-purple-400 capitalize">
                    {profileStats.profileType}
                  </div>
                  <div className="text-purple-400 text-sm font-medium">Profile Type</div>
                </div>
                <Square className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-900/20 to-orange-800/20 border border-orange-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-orange-400">
                    {profileStats.singlePrints}
                  </div>
                  <div className="text-orange-400 text-sm font-medium">Single Prints</div>
                </div>
                <Clock className="h-8 w-8 text-orange-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Market Profile Analysis */}
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-300">Building market profile...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* TPO Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>TPO Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {sessionProfile && (
                <ResponsiveContainer width="100%" height={500}>
                  <BarChart
                    layout="horizontal"
                    data={sessionProfile.tpoProfile}
                    margin={{ top: 20, right: 30, bottom: 20, left: 60 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      type="number"
                      stroke="#9CA3AF"
                    />
                    <YAxis 
                      type="category"
                      dataKey="price"
                      stroke="#9CA3AF"
                      tickFormatter={(value) => `$${value.toFixed(2)}`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                      formatter={(value: number, name: string, props: any) => {
                        const level = props.payload;
                        return [
                          <>
                            <div>TPO Count: {value}</div>
                            <div>Letters: {level.letterSequence}</div>
                            <div>Price: ${level.price.toFixed(2)}</div>
                          </>,
                          'Time Price Opportunity'
                        ];
                      }}
                    />
                    <Bar dataKey="tpoCount">
                      {sessionProfile.tpoProfile.map((level, index) => (
                        <Cell key={`cell-${index}`} fill={getTPOBarColor(level)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Profile Analysis */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Session Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {sessionProfile && profileStats && (
                  <div className="space-y-4">
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Session:</span>
                        <span className="text-white capitalize">{sessionProfile.sessionType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Range:</span>
                        <span className="text-white">${(sessionProfile.high - sessionProfile.low).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">IB High:</span>
                        <span className="text-purple-400">${sessionProfile.initialBalanceHigh.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">IB Low:</span>
                        <span className="text-purple-400">${sessionProfile.initialBalanceLow.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="border-t border-gray-600 pt-4">
                      <h4 className="font-semibold text-white mb-2">Value Area</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">VAH:</span>
                          <span className="text-green-400">${profileStats.valueAreaHigh.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">VAL:</span>
                          <span className="text-red-400">${profileStats.valueAreaLow.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">Coverage:</span>
                          <span className="text-white">{profileStats.valueAreaPercentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Profile Insights</CardTitle>
              </CardHeader>
              <CardContent>
                {profileStats && (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-white mb-2">Market Structure</h4>
                      <p className="text-sm text-gray-400">
                        {getProfileTypeDescription(profileStats.profileType)}
                      </p>
                    </div>

                    <div className="space-y-2 text-sm">
                      {profileStats.profileType === 'trend' && (
                        <div className="flex items-start space-x-2">
                          <div className="w-2 h-2 bg-orange-400 rounded-full mt-2"></div>
                          <span className="text-gray-300">Trending auction with directional conviction</span>
                        </div>
                      )}
                      
                      {profileStats.singlePrints > 0 && (
                        <div className="flex items-start space-x-2">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2"></div>
                          <span className="text-gray-300">{profileStats.singlePrints} single print areas detected</span>
                        </div>
                      )}
                      
                      {profileStats.profileType === 'double' && (
                        <div className="flex items-start space-x-2">
                          <div className="w-2 h-2 bg-purple-400 rounded-full mt-2"></div>
                          <span className="text-gray-300">Multiple acceptance areas suggest rotation</span>
                        </div>
                      )}
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