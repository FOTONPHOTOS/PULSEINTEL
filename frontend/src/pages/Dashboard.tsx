import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, BarChart3, Globe, Zap, Shield, Eye, Brain, Target, AlertTriangle, Menu, X, ChevronDown } from 'lucide-react';

// WebSocket service for real-time price updates
import { subscribeToTicker, wsManager } from '../api';

// Mobile styles
import '../styles/mobile.css';

// Real-time data components
import InstitutionalMarketOverview from '../components/InstitutionalMarketOverview';
import RealTimeMetricsGrid from '../components/RealTimeMetricsGrid';
import GlobalLiquidityFlow from '../components/GlobalLiquidityFlow';
import SmartMoneyTracker from '../components/SmartMoneyTracker';
import CrossExchangeArbitrage from '../components/CrossExchangeArbitrage';
import AdvancedOrderbook from '../components/AdvancedOrderbook';
import OrderbookHeatmap from '../components/OrderbookHeatmap';


// Advanced analytics
import MarketMicrostructure from '../components/MarketMicrostructure';
import VolatilityMatrix from '../components/VolatilityMatrix';
import FundingRateHeatmap from '../components/FundingRateHeatmap';
import OrderFlowAnalytics from '../components/OrderFlowAnalytics';
import LiquidationCascadeAnalysis from '../components/LiquidationCascadeAnalysis';

// News and sentiment
import ProfessionalNewsTracker from '../components/ProfessionalNewsTracker';
import SentimentIndex from '../components/SentimentIndex';

// Exchange data
import ExchangeVolumeRankings from '../components/ExchangeVolumeRankings';
import OpenInterestTracker from '../components/OpenInterestTracker';

