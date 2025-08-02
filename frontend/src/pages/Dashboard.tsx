import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, BarChart3, Globe, Zap, Shield, Eye, Brain, Target, AlertTriangle, Menu, X, ChevronDown } from 'lucide-react';

// WebSocket service for real-time price updates
import { webSocketService, subscribeToTrades } from '../services/WebSocketService';

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

  // Real-time price state
  const [realTimePrice, setRealTimePrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [previousPrice, setPreviousPrice] = useState<number | null>(null);

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

    // Real-time price subscription
    const unsubscribe = subscribeToTrades(selectedAsset, (data) => {
      if (data.type === 'trade' && data.price) {
        const newPrice = parseFloat(data.price);
        if (previousPrice !== null) {
          setPriceChange(newPrice - previousPrice);
        }
        setPreviousPrice(realTimePrice);
        setRealTimePrice(newPrice);
      }
    });

    // Connection status monitoring
    const statusInterval = setInterval(() => {
      setConnectionStatus(webSocketService.getConnectionStatus());
    }, 1000);

    return () => {
      window.removeEventListener('resize', checkMobile);
      unsubscribe();
      clearInterval(statusInterval);
    };
  }, [selectedAsset, realTimePrice, previousPrice]);

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

          {/* Sidebar */}
          <div className={`fixed left-0 top-0 h-full w-80 bg-slate-900/95 backdrop-blur-md border-r border-slate-700/50 z-50 transform transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
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

      {/* Mobile-Responsive Header */}
      <div className="bg-slate-900/80 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-30">
        <div className="px-4 lg:px-8 py-4 lg:py-6">
          <div className="flex items-center justify-between">
            {/* Left: Mobile menu + Brand */}
            <div className="flex items-center space-x-4">
              {/* Mobile menu button */}
              {isMobile && (
                <button
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-2 text-slate-400 hover:text-white lg:hidden"
                >
                  <Menu className="h-6 w-6" />
                </button>
              )}

              {/* Brand */}
              <div className="flex items-center space-x-3">
                <Brain className="h-6 w-6 lg:h-8 lg:w-8 text-blue-400" />
                <div>
                  <h1 className="text-lg lg:text-2xl font-bold text-white flex items-center">
                    PulseIntel
                    <span className={`ml-2 lg:ml-3 text-xs lg:text-sm px-2 lg:px-3 py-1 rounded-full border ${connectionStatus === 'connected'
                      ? 'bg-green-500/20 text-green-400 border-green-500/30'
                      : connectionStatus === 'connecting'
                        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                      }`}>
                      {isMobile ? 'LIVE' : (connectionStatus === 'connected' ? 'LIVE • WebSocket' :
                        connectionStatus === 'connecting' ? 'CONNECTING...' : 'DISCONNECTED')}
                    </span>
                  </h1>
                  {!isMobile && (
                    <p className="text-slate-400 text-sm mt-1">
                      Institutional Grade Market Intelligence Platform • Rate Limit Protected
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Real-time Price + Controls */}
            <div className="flex items-center space-x-2 lg:space-x-4">
              {/* Real-time Price Display */}
              <div className={`flex items-center space-x-2 bg-slate-800/80 px-3 lg:px-4 py-2 rounded-lg transition-all duration-300 ${priceChange > 0 ? 'price-change-positive' : priceChange < 0 ? 'price-change-negative' : ''
                }`}>
                <DollarSign className="h-4 w-4 text-green-400" />
                <div className="flex flex-col lg:flex-row lg:items-center lg:space-x-2">
                  <span className="text-white font-bold text-sm lg:text-base font-mono">
                    {realTimePrice ? `$${realTimePrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Loading...'}
                  </span>
                  {priceChange !== 0 && (
                    <span className={`text-xs lg:text-sm flex items-center font-mono ${priceChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {priceChange > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                      {priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)}
                    </span>
                  )}
                </div>
                {/* Live indicator */}
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  {!isMobile && <span className="text-green-400 text-xs">LIVE</span>}
                </div>
              </div>

              {/* Asset Selector - Mobile Dropdown */}
              {isMobile ? (
                <div className="relative">
                  <select
                    value={selectedAsset}
                    onChange={(e) => setSelectedAsset(e.target.value)}
                    className="bg-slate-800/80 text-white px-3 py-2 rounded-lg border border-slate-600/50 focus:border-blue-500/50 text-sm appearance-none pr-8"
                  >
                    {assetUniverse.map(asset => (
                      <option key={asset} value={asset}>{asset.replace('USDT', '')}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              ) : (
                /* Desktop Controls */
                <>
                  {/* Asset Selector */}
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400 text-sm font-medium">Asset:</span>
                    <select
                      value={selectedAsset}
                      onChange={(e) => setSelectedAsset(e.target.value)}
                      className="bg-slate-800/80 text-white px-4 py-2 rounded-lg border border-slate-600/50 focus:border-blue-500/50 backdrop-blur-sm"
                    >
                      {assetUniverse.map(asset => (
                        <option key={asset} value={asset}>{asset.replace('USDT', '/USDT')}</option>
                      ))}
                    </select>
                  </div>

                  {/* Timeframe Selector */}
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-400 text-sm font-medium">Timeframe:</span>
                    <div className="flex bg-slate-800/80 rounded-lg p-1">
                      {timeframes.map(tf => (
                        <button
                          key={tf}
                          onClick={() => setTimeframe(tf)}
                          className={`px-3 py-1 rounded text-sm transition-all ${timeframe === tf
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                            }`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mobile Timeframe Selector */}
          {isMobile && (
            <div className="mt-4 flex bg-slate-800/80 rounded-lg p-1 overflow-x-auto">
              {timeframes.map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-3 py-1 rounded text-sm transition-all whitespace-nowrap ${timeframe === tf
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                    }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          )}
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

        {/* Primary Analytics Grid - Mobile Responsive */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 mb-6 lg:mb-8">
          {/* Left Column - Core Market Data */}
          <div className="lg:col-span-8 space-y-4 lg:space-y-6">
            {/* Institutional Market Overview */}
            <InstitutionalMarketOverview
              selectedAsset={selectedAsset}
              timeframe={timeframe}
            />

            {/* Global Liquidity Flow */}
            <GlobalLiquidityFlow
              selectedAsset={selectedAsset}
            />

            {/* Cross-Exchange Arbitrage */}
            <CrossExchangeArbitrage
              selectedAsset={selectedAsset}
            />
          </div>

          {/* Right Column - Intelligence & News */}
          <div className="lg:col-span-4 space-y-4 lg:space-y-6">
            {/* Smart Money Tracker */}
            <SmartMoneyTracker
              selectedAsset={selectedAsset}
            />

            {/* Professional News Tracker */}
            <ProfessionalNewsTracker />

            {/* Sentiment Index */}
            <SentimentIndex
              selectedAsset={selectedAsset}
            />
          </div>
        </div>

        {/* Secondary Analytics Grid - Mobile Responsive */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
          {/* Market Microstructure Analysis */}
          <MarketMicrostructure
            selectedAsset={selectedAsset}
          />

          {/* Order Flow Analytics */}
          <OrderFlowAnalytics
            selectedAsset={selectedAsset}
          />
        </div>

        {/* Advanced Analytics Row - Mobile Responsive */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-6 lg:mb-8">
          {/* Volatility Matrix */}
          <VolatilityMatrix
            selectedAsset={selectedAsset}
            timeframe={timeframe}
          />

          {/* Funding Rate Heatmap */}
          <FundingRateHeatmap
            selectedAsset={selectedAsset}
          />

          {/* Liquidation Cascade Analysis */}
          <LiquidationCascadeAnalysis
            selectedAsset={selectedAsset}
          />
        </div>

        {/* Exchange Intelligence Row - Mobile Responsive */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
          {/* Exchange Volume Rankings */}
          <ExchangeVolumeRankings
            selectedAsset={selectedAsset}
          />

          {/* Open Interest Tracker */}
          <OpenInterestTracker
            selectedAsset={selectedAsset}
          />
        </div>

        {/* Advanced Orderbook - Mobile Responsive */}
        <div className="mb-6 lg:mb-8">
          <AdvancedOrderbook symbol={selectedAsset} depth={isMobile ? 15 : 30} />
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
                <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-400' : 'bg-red-400'
                  }`}></div>
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