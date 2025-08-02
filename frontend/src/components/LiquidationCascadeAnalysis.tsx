import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface LiquidationCascadeAnalysisProps {
  selectedAsset: string;
}

const LiquidationCascadeAnalysis: React.FC<LiquidationCascadeAnalysisProps> = ({ selectedAsset }) => {
  return (
    <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white flex items-center">
            <AlertTriangle className="h-6 w-6 text-red-400 mr-3" />
            Liquidation Cascade Analysis
            <span className="ml-3 text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded border border-red-500/30">
              RISK
            </span>
          </h3>
          <p className="text-slate-400 text-sm mt-1">Cascade risk analysis for {selectedAsset}</p>
        </div>
      </div>

      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
        <p className="text-slate-400">Liquidation analysis loading...</p>
        <p className="text-slate-500 text-sm">Calculating cascade probability</p>
      </div>
    </div>
  );
};

export default LiquidationCascadeAnalysis;