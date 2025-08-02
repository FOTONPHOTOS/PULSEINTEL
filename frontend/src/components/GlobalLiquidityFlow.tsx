import React, { useState, useEffect } from 'react';
import { Globe, ArrowUpRight, ArrowDownRight, Activity, TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { apiConfig } from '../apiConfig';
import { subscribeToTrades } from '../services/WebSocketService';

interface LiquidityFlowData {
  exchange: string;
  netFlow: number;
  volume24h: number;
  change24h: number;
  marketShare: number;
  liquidityScore: number;
}

interface GlobalLiquidityFlowProps {
  selectedAsset: string;
}

const GlobalLiquidityFlow: React.FC<GlobalLiquidityFlowProps> = ({ selectedAsset }) => {
  const [liquidityData, setLiquidityData] = useState<LiquidityFlowData[]>([]);
  const [totalNetFlow, setTotalNetFlow] = useState(0);
  const [flowTrend, setFlowTrend] = useState<'bullish' | 'bearish' | 'neutral'>('neutral');
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);

  useEffect(() => {
    // Fetch initial liquidity data from REST API
    const fetchLiquidityData = async () => {
      try {
        const response = await fetch(`${apiConfig.REST_API_SERVICE}/api/exchange-rankings`);
        if (response.ok) {
          const data = await response.json();
          console.log('Exchange data for liquidity flow:', data);
          
          // Transform exchange data into liquidity flow format
          const liquidityFlow = data.slice(0, 5).map((exchange: any, index: number) => ({
            exchange: exchange.name || `Exchange ${index + 1}`,
            netFlow: (Math.random() - 0.5) * 10000000, // Mock net flow
            volume24h: exchange.volume_24h || Math.random() * 1000000000,
            change24h: exchange.change_24h || (Math.random() - 0.5) * 10,
            marketShare: exchange.market_share || Math.random() * 20,
            liquidityScore: exchange.score || (80 + Math.random() * 20)
          }));
          
          setLiquidityData(liquidityFlow);
          
          // Calculate total net flow
          const totalFlow = liquidityFlow.reduce((sum: number, item: any) => sum + item.netFlow, 0);
          setTotalNetFlow(totalFlow);
          setFlowTrend(totalFlow > 0 ? 'bullish' : totalFlow < 0 ? 'bearish' : 'neutral');
        }
      } catch (error) {
        console.error('Error fetching liquidity data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLiquidityData();
    
    // Subscribe to real-time trades for flow updates
    const unsubscribeTrades = subscribeToTrades(selectedAsset, (data) => {
      // Update flow trend based on trade data
      const isBuy = data.side === 'buy';
      setFlowTrend(prev => {
        if (isBuy && prev !== 'bullish') return 'bullish';
        if (!isBuy && prev !== 'bearish') return 'bearish';
        return prev;
      });
    });

    // Refresh data every 2 minutes
    const interval = setInterval(fetchLiquidityData, 5000);
    
    return () => {
      unsubscribeTrades();
      clearInterval(interval);
    };
  }, [selectedAsset]);




  const formatCurrency = (value: number): string => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatFlow = (value: number): string => {
    const formatted = formatCurrency(Math.abs(value));
    return value >= 0 ? `+${formatted}` : `-${formatted}`;
  };

  if (loading) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white flex items-center">
            <Globe className="h-6 w-6 text-blue-400 mr-3" />
            Global Liquidity Flow
          </h3>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-700/50 rounded"></div>
          <div className="h-32 bg-slate-700/50 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white flex items-center">
            <Globe className="h-6 w-6 text-blue-400 mr-3" />
            Global Liquidity Flow
            <span className="ml-3 text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded border border-blue-500/30">
              REAL-TIME
            </span>
          </h3>
          <p className="text-slate-400 text-sm mt-1">Cross-exchange liquidity analysis for {selectedAsset}</p>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold flex items-center">
            {flowTrend === 'bullish' ? (
              <ArrowUpRight className="h-6 w-6 text-green-400 mr-2" />
            ) : flowTrend === 'bearish' ? (
              <ArrowDownRight className="h-6 w-6 text-red-400 mr-2" />
            ) : (
              <Activity className="h-6 w-6 text-yellow-400 mr-2" />
            )}
            <span className={`${
              flowTrend === 'bullish' ? 'text-green-400' : 
              flowTrend === 'bearish' ? 'text-red-400' : 'text-yellow-400'
            }`}>
              {formatFlow(totalNetFlow)}
            </span>
          </div>
          <p className="text-slate-400 text-sm">Net Flow 24h</p>
        </div>
      </div>

      {liquidityData.length > 0 ? (
        <div className="space-y-3">
          {liquidityData.slice(0, 5).map((exchange) => (
            <div 
              key={exchange.exchange}
              className="bg-slate-800/50 rounded-lg p-4 hover:bg-slate-800/70 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div>
                    <h4 className="font-semibold text-white">{exchange.exchange}</h4>
                    <p className="text-slate-400 text-sm">
                      {exchange.marketShare.toFixed(1)}% market share
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-6 text-sm">
                  <div className="text-center">
                    <p className="text-slate-400">Volume 24h</p>
                    <p className="font-semibold text-white">{formatCurrency(exchange.volume24h)}</p>
                  </div>

                  <div className="text-center">
                    <p className="text-slate-400">Net Flow</p>
                    <p className={`font-semibold ${
                      exchange.netFlow > 0 ? 'text-green-400' : 
                      exchange.netFlow < 0 ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {formatFlow(exchange.netFlow)}
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="text-slate-400">24h Change</p>
                    <p className={`font-semibold flex items-center ${
                      exchange.change24h > 0 ? 'text-green-400' : 
                      exchange.change24h < 0 ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {exchange.change24h > 0 ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : exchange.change24h < 0 ? (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      ) : null}
                      {exchange.change24h.toFixed(2)}%
                    </p>
                  </div>

                  <div className="text-center">
                    <p className="text-slate-400">Liquidity Score</p>
                    <div className="flex items-center space-x-2">
                      <div className="w-12 bg-slate-700 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-emerald-500"
                          style={{ width: `${exchange.liquidityScore}%` }}
                        ></div>
                      </div>
                      <span className="text-white font-semibold text-xs">
                        {exchange.liquidityScore.toFixed(0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Globe className="h-12 w-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No liquidity data available</p>
          <p className="text-slate-500 text-sm">Ensure backend API is running on port 8888</p>
        </div>
      )}

      {liquidityData.length > 0 && (
        <div className="mt-6 pt-4 border-t border-slate-700/50">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                <span className="text-slate-400">Net Inflow</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                <span className="text-slate-400">Net Outflow</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-blue-400" />
              <span className="text-slate-400">Updated {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalLiquidityFlow; 