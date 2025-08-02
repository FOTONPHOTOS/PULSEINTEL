import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface FundingRate {
  exchange: string;
  rate: number;
  nextFundingTime?: number;
  timestamp: number;
}

interface FundingRateStats {
  avgRate: number;
  highestRate: { rate: number; exchange: string };
  lowestRate: { rate: number; exchange: string };
  arbitrageOpportunity?: {
    longExchange: string;
    shortExchange: string;
    difference: number;
  };
}

interface FundingRateTableProps {
  rates: FundingRate[];
  stats?: FundingRateStats;
}

const FundingRateTable: React.FC<FundingRateTableProps> = ({ rates, stats }) => {
  // Sort by absolute rate (highest magnitude first)
  const sortedRates = [...rates].sort((a, b) => Math.abs(b.rate) - Math.abs(a.rate));
  
  // Format percentage function
  const formatRate = (rate: number) => {
    const absRate = Math.abs(rate);
    return `${absRate < 0.001 ? absRate.toFixed(6) : absRate.toFixed(4)}%`;
  };
  
  // Format timestamp to local time
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  // Calculate next funding time
  const getNextFundingTime = (timestamp?: number) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="w-full overflow-hidden">
      {stats && (
        <div className="bg-gray-800/30 p-4 rounded-lg mb-4">
          <h3 className="text-lg font-bold mb-2 text-white">Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800/50 p-3 rounded-lg">
              <div className="text-gray-400 text-sm">Average Rate</div>
              <div className={`text-xl font-bold ${stats.avgRate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.avgRate >= 0 ? '+' : ''}{formatRate(stats.avgRate)}
              </div>
            </div>
            <div className="bg-gray-800/50 p-3 rounded-lg">
              <div className="text-gray-400 text-sm">Highest Rate</div>
              <div className="text-xl font-bold text-green-400">
                +{formatRate(stats.highestRate.rate)} ({stats.highestRate.exchange})
              </div>
            </div>
            <div className="bg-gray-800/50 p-3 rounded-lg">
              <div className="text-gray-400 text-sm">Lowest Rate</div>
              <div className="text-xl font-bold text-red-400">
                {stats.lowestRate.rate >= 0 ? '+' : ''}{formatRate(stats.lowestRate.rate)} ({stats.lowestRate.exchange})
              </div>
            </div>
          </div>
          
          {stats.arbitrageOpportunity && (
            <div className="mt-4 bg-blue-900/30 p-3 rounded-lg border border-blue-500/30">
              <div className="flex items-center text-blue-400 mb-1">
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-bold">Funding Arbitrage Opportunity</span>
              </div>
              <p className="text-sm text-gray-300">
                Long on <span className="font-bold text-green-400">{stats.arbitrageOpportunity.longExchange}</span> and 
                Short on <span className="font-bold text-red-400">{stats.arbitrageOpportunity.shortExchange}</span> for 
                <span className="font-bold text-white ml-1">{formatRate(stats.arbitrageOpportunity.difference)}</span> difference
              </p>
            </div>
          )}
        </div>
      )}
      
      <div className="rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-800">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Exchange
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Funding Rate
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Next Funding
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="bg-gray-900 divide-y divide-gray-800">
            {sortedRates.map((rate, index) => (
              <tr key={rate.exchange} className={index % 2 === 0 ? 'bg-gray-800/20' : 'bg-gray-800/10'}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium text-white capitalize">{rate.exchange}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`flex items-center font-medium ${rate.rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {rate.rate >= 0 ? (
                      <ArrowUp className="w-4 h-4 mr-1" />
                    ) : (
                      <ArrowDown className="w-4 h-4 mr-1" />
                    )}
                    {rate.rate >= 0 ? '+' : ''}{formatRate(rate.rate)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-gray-300">{getNextFundingTime(rate.nextFundingTime)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-gray-400 text-sm">{formatTime(rate.timestamp)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FundingRateTable; 