import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, TrendingUp, TrendingDown, Activity, Target, Gauge } from 'lucide-react';

interface RiskMetrics {
  overall_risk: number;
  liquidation_pressure: number;
  cascade_probability: number;
  market_stability: number;
  position_concentration: number;
  funding_stress: number;
  momentum_risk: number;
}

interface RiskLevel {
  level: 'low' | 'medium' | 'high' | 'critical';
  score: number;
  description: string;
  recommendations: string[];
}

interface LiquidationRiskAssessmentProps {
  symbol: string;
}

const LiquidationRiskAssessment: React.FC<LiquidationRiskAssessmentProps> = ({ symbol = 'BTCUSDT' }) => {
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [riskLevel, setRiskLevel] = useState<RiskLevel | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const assessRisk = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const [liquidationsRes, tickerRes] = await Promise.all([
                  fetch(`/api/liquidations/${symbol}`),
        fetch(`/api/ticker/${symbol}`)
        ]);

        const liquidationData = await liquidationsRes.json();
        const tickerData = await tickerRes.json();

        if (!tickerData) {
          throw new Error('Failed to fetch required data for risk assessment');
        }

        const currentPrice = tickerData.price || tickerData.lastPrice;
        
        let liquidations: any[] = [];
        if (Array.isArray(liquidationData)) {
          liquidations = liquidationData;
        } else if (liquidationData && liquidationData.liquidations) {
          liquidations = liquidationData.liquidations;
        }

        const now = Date.now();
        const last24h = now - (24 * 60 * 60 * 1000);
        const recentLiquidations = liquidations.filter(liq => liq.timestamp > last24h);
        const totalLiquidationVolume = recentLiquidations.reduce((acc, liq) => acc + (liq.amount || liq.size || 0), 0);
        const liquidationPressure = Math.min((totalLiquidationVolume / 10000000) * 100, 100);

        const priceRanges = new Map();
        recentLiquidations.forEach(liq => {
          const priceRange = Math.floor((liq.price || currentPrice) / 1000) * 1000;
          priceRanges.set(priceRange, (priceRanges.get(priceRange) || 0) + 1);
        });
        const maxCluster = Math.max(...Array.from(priceRanges.values()), 0);
        const cascadeProbability = Math.min((maxCluster / 10) * 100, 100);

        const priceChange = Math.abs(tickerData.change_24h || 0);
        const marketStability = Math.max(100 - (priceChange * 2), 0);

        const longLiqs = recentLiquidations.filter(liq => liq.side === 'long' || liq.side === 'sell').length;
        const shortLiqs = recentLiquidations.filter(liq => liq.side === 'short' || liq.side === 'buy').length;
        const totalLiqs = longLiqs + shortLiqs;
        const concentrationRatio = totalLiqs > 0 ? Math.max(longLiqs, shortLiqs) / totalLiqs : 0.5;
        const positionConcentration = (concentrationRatio - 0.5) * 200;

        const fundingStress = 50;

        const last1h = now - (60 * 60 * 1000);
        const recentHourLiqs = recentLiquidations.filter(liq => liq.timestamp > last1h);
        const hourlyRate = recentHourLiqs.length;
        const momentumRisk = Math.min(hourlyRate * 5, 100);

        const metrics: RiskMetrics = {
          overall_risk: 0,
          liquidation_pressure: liquidationPressure,
          cascade_probability: cascadeProbability,
          market_stability: marketStability,
          position_concentration: positionConcentration,
          funding_stress: fundingStress,
          momentum_risk: momentumRisk
        };

        const overallRisk = Math.max(0, Math.min(100,
          metrics.liquidation_pressure * 0.25 +
          metrics.cascade_probability * 0.20 +
          metrics.market_stability * -0.15 +
          metrics.position_concentration * 0.15 +
          metrics.funding_stress * 0.15 +
          metrics.momentum_risk * 0.20 + 50
        ));

        metrics.overall_risk = overallRisk;

        let level: RiskLevel;
        if (overallRisk < 25) {
          level = {
            level: 'low',
            score: overallRisk,
            description: 'Market conditions are stable with low liquidation risk',
            recommendations: [
              'Normal trading conditions',
              'Monitor for position size optimization',
              'Consider taking advantage of stable conditions'
            ]
          };
        } else if (overallRisk < 50) {
          level = {
            level: 'medium',
            score: overallRisk,
            description: 'Moderate liquidation risk detected in current conditions',
            recommendations: [
              'Exercise caution with leverage',
              'Monitor liquidation levels closely',
              'Consider reducing position sizes'
            ]
          };
        } else if (overallRisk < 75) {
          level = {
            level: 'high',
            score: overallRisk,
            description: 'Elevated liquidation risk - heightened market stress',
            recommendations: [
              'Reduce leverage immediately',
              'Set tight stop losses',
              'Avoid opening new leveraged positions',
              'Monitor for cascade events'
            ]
          };
        } else {
          level = {
            level: 'critical',
            score: overallRisk,
            description: 'Critical liquidation risk - potential cascade conditions',
            recommendations: [
              'Close leveraged positions immediately',
              'Avoid all leveraged trading',
              'Wait for market stabilization',
              'Prepare for high volatility'
            ]
          };
        }

        setRiskMetrics(metrics);
        setRiskLevel(level);
      } catch (err) {
        console.error('Error assessing liquidation risk:', err);
        setError('Failed to assess liquidation risk');
      } finally {
        setLoading(false);
      }
    };

    assessRisk();
    
    const interval = setInterval(assessRisk, 180000);
    return () => clearInterval(interval);
  }, [symbol]);

  const getRiskColor = (risk: number) => {
    if (risk < 25) return 'text-green-400';
    if (risk < 50) return 'text-yellow-400';
    if (risk < 75) return 'text-orange-400';
    return 'text-red-400';
  };

  const getRiskBgColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-500/20 border-green-500/30';
      case 'medium': return 'bg-yellow-500/20 border-yellow-500/30';
      case 'high': return 'bg-orange-500/20 border-orange-500/30';
      case 'critical': return 'bg-red-500/20 border-red-500/30';
      default: return 'bg-gray-500/20 border-gray-500/30';
    }
  };

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case 'liquidation_pressure': return <Target className="h-5 w-5" />;
      case 'cascade_probability': return <TrendingDown className="h-5 w-5" />;
      case 'market_stability': return <Shield className="h-5 w-5" />;
      case 'position_concentration': return <Activity className="h-5 w-5" />;
      case 'funding_stress': return <AlertTriangle className="h-5 w-5" />;
      case 'momentum_risk': return <TrendingUp className="h-5 w-5" />;
      default: return <Gauge className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 h-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Shield className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <h3 className="font-bold text-xl text-white">Risk Assessment</h3>
            <p className="text-gray-400 text-sm">Real-time liquidation risk analysis</p>
          </div>
        </div>
        
        <div className="text-center py-12">
          <Gauge className="h-16 w-16 mx-auto mb-4 text-gray-600 animate-pulse" />
          <p className="text-gray-500">Analyzing market risk...</p>
        </div>
      </div>
    );
  }

  if (error || !riskMetrics || !riskLevel) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 h-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Shield className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <h3 className="font-bold text-xl text-white">Risk Assessment</h3>
            <p className="text-gray-400 text-sm">Real-time liquidation risk analysis</p>
          </div>
        </div>
        
        <div className="text-center py-12">
          <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-red-500/50" />
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-6 h-full overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-orange-500/20 rounded-lg">
          <Shield className="h-6 w-6 text-orange-400" />
        </div>
        <div>
          <h3 className="font-bold text-xl text-white">Risk Assessment</h3>
          <p className="text-gray-400 text-sm">Real-time liquidation risk analysis</p>
        </div>
      </div>

      <div className={`mb-6 p-6 rounded-lg border ${getRiskBgColor(riskLevel.level)}`}>
        <div className="text-center">
          <div className={`text-6xl font-bold mb-2 ${getRiskColor(riskLevel.score)}`}>
            {riskLevel.score.toFixed(0)}
          </div>
          <div className="text-2xl font-semibold text-white mb-2">
            {riskLevel.level.toUpperCase()} RISK
          </div>
          <div className="text-gray-300 mb-4">
            {riskLevel.description}
          </div>
          
          <div className="w-full bg-gray-700 rounded-full h-4 mb-4">
            <div 
              className={`h-4 rounded-full transition-all duration-1000 ${
                riskLevel.score < 25 ? 'bg-green-500' :
                riskLevel.score < 50 ? 'bg-yellow-500' :
                riskLevel.score < 75 ? 'bg-orange-500' : 'bg-red-500'
              }`}
              style={{ width: `${riskLevel.score}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h4 className="font-semibold text-white mb-4">Risk Metrics Breakdown</h4>
        <div className="space-y-3">
          {Object.entries(riskMetrics).filter(([key]) => key !== 'overall_risk').map(([key, value]) => {
            const metricName = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            const isStability = key === 'market_stability';
            const displayValue = isStability ? 100 - value : value;
            
            return (
              <div key={key} className="bg-gray-800/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={getRiskColor(displayValue)}>
                      {getMetricIcon(key)}
                    </div>
                    <span className="text-white font-medium">{metricName}</span>
                  </div>
                  <div className={`font-bold ${getRiskColor(displayValue)}`}>
                    {displayValue.toFixed(0)}%
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-1000 ${
                      displayValue < 25 ? 'bg-green-500' :
                      displayValue < 50 ? 'bg-yellow-500' :
                      displayValue < 75 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${displayValue}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-6">
        <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Risk Management Recommendations
        </h4>
        <div className="space-y-2">
          {riskLevel.recommendations.map((rec, index) => (
            <div key={index} className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-lg">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 ${
                riskLevel.level === 'critical' ? 'bg-red-500 text-white' :
                riskLevel.level === 'high' ? 'bg-orange-500 text-white' :
                riskLevel.level === 'medium' ? 'bg-yellow-500 text-black' :
                'bg-green-500 text-white'
              }`}>
                {index + 1}
              </div>
              <div className="text-gray-300 text-sm">{rec}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-gray-700/50">
        <div className="flex items-center justify-between text-sm text-gray-400">
          <div>Risk assessment for {symbol}</div>
          <div>Updated every 3 minutes</div>
        </div>
      </div>
    </div>
  );
};

export default LiquidationRiskAssessment;