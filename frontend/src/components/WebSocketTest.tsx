import React, { useState, useEffect } from 'react';
import { webSocketService, subscribeToTrades, subscribeToDepth, subscribeToVWAP } from '../services/WebSocketService';

interface WebSocketTestProps {
  selectedAsset: string;
}

const WebSocketTest: React.FC<WebSocketTestProps> = ({ selectedAsset }) => {
  const [tickerData, setTickerData] = useState<any>(null);
  const [orderbookData, setOrderbookData] = useState<any>(null);
  const [vwapData, setVwapData] = useState<any>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    console.log(`🧪 WebSocketTest: Using centralized service for ${selectedAsset}`);
    
    // Update connection status periodically
    const statusInterval = setInterval(() => {
      setConnectionStatus(webSocketService.getConnectionStatus());
    }, 1000);

    // Subscribe to trades
    const unsubscribeTrades = subscribeToTrades(selectedAsset, (data) => {
      console.log('📈 Trade data received:', data);
      setTickerData(data);
      setMessageCount(prev => prev + 1);
    });

    // Subscribe to depth
    const unsubscribeDepth = subscribeToDepth(selectedAsset, (data) => {
      console.log('📊 Depth data received:', data);
      setOrderbookData(data);
      setMessageCount(prev => prev + 1);
    });

    // Subscribe to VWAP
    const unsubscribeVWAP = subscribeToVWAP(selectedAsset, (data) => {
      console.log('📈 VWAP data received:', data);
      setVwapData(data);
      setMessageCount(prev => prev + 1);
    });

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up WebSocket subscriptions');
      clearInterval(statusInterval);
      unsubscribeTrades();
      unsubscribeDepth();
      unsubscribeVWAP();
    };
  }, [selectedAsset]);

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <h3 className="text-white text-lg font-bold mb-4">🧪 WebSocket Test - {selectedAsset}</h3>
      
      {/* Connection Status */}
      <div className="mb-4">
        <span className={`px-3 py-1 rounded text-sm font-medium ${
          connectionStatus === 'connected' ? 'bg-green-600 text-white' :
          connectionStatus === 'connecting' ? 'bg-yellow-600 text-white' :
          'bg-red-600 text-white'
        }`}>
          {connectionStatus === 'connected' ? '🟢 Connected' :
           connectionStatus === 'connecting' ? '🟡 Connecting...' :
           '🔴 Disconnected'}
        </span>
        <span className="ml-4 text-white font-bold">
          Messages Received: {messageCount}
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Ticker Data */}
        <div className="bg-gray-700 p-3 rounded">
          <h4 className="text-green-400 font-semibold">Trade Data</h4>
          {tickerData ? (
            <div className="text-white text-sm">
              <p>Price: ${tickerData.price}</p>
              <p>Quantity: {tickerData.quantity}</p>
              <p>Exchange: {tickerData.exchange}</p>
              <p>Time: {new Date(tickerData.timestamp * 1000).toLocaleTimeString()}</p>
            </div>
          ) : (
            <p className="text-gray-400">Waiting for trade data...</p>
          )}
        </div>

        {/* Orderbook Data */}
        <div className="bg-gray-700 p-3 rounded">
          <h4 className="text-blue-400 font-semibold">Orderbook Data</h4>
          {orderbookData ? (
            <div className="text-white text-sm">
              <p>Best Bid: ${orderbookData.bids?.[0]?.[0] || 'N/A'}</p>
              <p>Best Ask: ${orderbookData.asks?.[0]?.[0] || 'N/A'}</p>
              <p>Exchange: {orderbookData.exchange}</p>
              <p>Time: {new Date(orderbookData.timestamp * 1000).toLocaleTimeString()}</p>
            </div>
          ) : (
            <p className="text-gray-400">Waiting for orderbook data...</p>
          )}
        </div>

        {/* VWAP Data */}
        <div className="bg-gray-700 p-3 rounded">
          <h4 className="text-purple-400 font-semibold">VWAP Data</h4>
          {vwapData ? (
            <div className="text-white text-sm">
              <p>VWAP: ${vwapData.vwap?.toFixed(2)}</p>
              <p>Symbol: {vwapData.symbol?.toUpperCase()}</p>
              <p>Time: {new Date(vwapData.timestamp * 1000).toLocaleTimeString()}</p>
            </div>
          ) : (
            <p className="text-gray-400">Waiting for VWAP data...</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default WebSocketTest;