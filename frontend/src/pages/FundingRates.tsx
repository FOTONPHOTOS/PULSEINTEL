import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import FundingRateMatrix from '../components/FundingRateMatrix';
import FundingRateHeatmap from '../components/FundingRateHeatmap';
import { apiConfig } from '../apiConfig';
import { AlertTriangle } from 'lucide-react';

// This page will now fetch the data and pass it down to its child components.
export function FundingRates() {
  const [activeSymbol, setActiveSymbol] = useState<string>('BTCUSDT');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // We no longer need to store the data here, as the child components
  // will be responsible for their own data fetching and state management.
  // This page acts as a container and symbol selector.

  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT'];

  useEffect(() => {
    // The page itself doesn't need to load data, just the components within it.
    // We can set loading to false after a short delay to give components time to load.
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-white">Funding Rate Analysis</h2>
          <p className="text-slate-400 mt-1">
            Comparing funding rates across major exchanges for arbitrage opportunities.
          </p>
        </div>
      </div>
      
      {/* Symbol selector */}
      <div className="flex flex-wrap gap-2">
        {symbols.map((symbol) => (
          <button
            key={symbol}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSymbol === symbol
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700'
            }`}
            onClick={() => setActiveSymbol(symbol)}
          >
            {symbol}
          </button>
        ))}
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-slate-300">Loading Funding Rate Components...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-500/20 text-red-400 p-6 rounded-lg flex items-center gap-4">
          <AlertTriangle className="h-8 w-8" />
          <div>
            <h3 className="text-xl font-bold">Error Loading Page</h3>
            <p>{error}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Funding Rate Heatmap (now self-contained) */}
          <div className="xl:col-span-2">
            <FundingRateHeatmap selectedAsset={activeSymbol} />
          </div>

          {/* Funding Rate Matrix (now self-contained) */}
          <div className="xl:col-span-2">
            <FundingRateMatrix symbols={[activeSymbol]} />
          </div>
        </div>
      )}
    </div>
  );
} 