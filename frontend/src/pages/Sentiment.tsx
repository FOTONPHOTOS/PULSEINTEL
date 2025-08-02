import React, { useState } from 'react';
import { apiConfig } from '../apiConfig';
import MarketSentimentWidget from '../components/MarketSentimentWidget';
import SentimentIndex from '../components/SentimentIndex';
import { Brain, TrendingUp, TrendingDown, Activity, Heart, BarChart3 } from 'lucide-react';

export default function Sentiment() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');

  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
            <Brain className="h-8 w-8 text-purple-400 mr-3" />
            Market Sentiment Analysis
          </h1>
          <p className="text-gray-400">Comprehensive sentiment analysis from multiple data sources</p>
        </div>
        
        {/* Symbol Selector */}
        <div className="flex items-center space-x-4">
          <label className="text-sm text-gray-400">Symbol:</label>
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-600"
          >
            {symbols.map(symbol => (
              <option key={symbol} value={symbol}>{symbol}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Sentiment Components */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Market Sentiment Widget */}
        <MarketSentimentWidget symbol={selectedSymbol} />
        
        {/* Sentiment Index */}
        <SentimentIndex selectedAsset={selectedSymbol} />
      </div>

      {/* Additional Sentiment Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Fear & Greed Gauge */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Heart className="h-5 w-5 text-pink-400 mr-2" />
              Fear & Greed
            </h3>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-400 mb-2">50</div>
            <div className="text-sm text-gray-400">Neutral</div>
            <div className="mt-4 bg-gray-700 rounded-full h-2">
              <div className="bg-yellow-400 h-2 rounded-full" style={{ width: '50%' }}></div>
            </div>
          </div>
        </div>

        {/* Social Sentiment */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <Activity className="h-5 w-5 text-blue-400 mr-2" />
              Social Sentiment
            </h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Twitter</span>
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span className="text-green-400 font-semibold">Bullish</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Reddit</span>
              <div className="flex items-center space-x-2">
                <TrendingDown className="h-4 w-4 text-red-400" />
                <span className="text-red-400 font-semibold">Bearish</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">News</span>
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-yellow-400" />
                <span className="text-yellow-400 font-semibold">Neutral</span>
              </div>
            </div>
          </div>
        </div>

        {/* Technical Sentiment */}
        <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center">
              <BarChart3 className="h-5 w-5 text-green-400 mr-2" />
              Technical Sentiment
            </h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">RSI Signal</span>
              <span className="text-green-400 font-semibold">Buy</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">MACD Signal</span>
              <span className="text-yellow-400 font-semibold">Hold</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Moving Averages</span>
              <span className="text-green-400 font-semibold">Bullish</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sentiment History Chart Placeholder */}
      <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">Sentiment History</h3>
        <div className="h-64 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-20" />
            <p>Sentiment history chart will be displayed here</p>
            <p className="text-sm">Connect to historical sentiment data source</p>
          </div>
        </div>
      </div>
    </div>
  );
}