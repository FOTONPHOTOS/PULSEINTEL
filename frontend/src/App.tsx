import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import { FundingRates } from './pages/FundingRates';
import { Liquidations } from './pages/Liquidations';
import { Exchanges } from './pages/Exchanges';
import OpenInterest from './pages/OpenInterest';
import OrderFlow from './pages/OrderFlow';
import WhaleTracking from './pages/WhaleTracking';
import Sentiment from './pages/Sentiment';
import Arbitrage from './pages/Arbitrage';
import { MarketScanner } from './pages/MarketScanner';
import { MarketAnalyzer } from './pages/MarketAnalyzer';
import { CorrelationMatrix } from './pages/CorrelationMatrix';
import { LiquidityHeatmaps } from './pages/LiquidityHeatmaps';
import { Signals } from './pages/Signals';
import CustomAlerts from './pages/CustomAlerts';
import Watchlists from './pages/Watchlists';
import DataExport from './pages/DataExport';
import ApiAccess from './pages/ApiAccess';
import Settings from './pages/Settings';
import Supercharts from './pages/Supercharts';
import AlphaTerminal from './pages/AlphaTerminal';
import CVD from './pages/CVD';
import VolumeProfile from './pages/VolumeProfile';
import AdvancedDelta from './pages/AdvancedDelta';
import VWAPSuite from './pages/VWAPSuite';
import MarketProfile from './pages/MarketProfile';

const App: React.FC = () => {
  useEffect(() => {
    // Set document title
    document.title = 'PulseIntel - Professional Crypto Analytics';
  }, []);

  return (
    <Router>
      <Layout>
        <div className="mb-6">
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 p-4 rounded-lg border border-blue-500/20 mb-6">
            <h1 className="text-2xl font-bold text-white mb-2">Welcome to PulseIntel</h1>
            <p className="text-gray-300">
              Institutional-grade crypto intelligence platform with real-time market analytics and professional trading insights.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded">Real-time Data</span>
              <span className="bg-green-500/20 text-green-300 text-xs px-2 py-1 rounded">Multi-exchange</span>
              <span className="bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded">Advanced Analytics</span>
              <span className="bg-amber-500/20 text-amber-300 text-xs px-2 py-1 rounded">Cost Efficient</span>
            </div>
          </div>
        </div>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/funding-rates" element={<FundingRates />} />
          <Route path="/liquidations" element={<Liquidations />} />
          <Route path="/exchanges" element={<Exchanges />} />
          <Route path="/open-interest" element={<OpenInterest />} />
          <Route path="/order-flow" element={<OrderFlow />} />
          <Route path="/whale-tracking" element={<WhaleTracking />} />
          <Route path="/sentiment" element={<Sentiment />} />
          <Route path="/arbitrage" element={<Arbitrage />} />
          <Route path="/market-scanner" element={<MarketScanner />} />
          <Route path="/market-analyzer" element={<MarketAnalyzer />} />
          <Route path="/correlation-matrix" element={<CorrelationMatrix />} />
          <Route path="/liquidity-heatmaps" element={<LiquidityHeatmaps />} />
          <Route path="/signals" element={<Signals />} />
          <Route path="/custom-alerts" element={<CustomAlerts />} />
          <Route path="/watchlists" element={<Watchlists />} />
          <Route path="/supercharts" element={<Supercharts />} />
          <Route path="/alpha-terminal" element={<AlphaTerminal />} />
          <Route path="/cvd" element={<CVD />} />
          <Route path="/volume-profile" element={<VolumeProfile />} />
          <Route path="/advanced-delta" element={<AdvancedDelta />} />
          <Route path="/vwap-suite" element={<VWAPSuite />} />
          <Route path="/market-profile" element={<MarketProfile />} />
          <Route path="/data-export" element={<DataExport />} />
          <Route path="/api-access" element={<ApiAccess />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