const Dashboard: React.FC = () => {
  const [selectedAsset, setSelectedAsset] = useState('BTCUSDT');
  const [timeframe, setTimeframe] = useState('1H');
  const [marketRegime, setMarketRegime] = useState('trending');

  // Mobile responsiveness states
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isHeaderDetailsVisible, setIsHeaderDetailsVisible] = useState(false);

  // Real-time price state
  const [realTimePrice, setRealTimePrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [priceChangePercent, setPriceChangePercent] = useState<number>(0);

  // Premium asset universe
  const assetUniverse = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT'
  ];

  const timeframes = ['5M', '15M', '1H', '4H', '1D', '1W'];

  // Real-time connection status indicator
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connected');
  const [globalLoading, setGlobalLoading] = useState(false);

  // Mobile detection and real-time price subscription
  useEffect(() => {
    // Mobile detection
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    // Real-time price subscription using the project's intended method
    const unsubscribe = subscribeToTicker(selectedAsset, (data) => {
      if (data.type === 'trade' && data.price) {
        const newPrice = parseFloat(data.price);
        setRealTimePrice(prevPrice => {
          if (prevPrice !== null) {
            setPriceChange(newPrice - prevPrice);
            setPriceChangePercent(((newPrice - prevPrice) / prevPrice) * 100);
          }
          return newPrice;
        });
      }
    });

    // Connection status monitoring
    const statusInterval = setInterval(() => {
      const isConnected = wsManager.isConnected();
      setConnectionStatus(isConnected ? 'connected' : 'disconnected');
    }, 1000);

    return () => {
      window.removeEventListener('resize', checkMobile);
      unsubscribe();
      clearInterval(statusInterval);
    };
  }, [selectedAsset]);

  // Navigation items for mobile menu
  const navigationItems = [
    { id: 'overview', label: 'Overview', icon: BarChart3, active: true },
    { id: 'superchart', label: 'SuperChart', icon: TrendingUp, badge: 'NEW' },
    { id: 'alpha', label: 'Alpha Terminal', icon: Brain, badge: 'NEW' },
    { id: 'funding', label: 'Funding Rates', icon: DollarSign },
    { id: 'liquidations', label: 'Liquidations', icon: AlertTriangle },
    { id: 'exchanges', label: 'Exchanges', icon: Globe },
    { id: 'openinterest', label: 'Open Interest', icon: Activity },
    { id: 'orderflow', label: 'Order Flow', icon: Target },
    { id: 'sentiment', label: 'Sentiment', icon: Eye },
    { id: 'arbitrage', label: 'Arbitrage', icon: Zap },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Mobile Navigation Sidebar */}
      {isMobile && (
        <>
          {/* Overlay */}
          {isMobileMenuOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          {/* Sidebar - FIXED WIDTH FOR MOBILE */}
          <div className={`fixed left-0 top-0 h-full w-72 sm:w-80 bg-slate-900/95 backdrop-blur-md border-r border-slate-700/50 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
            }`}>
            <div className="p-6">
              {/* Close button */}
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>

              {/* Brand */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-white flex items-center">
                  <Brain className="h-6 w-6 text-blue-400 mr-2" />
                  PulseIntel
                  <span className="ml-2 text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">BETA</span>
                </h2>
                <p className="text-slate-400 text-sm mt-1">Real-time Market Intelligence</p>
              </div>

              {/* Navigation */}
              <nav className="space-y-2">
                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-4">Dashboard</div>
                {navigationItems.slice(0, 1).map(item => (
                  <a key={item.id} href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </a>
                ))}

                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-4 mt-6">Trading Charts</div>
                {navigationItems.slice(1, 3).map(item => (
                  <a key={item.id} href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors">
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                    {item.badge && <span className="ml-auto text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">{item.badge}</span>}
                  </a>
                ))}

                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-4 mt-6">Market Data</div>
                {navigationItems.slice(3, 8).map(item => (
                  <a key={item.id} href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors">
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </a>
                ))}

                <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-4 mt-6">Analysis</div>
                {navigationItems.slice(8).map(item => (
                  <a key={item.id} href="#" className="flex items-center space-x-3 px-3 py-2 rounded-lg text-slate-300 hover:bg-slate-800/50 hover:text-white transition-colors">
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </>
      )}

      {/* NEW Mobile-First Header */}
      <div className="bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-30">
        <div className="px-4 py-3">
          {/* --- Top Row: Always Visible --- */}
          <div className="flex items-center justify-between">
            {/* Left: Mobile menu + Brand */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 text-slate-400 hover:text-white lg:hidden"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="flex items-center space-x-2">
                <Brain className="h-7 w-7 text-blue-400" />
                <h1 className="text-xl font-bold text-white">PulseIntel</h1>
              </div>
            </div>

            {/* Right: Price + Expand Button */}
            <div className="flex items-center space-x-3">
              <div className={`flex items-center space-x-2 transition-all duration-300 ${priceChange > 0 ? 'text-green-400' : priceChange < 0 ? 'text-red-400' : 'text-slate-300'}`}>
                <span className="font-mono text-lg">
                  {realTimePrice ? `${realTimePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '...'}
                </span>
                {priceChange !== 0 && (
                  <span className={`text-xs flex items-center font-mono`}>
                    {priceChange > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  </span>
                )}
              </div>
              <button 
                onClick={() => setIsHeaderDetailsVisible(!isHeaderDetailsVisible)}
                className="p-2 text-slate-400 hover:text-white lg:hidden"
              >
                {isHeaderDetailsVisible ? <X className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* --- Collapsible Details Section --- */}
          <div className={`lg:hidden transition-all duration-300 ease-in-out overflow-hidden ${isHeaderDetailsVisible ? 'max-h-96 pt-4' : 'max-h-0'}`}>
            <div className="border-t border-slate-700/50 pt-4 space-y-4">
              {/* Asset Selector */}
              <div className="flex items-center justify-between">
                <label htmlFor="mobile-asset-select" className="text-slate-400 text-sm font-medium">Asset</label>
                <select
                  id="mobile-asset-select"
                  value={selectedAsset}
                  onChange={(e) => setSelectedAsset(e.target.value)}
                  className="bg-slate-800/80 text-white px-3 py-2 rounded-lg border border-slate-600/50 focus:border-blue-500/50 text-sm appearance-none pr-8"
                >
                  {assetUniverse.map(asset => (
                    <option key={asset} value={asset}>{asset.replace('USDT', '')}</option>
                  ))}
                </select>
              </div>
              {/* Timeframe Selector */}
              <div>
                <label className="block text-slate-400 text-sm font-medium mb-2">Timeframe</label>
                <div className="flex bg-slate-800/80 rounded-lg p-1 overflow-x-auto">
                  {timeframes.map(tf => (
                    <button
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={`px-3 py-1 rounded text-sm transition-all whitespace-nowrap flex-shrink-0 ${timeframe === tf
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                        }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="px-4 lg:px-8 py-4 lg:py-8">
        {/* Loading Indicator for Global Data */}
        {globalLoading && (
          <div className="mb-6 flex items-center justify-center bg-slate-800/50 rounded-lg p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500 mr-3"></div>
            <span className="text-slate-300">Connecting to real-time WebSocket feeds...</span>
          </div>
        )}

        {/* Top Metrics Row - Mobile Responsive */}
        <div className="mb-6 lg:mb-8">
          <RealTimeMetricsGrid
            selectedAsset={selectedAsset}
          />
        </div>

        {/* Primary Analytics Grid - Fully Responsive */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 lg:gap-6 mb-6 lg:mb-8">
          {/* Left Column - Core Market Data */}
          <div className="md:col-span-2 lg:col-span-8 space-y-4 lg:space-y-6">
            <InstitutionalMarketOverview selectedAsset={selectedAsset} timeframe={timeframe} />
            <GlobalLiquidityFlow selectedAsset={selectedAsset} />
            <CrossExchangeArbitrage selectedAsset={selectedAsset} />
          </div>

          {/* Right Column - Intelligence & News */}
          <div className="md:col-span-2 lg:col-span-4 space-y-4 lg:space-y-6">
            <SmartMoneyTracker selectedAsset={selectedAsset} />
            <ProfessionalNewsTracker />
            <SentimentIndex selectedAsset={selectedAsset} />
          </div>
        </div>

        {/* Secondary Analytics Grid - Fully Responsive */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
          <MarketMicrostructure selectedAsset={selectedAsset} />
          <OrderFlowAnalytics selectedAsset={selectedAsset} />
        </div>

        {/* Advanced Analytics Row - Fully Responsive */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
          <VolatilityMatrix selectedAsset={selectedAsset} timeframe={timeframe} />
          <FundingRateHeatmap selectedAsset={selectedAsset} />
          <LiquidationCascadeAnalysis selectedAsset={selectedAsset} />
        </div>

        {/* Exchange Intelligence Row - Fully Responsive */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
          <ExchangeVolumeRankings selectedAsset={selectedAsset} />
          <OpenInterestTracker selectedAsset={selectedAsset} />
        </div>

        {/* Advanced Orderbook - Fully Responsive */}
        <div className="mb-6 lg:mb-8">
          <AdvancedOrderbook symbol={selectedAsset} depth={window.innerWidth < 768 ? 15 : 30} />
        </div>

        {/* Orderbook Heatmap - Mobile Responsive */}
        <div className="mb-6 lg:mb-8">
          <OrderbookHeatmap symbol={selectedAsset} />
        </div>

        {/* Real-time WebSocket Status Footer - Mobile Responsive */}
        <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/50">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-2 lg:space-y-0 text-sm">
            <div className="flex items-center space-x-4">
              <span className="text-slate-400">WebSocket Status:</span>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-slate-300 capitalize">{connectionStatus}</span>
              </div>
            </div>
            <div className="flex flex-col lg:flex-row lg:items-center lg:space-x-4 space-y-1 lg:space-y-0 text-slate-400 text-xs lg:text-sm">
              <span>Real-time Feeds: 3 exchanges</span>
              {!isMobile && <span>No Rate Limits • Unlimited Data</span>}
              <span>Last Update: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;