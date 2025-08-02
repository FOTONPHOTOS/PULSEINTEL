import React, { useState, useEffect } from 'react';
import { PieChart, BarChart3, TrendingUp, TrendingDown, DollarSign, Target, Wallet, AlertCircle } from 'lucide-react';
import { PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PortfolioPosition {
  symbol: string;
  amount: number;
  avgPrice: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercentage: number;
  allocation: number;
  exchange: string;
  lastUpdated: number;
}

interface PortfolioMetrics {
  totalValue: number;
  totalPnl: number;
  totalPnlPercentage: number;
  dayChange: number;
  dayChangePercentage: number;
  bestPerformer: PortfolioPosition;
  worstPerformer: PortfolioPosition;
  riskScore: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

interface PortfolioHistory {
  timestamp: number;
  totalValue: number;
  dayChange: number;
  topAssets: { symbol: string; value: number; change: number }[];
}

interface PortfolioTrackerProps {
  userId?: string;
}

const PortfolioTracker: React.FC<PortfolioTrackerProps> = ({ userId = "demo_user" }) => {
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [history, setHistory] = useState<PortfolioHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [timeframe, setTimeframe] = useState<'1d' | '7d' | '30d' | '90d'>('7d');
  const [view, setView] = useState<'overview' | 'positions' | 'analytics'>('overview');

  // Portfolio colors for pie chart
  const portfolioColors = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
    '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'
  ];

  useEffect(() => {
    const generateMockPortfolio = () => {
      // Mock portfolio positions
      const mockPositions: PortfolioPosition[] = [
        {
          symbol: 'BTCUSDT',
          amount: 0.25,
          avgPrice: 42000,
          currentPrice: 45000,
          value: 11250,
          pnl: 750,
          pnlPercentage: 7.14,
          allocation: 45,
          exchange: 'Binance',
          lastUpdated: Date.now()
        },
        {
          symbol: 'ETHUSDT',
          amount: 4.2,
          avgPrice: 2500,
          currentPrice: 2800,
          value: 11760,
          pnl: 1260,
          pnlPercentage: 12.0,
          allocation: 47,
          exchange: 'Bybit',
          lastUpdated: Date.now()
        },
        {
          symbol: 'SOLUSDT',
          amount: 15,
          avgPrice: 95,
          currentPrice: 100,
          value: 1500,
          pnl: 75,
          pnlPercentage: 5.26,
          allocation: 6,
          exchange: 'OKX',
          lastUpdated: Date.now()
        },
        {
          symbol: 'ADAUSDT',
          amount: 1000,
          avgPrice: 0.45,
          currentPrice: 0.38,
          value: 380,
          pnl: -70,
          pnlPercentage: -15.56,
          allocation: 1.5,
          exchange: 'Coinbase',
          lastUpdated: Date.now()
        },
        {
          symbol: 'DOTUSDT',
          amount: 50,
          avgPrice: 6.2,
          currentPrice: 5.8,
          value: 290,
          pnl: -20,
          pnlPercentage: -6.45,
          allocation: 1.2,
          exchange: 'Kraken',
          lastUpdated: Date.now()
        }
      ];

      // Calculate metrics
      const totalValue = mockPositions.reduce((sum, pos) => sum + pos.value, 0);
      const totalPnl = mockPositions.reduce((sum, pos) => sum + pos.pnl, 0);
      const totalPnlPercentage = (totalPnl / (totalValue - totalPnl)) * 100;
      
      const bestPerformer = mockPositions.reduce((best, pos) => 
        pos.pnlPercentage > best.pnlPercentage ? pos : best
      );
      
      const worstPerformer = mockPositions.reduce((worst, pos) => 
        pos.pnlPercentage < worst.pnlPercentage ? pos : worst
      );

      const mockMetrics: PortfolioMetrics = {
        totalValue,
        totalPnl,
        totalPnlPercentage,
        dayChange: 450,
        dayChangePercentage: 1.85,
        bestPerformer,
        worstPerformer,
        riskScore: 6.8,
        sharpeRatio: 1.42,
        maxDrawdown: -12.3
      };

      // Generate historical data
      const mockHistory: PortfolioHistory[] = [];
      const days = timeframe === '1d' ? 24 : timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90;
      const interval = timeframe === '1d' ? 3600000 : 86400000; // 1 hour or 1 day

      for (let i = 0; i < days; i++) {
        const timestamp = Date.now() - (days - i) * interval;
        const baseValue = 25000;
        const trend = Math.sin((i / days) * Math.PI * 2) * 1000 + Math.random() * 500 - 250;
        const dayChange = Math.random() * 400 - 200;
        
        mockHistory.push({
          timestamp,
          totalValue: baseValue + trend,
          dayChange,
          topAssets: [
            { symbol: 'BTC', value: (baseValue + trend) * 0.45, change: dayChange * 0.4 },
            { symbol: 'ETH', value: (baseValue + trend) * 0.47, change: dayChange * 0.5 },
            { symbol: 'SOL', value: (baseValue + trend) * 0.08, change: dayChange * 0.1 }
          ]
        });
      }

      setPositions(mockPositions);
      setMetrics(mockMetrics);
      setHistory(mockHistory);
    };

    setLoading(true);
    setTimeout(() => {
      generateMockPortfolio();
      setLoading(false);
    }, 1000);
  }, [timeframe]);

  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(2)}K`;
    return `$${amount.toFixed(2)}`;
  };

  const formatPercentage = (pct: number): string => {
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
  };

  // Prepare pie chart data
  const pieData = positions.map((pos, index) => ({
    name: pos.symbol.replace('USDT', ''),
    value: pos.allocation,
    amount: pos.value,
    color: portfolioColors[index % portfolioColors.length]
  }));

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Wallet className="w-5 h-5 mr-2 text-green-400" />
            Portfolio Tracker
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

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Wallet className="w-5 h-5 mr-2 text-green-400" />
          Portfolio Tracker
        </h3>
        
        <div className="flex items-center space-x-3">
          <select
            value={view}
            onChange={(e) => setView(e.target.value as any)}
            className="bg-gray-800 text-white text-sm px-3 py-1 rounded border border-gray-600"
          >
            <option value="overview">Overview</option>
            <option value="positions">Positions</option>
            <option value="analytics">Analytics</option>
          </select>
          
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            className="bg-gray-800 text-white text-sm px-3 py-1 rounded border border-gray-600"
          >
            <option value="1d">1D</option>
            <option value="7d">7D</option>
            <option value="30d">30D</option>
            <option value="90d">90D</option>
          </select>
        </div>
      </div>

      {/* Portfolio Summary */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Value</p>
                <p className="text-white text-lg font-semibold">{formatCurrency(metrics.totalValue)}</p>
              </div>
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total P&L</p>
                <p className={`text-lg font-semibold ${metrics.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(metrics.totalPnl)}
                </p>
                <p className={`text-xs ${metrics.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPercentage(metrics.totalPnlPercentage)}
                </p>
              </div>
              {metrics.totalPnl >= 0 ? 
                <TrendingUp className="w-5 h-5 text-green-400" /> :
                <TrendingDown className="w-5 h-5 text-red-400" />
              }
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Day Change</p>
                <p className={`text-lg font-semibold ${metrics.dayChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(metrics.dayChange)}
                </p>
                <p className={`text-xs ${metrics.dayChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPercentage(metrics.dayChangePercentage)}
                </p>
              </div>
              {metrics.dayChange >= 0 ? 
                <TrendingUp className="w-5 h-5 text-green-400" /> :
                <TrendingDown className="w-5 h-5 text-red-400" />
              }
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Risk Score</p>
                <p className={`text-lg font-semibold ${metrics.riskScore <= 5 ? 'text-green-400' : metrics.riskScore <= 7 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {metrics.riskScore.toFixed(1)}/10
                </p>
              </div>
              <AlertCircle className={`w-5 h-5 ${metrics.riskScore <= 5 ? 'text-green-400' : metrics.riskScore <= 7 ? 'text-yellow-400' : 'text-red-400'}`} />
            </div>
          </div>
        </div>
      )}

      {view === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Portfolio Allocation Pie Chart */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4 flex items-center">
              <PieChart className="w-4 h-4 mr-2 text-blue-400" />
              Asset Allocation
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value.toFixed(1)}% (${formatCurrency(props.payload.amount)})`, 
                      name
                    ]}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Legend */}
            <div className="flex flex-wrap gap-2 mt-4">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  ></div>
                  <span className="text-gray-300 text-sm">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Portfolio Performance Chart */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4 flex items-center">
              <BarChart3 className="w-4 h-4 mr-2 text-purple-400" />
              Performance History
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
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
                    formatter={(value: number) => [formatCurrency(value), 'Portfolio Value']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="totalValue" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {view === 'positions' && (
        <div className="bg-gray-800 p-4 rounded-lg">
          <h4 className="text-white font-medium mb-4 flex items-center">
            <Target className="w-4 h-4 mr-2 text-yellow-400" />
            Current Positions
          </h4>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Asset</th>
                  <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Amount</th>
                  <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Avg Price</th>
                  <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Current Price</th>
                  <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Value</th>
                  <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">P&L</th>
                  <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Allocation</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position, index) => (
                  <tr key={position.symbol} className="border-b border-gray-700 hover:bg-gray-700 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: portfolioColors[index % portfolioColors.length] }}
                        ></div>
                        <div>
                          <p className="text-white text-sm font-medium">{position.symbol.replace('USDT', '')}</p>
                          <p className="text-gray-400 text-xs">{position.exchange}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-white text-sm">{position.amount}</td>
                    <td className="py-3 px-4 text-white text-sm">${position.avgPrice.toLocaleString()}</td>
                    <td className="py-3 px-4 text-white text-sm">${position.currentPrice.toLocaleString()}</td>
                    <td className="py-3 px-4 text-white text-sm font-medium">{formatCurrency(position.value)}</td>
                    <td className="py-3 px-4">
                      <div className={`text-sm font-medium ${position.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(position.pnl)}
                      </div>
                      <div className={`text-xs ${position.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPercentage(position.pnlPercentage)}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-white text-sm">{position.allocation.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'analytics' && metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Performance Metrics */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4">Performance Analytics</h4>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Sharpe Ratio</span>
                <span className="text-white font-medium">{metrics.sharpeRatio.toFixed(2)}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Max Drawdown</span>
                <span className="text-red-400 font-medium">{metrics.maxDrawdown.toFixed(1)}%</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Risk Score</span>
                <span className={`font-medium ${metrics.riskScore <= 5 ? 'text-green-400' : metrics.riskScore <= 7 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {metrics.riskScore.toFixed(1)}/10
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Total Return</span>
                <span className={`font-medium ${metrics.totalPnlPercentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPercentage(metrics.totalPnlPercentage)}
                </span>
              </div>
            </div>
          </div>

          {/* Top Performers */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4">Top/Bottom Performers</h4>
            
            <div className="space-y-4">
              <div className="p-3 bg-green-900/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-400 text-sm font-medium">Best Performer</p>
                    <p className="text-white">{metrics.bestPerformer.symbol.replace('USDT', '')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-green-400 font-medium">{formatPercentage(metrics.bestPerformer.pnlPercentage)}</p>
                    <p className="text-green-400 text-sm">{formatCurrency(metrics.bestPerformer.pnl)}</p>
                  </div>
                </div>
              </div>
              
              <div className="p-3 bg-red-900/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-red-400 text-sm font-medium">Worst Performer</p>
                    <p className="text-white">{metrics.worstPerformer.symbol.replace('USDT', '')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-400 font-medium">{formatPercentage(metrics.worstPerformer.pnlPercentage)}</p>
                    <p className="text-red-400 text-sm">{formatCurrency(metrics.worstPerformer.pnl)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortfolioTracker;