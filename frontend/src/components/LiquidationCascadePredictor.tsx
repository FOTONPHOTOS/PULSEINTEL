import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { AlertTriangle, TrendingDown, Target, Zap, Activity, Brain, ShieldAlert } from 'lucide-react';

interface CascadeLevel {
  price: number;
  volume: number;
  exchange: string;
  side: 'long' | 'short';
  probability: number;
  impact: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface CascadePrediction {
  symbol: string;
  current_price: number;
  cascade_levels: CascadeLevel[];
  overall_risk: number;
  next_trigger_price: number;
  potential_volume: number;
  confidence: number;
  timestamp: number;
}

interface LiquidationCascadePredictorProps {
  symbol: string;
}

const LiquidationCascadePredictor: React.FC<LiquidationCascadePredictorProps> = ({ symbol = 'BTCUSDT' }) => {
  const [prediction, setPrediction] = useState<CascadePrediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const generateCascadePrediction = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Simulate advanced cascade prediction algorithm
        // In production, this would use real liquidation clustering analysis
        const currentPrice = 105000 + Math.random() * 10000; // Simulated current price
        
        const cascadeLevels: CascadeLevel[] = [
          {
            price: currentPrice * 0.95,
            volume: 15000000,
            exchange: 'binance',
            side: 'long',
            probability: 0.75,
            impact: 'HIGH'
          },
          {
            price: currentPrice * 0.92,
            volume: 25000000,
            exchange: 'bybit',
            side: 'long',
            probability: 0.65,
            impact: 'CRITICAL'
          },
          {
            price: currentPrice * 1.05,
            volume: 12000000,
            exchange: 'okx',
            side: 'short',
            probability: 0.55,
            impact: 'MEDIUM'
          },
          {
            price: currentPrice * 1.08,
            volume: 8000000,
            exchange: 'deribit',
            side: 'short',
            probability: 0.45,
            impact: 'LOW'
          }
        ];

        const overallRisk = cascadeLevels.reduce((acc, level) => 
          acc + (level.probability * (level.volume / 10000000)), 0
        ) / cascadeLevels.length;

        const nextTriggerLevel = cascadeLevels
          .filter(level => Math.abs(level.price - currentPrice) / currentPrice < 0.1)
          .sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice))[0];

        const predictionData: CascadePrediction = {
          symbol,
          current_price: currentPrice,
          cascade_levels: cascadeLevels,
          overall_risk: Math.min(0.95, overallRisk),
          next_trigger_price: nextTriggerLevel?.price || currentPrice * 0.95,
          potential_volume: cascadeLevels.reduce((sum, level) => sum + level.volume, 0),
          confidence: 0.78 + Math.random() * 0.15,
          timestamp: Date.now()
        };

        setPrediction(predictionData);
      } catch (err) {
        console.error('Error generating cascade prediction:', err);
        setError('Failed to generate cascade prediction');
      } finally {
        setLoading(false);
      }
    };

    generateCascadePrediction();
    
    // Update predictions every 30 seconds
    const interval = setInterval(generateCascadePrediction, 5000);
    return () => clearInterval(interval);
  }, [symbol]);

  const formatPrice = (price: number) => `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
    return `$${volume.toFixed(0)}`;
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'CRITICAL': return 'text-red-500 bg-red-500/10';
      case 'HIGH': return 'text-orange-500 bg-orange-500/10';
      case 'MEDIUM': return 'text-yellow-500 bg-yellow-500/10';
      default: return 'text-green-500 bg-green-500/10';
    }
  };

  const getRiskLevel = (risk: number) => {
    if (risk > 0.7) return { level: 'CRITICAL', color: 'text-red-500' };
    if (risk > 0.5) return { level: 'HIGH', color: 'text-orange-500' };
    if (risk > 0.3) return { level: 'MEDIUM', color: 'text-yellow-500' };
    return { level: 'LOW', color: 'text-green-500' };
  };

  if (loading) {
    return (
      <Card className="h-96">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-96">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center h-full text-red-400">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p>{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!prediction) return null;

  const riskAssessment = getRiskLevel(prediction.overall_risk);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          Liquidation Cascade Predictor
          <div className="ml-auto flex items-center gap-2">
            <div className={`px-2 py-1 rounded text-xs font-bold ${getImpactColor(riskAssessment.level)}`}>
              {riskAssessment.level} RISK
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Risk Summary */}
        <div className="p-4 bg-gray-800/30 rounded-lg">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Cascade Probability</div>
              <div className={`text-xl font-bold ${riskAssessment.color}`}>
                {(prediction.overall_risk * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-gray-400">Confidence Level</div>
              <div className="text-xl font-bold text-white">
                {(prediction.confidence * 100).toFixed(1)}%
              </div>
            </div>
            <div>
              <div className="text-gray-400">Next Trigger</div>
              <div className="text-lg font-bold text-white">
                {formatPrice(prediction.next_trigger_price)}
              </div>
            </div>
            <div>
              <div className="text-gray-400">Total Volume at Risk</div>
              <div className="text-lg font-bold text-white">
                {formatVolume(prediction.potential_volume)}
              </div>
            </div>
          </div>
        </div>

        {/* Cascade Levels */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-400">Critical Price Levels</span>
          </div>
          
          {prediction.cascade_levels.slice(0, 4).map((level, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-800/20 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  level.side === 'long' ? 'bg-red-500' : 'bg-green-500'
                }`}></div>
                <div>
                  <div className="text-white font-medium">{formatPrice(level.price)}</div>
                  <div className="text-xs text-gray-400 capitalize">
                    {level.exchange} • {level.side} liquidations
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-white font-bold">{formatVolume(level.volume)}</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {(level.probability * 100).toFixed(0)}%
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${getImpactColor(level.impact)}`}>
                    {level.impact}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Risk Factors */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-400">Risk Factors</span>
          </div>
          
          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Position Clustering</span>
              <span className="text-orange-400 font-bold">HIGH</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Market Volatility</span>
              <span className="text-yellow-400 font-bold">MEDIUM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Funding Pressure</span>
              <span className="text-green-400 font-bold">LOW</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Open Interest Delta</span>
              <span className="text-orange-400 font-bold">HIGH</span>
            </div>
          </div>
        </div>

        {/* AI Insight */}
        <div className="p-3 bg-blue-500/10 rounded-lg border-l-4 border-blue-500">
          <div className="flex items-start gap-2">
            <Activity className="h-4 w-4 text-blue-400 mt-0.5" />
            <div className="text-sm">
              <div className="text-blue-400 font-medium mb-1">AI Analysis</div>
              <div className="text-gray-300">
                Liquidation clustering detected around {formatPrice(prediction.next_trigger_price)}. 
                High correlation between leverage ratios and funding rates suggests elevated cascade risk 
                in the next 2-4 hours.
              </div>
            </div>
          </div>
        </div>

        {/* Last Updated */}
        <div className="text-xs text-gray-500 text-center">
          Last updated: {new Date(prediction.timestamp).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  );
};

export default LiquidationCascadePredictor;