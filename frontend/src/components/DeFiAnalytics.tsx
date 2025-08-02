import React, { useState, useEffect } from 'react';
import { Coins, TrendingUp, Droplets, Zap, AlertTriangle, ExternalLink } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { apiConfig } from '../apiConfig';

interface LiquidityPool {
  id: string;
  protocol: string;
  pair: string;
  tvl: number;
  apy: number;
  volume24h: number;
  fees24h: number;
  impermanentLoss: number;
  riskLevel: 'Low' | 'Medium' | 'High';
}

interface YieldOpportunity {
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  risk: 'Low' | 'Medium' | 'High';
  type: 'Lending' | 'Staking' | 'LP' | 'Vault';
  lockPeriod?: string;
}

interface DeFiProtocol {
  name: string;
  tvl: number;
  change24h: number;
  dominance: number;
  category: string;
}

interface DeFiAnalyticsProps {
  className?: string;
}

const DeFiAnalytics: React.FC<DeFiAnalyticsProps> = ({ className = "" }) => {
  const [liquidityPools, setLiquidityPools] = useState<LiquidityPool[]>([]);
  const [yieldOpportunities, setYieldOpportunities] = useState<YieldOpportunity[]>([]);
  const [protocols, setProtocols] = useState<DeFiProtocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [view, setView] = useState<'pools' | 'yields' | 'protocols'>('pools');
  const [selectedChain, setSelectedChain] = useState<'ethereum' | 'bsc' | 'polygon' | 'arbitrum'>('ethereum');

  const chainColors = {
    ethereum: '#627eea',
    bsc: '#f3ba2f',
    polygon: '#8247e5',
    arbitrum: '#28a0f0'
  };

  const protocolColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  useEffect(() => {
    const fetchDeFiData = async () => {
      try {
        setLoading(true);
        
        // Fetch DeFi data from external APIs or use mock data
        // For now, using enhanced mock data that could be replaced with real APIs
        
        const mockPools: LiquidityPool[] = [
          {
            id: 'uniswap-eth-usdc',
            protocol: 'Uniswap V3',
            pair: 'ETH/USDC',
            tvl: 120000000 + Math.random() * 50000000,
            apy: 12.5 + (Math.random() - 0.5) * 5,
            volume24h: 45000000 + Math.random() * 20000000,
            fees24h: 135000 + Math.random() * 50000,
            impermanentLoss: -2.3 + (Math.random() - 0.5) * 2,
            riskLevel: 'Medium'
          },
          {
            id: 'curve-3pool',
            protocol: 'Curve',
            pair: 'DAI/USDC/USDT',
            tvl: 850000000 + Math.random() * 100000000,
            apy: 4.2 + (Math.random() - 0.5) * 2,
            volume24h: 25000000 + Math.random() * 10000000,
            fees24h: 75000 + Math.random() * 25000,
            impermanentLoss: -0.1 + (Math.random() - 0.5) * 0.2,
            riskLevel: 'Low'
          },
          {
            id: 'pancake-bnb-cake',
            protocol: 'PancakeSwap',
            pair: 'BNB/CAKE',
            tvl: 45000000 + Math.random() * 20000000,
            apy: 28.7 + (Math.random() - 0.5) * 10,
            volume24h: 12000000 + Math.random() * 5000000,
            fees24h: 36000 + Math.random() * 15000,
            impermanentLoss: -8.5 + (Math.random() - 0.5) * 5,
            riskLevel: 'High'
          }
        ];

        const mockYields: YieldOpportunity[] = [
          {
            protocol: 'Aave',
            asset: 'USDC',
            apy: 3.8 + (Math.random() - 0.5) * 2,
            tvl: 2800000000 + Math.random() * 500000000,
            risk: 'Low',
            type: 'Lending'
          },
          {
            protocol: 'Compound',
            asset: 'ETH',
            apy: 2.1 + (Math.random() - 0.5) * 1,
            tvl: 1200000000 + Math.random() * 200000000,
            risk: 'Low',
            type: 'Lending'
          },
          {
            protocol: 'Yearn',
            asset: 'yvUSDC',
            apy: 8.5 + (Math.random() - 0.5) * 3,
            tvl: 450000000 + Math.random() * 100000000,
            risk: 'Medium',
            type: 'Vault'
          }
        ];

        const mockProtocols: DeFiProtocol[] = [
          {
            name: 'Uniswap',
            tvl: 8500000000 + Math.random() * 1000000000,
            change24h: 2.1 + (Math.random() - 0.5) * 5,
            dominance: 15.8,
            category: 'DEX'
          },
          {
            name: 'Aave',
            tvl: 7200000000 + Math.random() * 800000000,
            change24h: -1.2 + (Math.random() - 0.5) * 3,
            dominance: 13.4,
            category: 'Lending'
          },
          {
            name: 'Curve',
            tvl: 6800000000 + Math.random() * 700000000,
            change24h: 0.8 + (Math.random() - 0.5) * 4,
            dominance: 12.6,
            category: 'DEX'
          }
        ];

        setLiquidityPools(mockPools);
        setYieldOpportunities(mockYields);
        setProtocols(mockProtocols);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching DeFi data:', error);
        setLoading(false);
      }
    };

    fetchDeFiData();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchDeFiData, 5000);
    return () => clearInterval(interval);
  }, [selectedChain]);

  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000000) return `$${(amount / 1000000000).toFixed(2)}B`;
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(2)}K`;
    return `$${amount.toFixed(2)}`;
  };

  const getRiskColor = (risk: string): string => {
    switch (risk) {
      case 'Low': return 'text-green-400';
      case 'Medium': return 'text-yellow-400';
      case 'High': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getRiskBadgeColor = (risk: string): string => {
    switch (risk) {
      case 'Low': return 'bg-green-900/30 text-green-400';
      case 'Medium': return 'bg-yellow-900/30 text-yellow-400';
      case 'High': return 'bg-red-900/30 text-red-400';
      default: return 'bg-gray-900/30 text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className={`bg-gray-900 border border-gray-700 rounded-xl p-6 ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center">
            <Coins className="w-5 h-5 mr-2 text-purple-400" />
            DeFi Analytics
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

  const totalTVL = protocols.reduce((sum, protocol) => sum + protocol.tvl, 0);

  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-xl p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center">
          <Coins className="w-5 h-5 mr-2 text-purple-400" />
          DeFi Analytics
        </h3>
        
        <div className="flex items-center space-x-3">
          <select
            value={selectedChain}
            onChange={(e) => setSelectedChain(e.target.value as any)}
            className="bg-gray-800 text-white text-sm px-3 py-1 rounded border border-gray-600"
          >
            <option value="ethereum">Ethereum</option>
            <option value="bsc">BSC</option>
            <option value="polygon">Polygon</option>
            <option value="arbitrum">Arbitrum</option>
          </select>
          
          <select
            value={view}
            onChange={(e) => setView(e.target.value as any)}
            className="bg-gray-800 text-white text-sm px-3 py-1 rounded border border-gray-600"
          >
            <option value="pools">Liquidity Pools</option>
            <option value="yields">Yield Opportunities</option>
            <option value="protocols">Protocol Rankings</option>
          </select>
        </div>
      </div>

      {/* DeFi Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total TVL</p>
              <p className="text-white text-lg font-semibold">{formatCurrency(totalTVL)}</p>
            </div>
            <Droplets className="w-5 h-5 text-blue-400" />
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Best APY</p>
              <p className="text-green-400 text-lg font-semibold">
                {Math.max(...yieldOpportunities.map(y => y.apy)).toFixed(1)}%
              </p>
            </div>
            <TrendingUp className="w-5 h-5 text-green-400" />
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Active Protocols</p>
              <p className="text-white text-lg font-semibold">{protocols.length}</p>
            </div>
            <Zap className="w-5 h-5 text-yellow-400" />
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Chain</p>
              <p className="text-white text-lg font-semibold capitalize">{selectedChain}</p>
            </div>
            <div 
              className="w-5 h-5 rounded-full" 
              style={{ backgroundColor: chainColors[selectedChain] }}
            ></div>
          </div>
        </div>
      </div>

      {view === 'pools' && (
        <div className="space-y-6">
          {/* Liquidity Pools Table */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4 flex items-center">
              <Droplets className="w-4 h-4 mr-2 text-blue-400" />
              Top Liquidity Pools
            </h4>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Pool</th>
                    <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Protocol</th>
                    <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">TVL</th>
                    <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">APY</th>
                    <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Volume 24H</th>
                    <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">IL</th>
                    <th className="text-left py-3 px-4 text-gray-300 text-sm font-medium">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {liquidityPools.map((pool) => (
                    <tr key={pool.id} className="border-b border-gray-700 hover:bg-gray-700 transition-colors">
                      <td className="py-3 px-4">
                        <div className="text-white text-sm font-medium">{pool.pair}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-gray-300 text-sm">{pool.protocol}</div>
                      </td>
                      <td className="py-3 px-4 text-white text-sm">{formatCurrency(pool.tvl)}</td>
                      <td className="py-3 px-4">
                        <span className="text-green-400 text-sm font-medium">{pool.apy.toFixed(1)}%</span>
                      </td>
                      <td className="py-3 px-4 text-white text-sm">{formatCurrency(pool.volume24h)}</td>
                      <td className="py-3 px-4">
                        <span className={`text-sm font-medium ${pool.impermanentLoss < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {pool.impermanentLoss.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskBadgeColor(pool.riskLevel)}`}>
                          {pool.riskLevel}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pool Performance Chart */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4">Pool APY Comparison</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={liquidityPools}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="pair" 
                    stroke="#6b7280"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis stroke="#6b7280" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Bar dataKey="apy" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {view === 'yields' && (
        <div className="space-y-6">
          {/* Yield Opportunities Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {yieldOpportunities.map((yield_opportunity, index) => (
              <div key={index} className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h5 className="text-white font-medium">{yield_opportunity.protocol}</h5>
                    <p className="text-gray-400 text-sm">{yield_opportunity.asset}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getRiskBadgeColor(yield_opportunity.risk)}`}>
                    {yield_opportunity.risk}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">APY</span>
                    <span className="text-green-400 font-semibold">{yield_opportunity.apy.toFixed(1)}%</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">TVL</span>
                    <span className="text-white text-sm">{formatCurrency(yield_opportunity.tvl)}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Type</span>
                    <span className="text-blue-400 text-sm">{yield_opportunity.type}</span>
                  </div>
                  
                  {yield_opportunity.lockPeriod && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-sm">Lock Period</span>
                      <span className="text-yellow-400 text-sm">{yield_opportunity.lockPeriod}</span>
                    </div>
                  )}
                </div>
                
                <button className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded text-sm font-medium transition-colors flex items-center justify-center">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Explore
                </button>
              </div>
            ))}
          </div>

          {/* Yield Distribution Chart */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4">Yield Distribution by Type</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={yieldOpportunities.reduce((acc, yield_opportunity) => {
                      const existing = acc.find(item => item.name === yield_opportunity.type);
                      if (existing) {
                        existing.value += yield_opportunity.apy;
                        existing.count += 1;
                      } else {
                        acc.push({
                          name: yield_opportunity.type,
                          value: yield_opportunity.apy,
                          count: 1
                        });
                      }
                      return acc;
                    }, [] as any[])}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="value"
                  >
                    {yieldOpportunities.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={protocolColors[index % protocolColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {view === 'protocols' && (
        <div className="space-y-6">
          {/* Protocol Rankings */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4 flex items-center">
              <Zap className="w-4 h-4 mr-2 text-yellow-400" />
              Protocol Rankings by TVL
            </h4>
            
            <div className="space-y-3">
              {protocols.map((protocol, index) => (
                <div key={protocol.name} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="text-gray-400 font-medium">#{index + 1}</div>
                    <div>
                      <div className="text-white font-medium">{protocol.name}</div>
                      <div className="text-gray-400 text-sm">{protocol.category}</div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-white font-semibold">{formatCurrency(protocol.tvl)}</div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm ${protocol.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {protocol.change24h >= 0 ? '+' : ''}{protocol.change24h.toFixed(1)}%
                      </span>
                      <span className="text-gray-400 text-sm">
                        {protocol.dominance.toFixed(1)}% dominance
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TVL Chart */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h4 className="text-white font-medium mb-4">TVL Comparison</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={protocols} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#6b7280" />
                  <YAxis dataKey="name" type="category" stroke="#6b7280" width={100} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'TVL']}
                  />
                  <Bar dataKey="tvl" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeFiAnalytics;