import React from 'react';

interface ExchangeData {
  name: string;
  rank: number;
  volume24h: string;
  openInterest: string;
  takerFee: number;
  makerFee: number;
  liquidation24h: string;
  score: number;
}

interface ExchangeTableProps {
  exchanges: ExchangeData[];
}

const ExchangeTable: React.FC<ExchangeTableProps> = ({ exchanges }) => {
  return (
    <div className="w-full overflow-hidden rounded-lg shadow">
      <div className="w-full overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-800 border-b border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Rank</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Exchange</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">24h Volume</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Open Interest</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Taker Fee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Maker Fee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">24h Liquidation</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Score</th>
            </tr>
          </thead>
          <tbody className="bg-gray-900 divide-y divide-gray-800">
            {exchanges.map((exchange, index) => (
              <tr 
                key={exchange.name} 
                className={`hover:bg-gray-800 transition-colors ${index % 2 === 0 ? 'bg-gray-800/20' : 'bg-gray-800/10'}`}
              >
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center justify-center">
                    <span className={`
                      h-6 w-6 rounded-full flex items-center justify-center text-xs
                      ${exchange.rank <= 3 ? 'bg-green-700/50 text-green-400' : 'bg-gray-800 text-gray-400'}
                    `}>
                      {exchange.rank}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="font-medium text-white">{exchange.name}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-gray-300">{exchange.volume24h}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-gray-300">{exchange.openInterest}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-gray-300">{exchange.takerFee}%</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-gray-300">{exchange.makerFee}%</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="text-gray-300">{exchange.liquidation24h}</div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div 
                      className="h-2 rounded-full overflow-hidden bg-gray-700 w-16 mr-2"
                      style={{ 
                        background: `linear-gradient(90deg, 
                          ${exchange.score >= 85 ? '#22c55e' : exchange.score >= 70 ? '#eab308' : '#ef4444'} 
                          ${exchange.score}%, 
                          #374151 ${exchange.score}%)` 
                      }}
                    ></div>
                    <span className={`
                      font-medium
                      ${exchange.score >= 85 ? 'text-green-400' : exchange.score >= 70 ? 'text-yellow-400' : 'text-red-400'}
                    `}>
                      {exchange.score}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExchangeTable; 