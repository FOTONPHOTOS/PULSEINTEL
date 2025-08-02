import React, { useEffect, useState } from 'react';
import { apiConfig } from '../apiConfig';

interface ArbitrageOpportunity {
  buy_exchange: string;
  sell_exchange: string;
  buy_price: number;
  sell_price: number;
  profit_percentage: number;
}

interface ArbitrageData {
  opportunities: ArbitrageOpportunity[];
  stats: {
    count: number;
    max_profit: number;
  };
}

export default function Arbitrage() {
  const [data, setData] = useState<ArbitrageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const symbol = 'BTCUSDT';

  useEffect(() => {
    const fetchArbitrageData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(`${apiConfig.REST_API_SERVICE}/api/arbitrage/${symbol}`);
        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }
        
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        console.error('Failed to fetch arbitrage data:', err);
        setError(err.message || 'Failed to fetch arbitrage data.');
      } finally {
        setLoading(false);
      }
    };

    fetchArbitrageData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(fetchArbitrageData, 5000);
    
    return () => clearInterval(interval);
  }, [symbol]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-red-500">
        <span className="text-lg font-semibold">{error}</span>
      </div>
    );
  }

  if (!data || !data.opportunities.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400">
        <span className="text-lg font-semibold">No arbitrage opportunities detected.</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-8">
      <h2 className="text-2xl font-bold mb-4">Arbitrage Opportunities ({symbol})</h2>
      <table className="min-w-full bg-gray-900 rounded-lg overflow-hidden">
        <thead>
          <tr>
            <th className="px-4 py-2 text-left">Buy Exchange</th>
            <th className="px-4 py-2 text-left">Sell Exchange</th>
            <th className="px-4 py-2 text-right">Buy Price</th>
            <th className="px-4 py-2 text-right">Sell Price</th>
            <th className="px-4 py-2 text-right">Profit (%)</th>
          </tr>
        </thead>
        <tbody>
          {data.opportunities.map((row, idx) => (
            <tr key={idx} className="border-b border-gray-700">
              <td className="px-4 py-2">{row.buy_exchange}</td>
              <td className="px-4 py-2">{row.sell_exchange}</td>
              <td className="px-4 py-2 text-right">{row.buy_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              <td className="px-4 py-2 text-right">{row.sell_price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              <td className="px-4 py-2 text-right font-semibold text-green-400">{row.profit_percentage.toFixed(4)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 text-sm text-gray-400">
        <div>Total Opportunities: <span className="text-blue-400">{data.stats.count}</span></div>
        <div>Max Profit: <span className="text-yellow-400">{data.stats.max_profit.toFixed(4)}%</span></div>
      </div>
    </div>
  );
} 