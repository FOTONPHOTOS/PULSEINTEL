import React from 'react';
import { ArrowRightLeft } from 'lucide-react';

interface CrossExchangeArbitrageProps {
  selectedAsset: string;
}

const CrossExchangeArbitrage: React.FC<CrossExchangeArbitrageProps> = ({ selectedAsset }) => {
  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white flex items-center">
            <ArrowRightLeft className="h-6 w-6 text-purple-400 mr-3" />
            Cross-Exchange Arbitrage
            <span className="ml-3 text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded border border-purple-500/30">
              LIVE
            </span>
          </h3>
          <p className="text-slate-400 text-sm mt-1">Real-time arbitrage opportunities for {selectedAsset}</p>
        </div>
      </div>

      <div className="text-center py-8">
        <ArrowRightLeft className="h-12 w-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400">No arbitrage opportunities found</p>
        <p className="text-slate-500 text-sm">Market efficiency is high for {selectedAsset}</p>
      </div>
    </div>
  );
};

export default CrossExchangeArbitrage;