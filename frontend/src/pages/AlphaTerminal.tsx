import React, { useState, useEffect, useRef } from 'react';
import { 
  createChart, 
  IChartApi, 
  ISeriesApi, 
  LineStyle, 
  ColorType,
  CandlestickData,
  HistogramData,
  LineData,
  Time,
  CandlestickSeries,
  HistogramSeries,
  LineSeries
} from 'lightweight-charts';
import { 
  TrendingUp, 
  TrendingDown, 
  Volume2, 
  Activity,
  BarChart3,
  Target,
  Zap,
  DollarSign,
  PieChart,
  AlertTriangle,
  Eye,
  Brain,
  Crosshair,
  RefreshCw,
  Maximize2
} from 'lucide-react';

// Technical Indicators Engine for Terminal
class TerminalIndicators {
  static calculateRSI(data: any[], period: number = 14) {
    const rsiData: LineData[] = [];
    const gains: number[] = [];
    const losses: number[] = [];
    
    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    for (let i = period - 1; i < gains.length; i++) {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((sum, gain) => sum + gain, 0) / period;
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((sum, loss) => sum + loss, 0) / period;
      
      const rs = avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      
      rsiData.push({
        time: data[i + 1].time,
        value: rsi
      });
    }
    
    return rsiData;
  }

  static calculateCVD(data: any[]) {
    let cvd = 0;
    const cvdData: LineData[] = [];
    
    data.forEach((candle, index) => {
      if (index === 0) return;
      
      const volumeDelta = candle.close > candle.open ? (candle.volume || 0) : -(candle.volume || 0);
      cvd += volumeDelta || 0;
      
      cvdData.push({
        time: candle.time,
        value: cvd
      });
    });
    
    return cvdData;
  }
}

export default function AlphaTerminal() {
  const mainChartRef = useRef<HTMLDivElement>(null);
  const cvdChartRef = useRef<HTMLDivElement>(null);
  const volumeChartRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<HTMLDivElement>(null);
  
  const mainChart = useRef<IChartApi | null>(null);
  const cvdChart = useRef<IChartApi | null>(null);
  const volumeChart = useRef<IChartApi | null>(null);
  const rsiChart = useRef<IChartApi | null>(null);
  
  const candlestickSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const cvdSeries = useRef<ISeriesApi<'Line'> | null>(null);
  const volumeSeries = useRef<ISeriesApi<'Histogram'> | null>(null);
  const rsiSeries = useRef<ISeriesApi<'Line'> | null>(null);

  const [currentSymbol, setCurrentSymbol] = useState('BTCUSDT');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [wsConnections, setWsConnections] = useState<{ [key: string]: WebSocket }>({});
  const [realTimeData, setRealTimeData] = useState<(CandlestickData & { volume: number })[]>([]);
  
  // 🚀 SYNCHRONIZED REAL-TIME DATA STATE (All components use the same data)
  const [terminalData, setTerminalData] = useState({
    symbol: currentSymbol,
    price: 0,
    change24h: 0,
    volume24h: 0,
    marketCap: 0,
    fear_greed: 0,
    funding_rate: 0,
    open_interest: 0,
    liquidations: { longs: 0, shorts: 0 },
    orderbook: {
      bids: [] as Array<{price: number; amount: number}>,
      asks: [] as Array<{price: number; amount: number}>
    },
    recent_trades: [] as Array<{
      time: string;
      price: number;
      amount: number;
      side: 'buy' | 'sell';
    }>
  });

  const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'DOTUSDT', 'LINKUSDT'];

  // Initialize charts
  useEffect(() => {
    if (!mainChartRef.current || !cvdChartRef.current || !volumeChartRef.current || !rsiChartRef.current) return;

    const chartOptions = {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0a' },
        textColor: '#e0e0e0',
        fontFamily: 'Inter, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      rightPriceScale: {
        borderColor: '#333333',
        textColor: '#e0e0e0',
      },
      timeScale: {
        borderColor: '#333333',
        visible: false,
      },
    };

    // Main chart
    mainChart.current = createChart(mainChartRef.current, {
      ...chartOptions,
      width: mainChartRef.current.clientWidth,
      height: 300,
      timeScale: { ...chartOptions.timeScale, visible: true },
    });

    candlestickSeries.current = mainChart.current.addSeries(CandlestickSeries, {
      upColor: '#00ff88',
      downColor: '#ff4444',
      borderDownColor: '#ff4444',
      borderUpColor: '#00ff88',
      wickDownColor: '#ff4444',
      wickUpColor: '#00ff88',
    });

    // CVD chart
    cvdChart.current = createChart(cvdChartRef.current, {
      ...chartOptions,
      width: cvdChartRef.current.clientWidth,
      height: 120,
    });

    cvdSeries.current = cvdChart.current.addSeries(LineSeries, {
      color: '#ff6b6b',
      lineWidth: 2,
    });

    // Volume chart
    volumeChart.current = createChart(volumeChartRef.current, {
      ...chartOptions,
      width: volumeChartRef.current.clientWidth,
      height: 100,
    });

    volumeSeries.current = volumeChart.current.addSeries(HistogramSeries, {
      color: '#26a69a88',
    });

    // RSI chart
    rsiChart.current = createChart(rsiChartRef.current, {
      ...chartOptions,
      width: rsiChartRef.current.clientWidth,
      height: 100,
    });

    rsiSeries.current = rsiChart.current.addSeries(LineSeries, {
      color: '#ffd93d',
      lineWidth: 2,
    });

    loadTerminalData(currentSymbol);

    return () => {
      [mainChart, cvdChart, volumeChart, rsiChart].forEach(chart => {
        if (chart.current) chart.current.remove();
      });
    };
  }, []);

  // 🚀 SYNCHRONIZED DATA LOADING - All components get the same WebSocket data
  const loadTerminalData = async (symbol: string) => {
    try {
      setIsLoading(true);
      
      // Close existing WebSocket connections
      Object.values(wsConnections).forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
      
      console.log(`🔄 Loading synchronized terminal data for ${symbol}...`);
      
      // 1. Load historical data
      const response = await fetch(`http://localhost:8888/api/historical-price/${symbol}?timeframe=15m&limit=500`);
      const data = await response.json();

      if (data.real_data && data.data && data.data.length > 0) {
        const chartData: (CandlestickData & { volume: number })[] = data.data.map((item: any) => ({
          time: Math.floor(item.timestamp / 1000) as Time,
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
          volume: parseFloat(item.volume || '0'),
        }));

        // Store synchronized data for all components
        setRealTimeData(chartData);

        // Update all charts with SAME data
        updateAllChartsWithSynchronizedData(chartData);

        console.log(`✅ Loaded ${chartData.length} synchronized candles for ${symbol}`);
        
        // 2. 🔥 ESTABLISH SYNCHRONIZED WEBSOCKET CONNECTIONS
        setupSynchronizedWebSocketConnections(symbol);
      }

      setIsConnected(true);
    } catch (error) {
      console.error('Error loading synchronized terminal data:', error);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  // 🚀 UPDATE ALL CHARTS WITH SYNCHRONIZED DATA
  const updateAllChartsWithSynchronizedData = (chartData: (CandlestickData & { volume: number })[]) => {
    // Main candlestick chart
    if (candlestickSeries.current) {
      candlestickSeries.current.setData(chartData);
    }

    // CVD calculation and chart
    const cvdData = TerminalIndicators.calculateCVD(chartData);
    if (cvdSeries.current) {
      cvdSeries.current.setData(cvdData);
    }

    // Volume chart
    const volumeData: HistogramData[] = chartData.map(item => ({
      time: item.time,
      value: item.volume,
      color: item.close > item.open ? '#00ff8844' : '#ff444444',
    }));
    if (volumeSeries.current) {
      volumeSeries.current.setData(volumeData);
    }

    // RSI calculation and chart
    const rsiData = TerminalIndicators.calculateRSI(chartData);
    if (rsiSeries.current) {
      rsiSeries.current.setData(rsiData);
    }

    // Fit all charts simultaneously
    [mainChart, cvdChart, volumeChart, rsiChart].forEach(chart => {
      if (chart.current) chart.current.timeScale().fitContent();
    });
  };

  // 🚀 SYNCHRONIZED WEBSOCKET CONNECTIONS - All components receive same data
  const setupSynchronizedWebSocketConnections = (symbol: string) => {
    const newConnections: { [key: string]: WebSocket } = {};

    console.log(`🚀 Setting up SYNCHRONIZED WebSocket connections for ${symbol}...`);

    // 1. Real-time ticker WebSocket (for price, volume, etc.)
    const tickerWs = new WebSocket(`ws://localhost:8888/ws/ticker/${symbol}`);
    
    tickerWs.onopen = () => {
      console.log(`✅ SYNCHRONIZED WebSocket connected: Ticker for ${symbol}`);
      setIsConnected(true);
    };
    
    tickerWs.onmessage = (event) => {
      try {
        const tickerUpdate = JSON.parse(event.data);
        console.log(`📊 SYNCHRONIZED ticker update:`, tickerUpdate);
        
        if (tickerUpdate.symbol === symbol) {
          // Update terminal data synchronously
          setTerminalData(prev => ({
            ...prev,
            symbol: tickerUpdate.symbol,
            price: parseFloat(tickerUpdate.price || prev.price),
            change24h: parseFloat(tickerUpdate.change_24h || '0'),
            volume24h: parseFloat(tickerUpdate.volume_24h || '0'),
            marketCap: parseFloat(tickerUpdate.market_cap || '0'),
          }));
        }
      } catch (error) {
        console.error('Error processing SYNCHRONIZED ticker data:', error);
      }
    };
    
    tickerWs.onerror = (error) => {
      console.error('SYNCHRONIZED ticker WebSocket error:', error);
      setIsConnected(false);
    };
    
    tickerWs.onclose = () => {
      console.log('🔄 SYNCHRONIZED ticker WebSocket disconnected. Reconnecting...');
      setIsConnected(false);
      setTimeout(() => setupSynchronizedWebSocketConnections(symbol), 3000);
    };

    newConnections['ticker'] = tickerWs;

    // 2. Real-time price updates WebSocket (for charts)
    const realtimeWs = new WebSocket(`ws://localhost:8888/ws/realtime`);
    
    realtimeWs.onopen = () => {
      console.log(`✅ SYNCHRONIZED WebSocket connected: Real-time price updates`);
      realtimeWs.send(JSON.stringify({
        action: 'subscribe',
        symbol: symbol,
        timeframe: '15m'
      }));
    };
    
    realtimeWs.onmessage = (event) => {
      try {
        const priceUpdate = JSON.parse(event.data);
        console.log(`📈 SYNCHRONIZED price update:`, priceUpdate);
        
        if (priceUpdate.symbol === symbol && priceUpdate.data) {
          const newCandle: CandlestickData & { volume: number } = {
            time: Math.floor(priceUpdate.data.timestamp / 1000) as Time,
            open: parseFloat(priceUpdate.data.open),
            high: parseFloat(priceUpdate.data.high),
            low: parseFloat(priceUpdate.data.low),
            close: parseFloat(priceUpdate.data.close),
            volume: parseFloat(priceUpdate.data.volume || '0'),
          };

          // Update ALL components with the SAME data simultaneously
          updateAllChartsWithNewCandle(newCandle);
          
          // Update real-time data array
          setRealTimeData(prev => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            
            if (updated[lastIndex] && updated[lastIndex].time === newCandle.time) {
              updated[lastIndex] = newCandle;
            } else {
              updated.push(newCandle);
              if (updated.length > 500) updated.shift();
            }
            
            return updated;
          });
        }
      } catch (error) {
        console.error('Error processing SYNCHRONIZED price data:', error);
      }
    };
    
    realtimeWs.onerror = (error) => {
      console.error('SYNCHRONIZED real-time WebSocket error:', error);
    };
    
    realtimeWs.onclose = () => {
      console.log('🔄 SYNCHRONIZED real-time WebSocket disconnected. Reconnecting...');
      setTimeout(() => setupSynchronizedWebSocketConnections(symbol), 3000);
    };

    newConnections['realtime'] = realtimeWs;

    // 3. Order Book WebSocket (for order book data)
    const orderbookWs = new WebSocket(`ws://localhost:8888/ws/orderbook/${symbol}`);
    
    orderbookWs.onopen = () => {
      console.log(`✅ SYNCHRONIZED WebSocket connected: Order book for ${symbol}`);
    };
    
    orderbookWs.onmessage = (event) => {
      try {
        const orderbookUpdate = JSON.parse(event.data);
        console.log(`📊 SYNCHRONIZED orderbook update:`, orderbookUpdate);
        
        if (orderbookUpdate.symbol === symbol) {
          setTerminalData(prev => ({
            ...prev,
            orderbook: {
              bids: orderbookUpdate.bids || [],
              asks: orderbookUpdate.asks || []
            }
          }));
        }
      } catch (error) {
        console.error('Error processing SYNCHRONIZED orderbook data:', error);
      }
    };

    newConnections['orderbook'] = orderbookWs;

    // 4. Liquidations WebSocket (for liquidation data)
    const liquidationsWs = new WebSocket(`ws://localhost:8888/ws/liquidations/${symbol}`);
    
    liquidationsWs.onopen = () => {
      console.log(`✅ SYNCHRONIZED WebSocket connected: Liquidations for ${symbol}`);
    };
    
    liquidationsWs.onmessage = (event) => {
      try {
        const liquidationUpdate = JSON.parse(event.data);
        console.log(`💥 SYNCHRONIZED liquidation update:`, liquidationUpdate);
        
        if (liquidationUpdate.symbol === symbol) {
          setTerminalData(prev => ({
            ...prev,
            liquidations: {
              longs: parseFloat(liquidationUpdate.longs_24h || '0'),
              shorts: parseFloat(liquidationUpdate.shorts_24h || '0')
            }
          }));
        }
      } catch (error) {
        console.error('Error processing SYNCHRONIZED liquidation data:', error);
      }
    };

    newConnections['liquidations'] = liquidationsWs;

    setWsConnections(newConnections);
  };

  // 🚀 UPDATE ALL CHARTS WITH NEW CANDLE (SYNCHRONIZED)
  const updateAllChartsWithNewCandle = (newCandle: CandlestickData & { volume: number }) => {
    // Update main candlestick chart
    if (candlestickSeries.current) {
      candlestickSeries.current.update(newCandle);
    }

    // Update volume chart
    const newVolume: HistogramData = {
      time: newCandle.time,
      value: newCandle.volume,
      color: newCandle.close > newCandle.open ? '#00ff8844' : '#ff444444',
    };
    if (volumeSeries.current) {
      volumeSeries.current.update(newVolume);
    }

    // Recalculate and update CVD with new data
    const updatedData = [...realTimeData];
    const lastIndex = updatedData.length - 1;
    if (updatedData[lastIndex] && updatedData[lastIndex].time === newCandle.time) {
      updatedData[lastIndex] = newCandle;
    } else {
      updatedData.push(newCandle);
    }

    const cvdData = TerminalIndicators.calculateCVD(updatedData);
    if (cvdSeries.current && cvdData.length > 0) {
      cvdSeries.current.update(cvdData[cvdData.length - 1]);
    }

    // Recalculate and update RSI with new data
    const rsiData = TerminalIndicators.calculateRSI(updatedData);
    if (rsiSeries.current && rsiData.length > 0) {
      rsiSeries.current.update(rsiData[rsiData.length - 1]);
    }
  };

  const changeSymbol = async (symbol: string) => {
    console.log(`🔄 Changing to symbol: ${symbol} with SYNCHRONIZED data`);
    setCurrentSymbol(symbol);
    await loadTerminalData(symbol);
  };

  // WebSocket cleanup on component unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up SYNCHRONIZED WebSocket connections...');
      Object.values(wsConnections).forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
    };
  }, [wsConnections]);

  if (isLoading) {
    return (
      <div className="h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="text-xl">Loading Alpha Terminal...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 text-white overflow-hidden flex flex-col">
      {/* Terminal Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Eye className="h-6 w-6 text-blue-500" />
            <h1 className="text-xl font-bold">🔥 ALPHA TERMINAL</h1>
            <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-3 py-1 rounded-full">
              Professional Trading Command Center
            </span>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="text-2xl font-bold">{currentSymbol}</div>
            <div className="text-right">
              <div className="text-xl font-bold text-green-400">
                ${terminalData.price > 0 
                  ? terminalData.price.toLocaleString('en-US', { minimumFractionDigits: 2 }) 
                  : 'Loading...'}
              </div>
              <div className={`text-sm flex items-center ${terminalData.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {terminalData.change24h >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                {terminalData.change24h > 0 ? '+' : ''}{terminalData.change24h.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-400">
              {isConnected ? '🔥 SYNCHRONIZED LIVE' : '❌ Disconnected'}
            </span>
            <span className="text-xs text-gray-500">
              {Object.keys(wsConnections).length}/4 feeds
            </span>
          </div>
          <button
            onClick={() => loadTerminalData(currentSymbol)}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {/* Main Terminal Grid */}
        <div className="h-full grid grid-cols-12 gap-1 p-1">
          {/* Left Panel - Charts */}
          <div className="col-span-8 space-y-1">
            {/* Main Price Chart */}
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-300">📈 PRICE ACTION</h3>
                <div className="flex space-x-1">
                  {SYMBOLS.map(symbol => (
                    <button
                      key={symbol}
                      onClick={() => changeSymbol(symbol)}
                      className={`px-2 py-1 rounded text-xs ${
                        currentSymbol === symbol ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {symbol.replace('USDT', '')}
                    </button>
                  ))}
                </div>
              </div>
              <div ref={mainChartRef} className="w-full" />
            </div>

            {/* Secondary Charts Row */}
            <div className="grid grid-cols-3 gap-1">
              <div className="bg-gray-800 rounded-lg p-2">
                <h4 className="text-xs font-semibold text-red-400 mb-1">📊 CVD</h4>
                <div ref={cvdChartRef} className="w-full" />
              </div>
              <div className="bg-gray-800 rounded-lg p-2">
                <h4 className="text-xs font-semibold text-blue-400 mb-1">📈 VOLUME</h4>
                <div ref={volumeChartRef} className="w-full" />
              </div>
              <div className="bg-gray-800 rounded-lg p-2">
                <h4 className="text-xs font-semibold text-yellow-400 mb-1">⚡ RSI</h4>
                <div ref={rsiChartRef} className="w-full" />
              </div>
            </div>
          </div>

          {/* Right Panel - Data Feeds */}
          <div className="col-span-4 space-y-1">
            {/* Market Overview */}
            <div className="bg-gray-800 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">🧠 MARKET INTELLIGENCE</h3>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-400">Market Cap</span>
                  <div className="text-white font-medium">
                    {terminalData.marketCap > 0 
                      ? `$${(terminalData.marketCap / 1e12).toFixed(2)}T` 
                      : 'Loading...'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">24h Volume</span>
                  <div className="text-white font-medium">
                    {terminalData.volume24h > 0 
                      ? `$${(terminalData.volume24h / 1e9).toFixed(1)}B` 
                      : 'Loading...'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Fear & Greed</span>
                  <div className="text-green-400 font-medium">
                    {terminalData.fear_greed > 0 ? terminalData.fear_greed : 'Loading...'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400">Funding Rate</span>
                  <div className={`font-medium ${terminalData.funding_rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {terminalData.funding_rate !== 0 
                      ? `${(terminalData.funding_rate * 100).toFixed(3)}%` 
                      : 'Loading...'}
                  </div>
                </div>
              </div>
            </div>

            {/* Order Book */}
            <div className="bg-gray-800 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center">
                <BarChart3 className="h-4 w-4 mr-1" />
                📊 ORDER BOOK
              </h3>
              <div className="space-y-1">
                {terminalData.orderbook.asks.length > 0 ? (
                  terminalData.orderbook.asks.slice(0, 5).reverse().map((ask, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-red-400">{ask.price.toFixed(1)}</span>
                      <span className="text-gray-300">{ask.amount.toFixed(3)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-500 text-center py-2">Loading order book...</div>
                )}
                <div className="border-t border-gray-600 my-1"></div>
                {terminalData.orderbook.bids.length > 0 ? (
                  terminalData.orderbook.bids.slice(0, 5).map((bid, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-green-400">{bid.price.toFixed(1)}</span>
                      <span className="text-gray-300">{bid.amount.toFixed(3)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-500 text-center py-2">Loading order book...</div>
                )}
              </div>
            </div>

            {/* Recent Trades */}
            <div className="bg-gray-800 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center">
                <Activity className="h-4 w-4 mr-1" />
                ⚡ TRADES
              </h3>
              <div className="space-y-1">
                {terminalData.recent_trades.length > 0 ? (
                  terminalData.recent_trades.map((trade, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-gray-400">{trade.time}</span>
                      <span className={trade.side === 'buy' ? 'text-green-400' : 'text-red-400'}>
                        {trade.price.toFixed(1)}
                      </span>
                      <span className="text-gray-300">{trade.amount.toFixed(3)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-gray-500 text-center py-2">Loading trades...</div>
                )}
              </div>
            </div>

            {/* Liquidations */}
            <div className="bg-gray-800 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-1" />
                💥 LIQUIDATIONS
              </h3>
                              <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-green-400 text-xs">Longs</span>
                    <span className="text-white text-xs font-medium">
                      {terminalData.liquidations.longs > 0 
                        ? `$${(terminalData.liquidations.longs / 1e6).toFixed(1)}M`
                        : 'Loading...'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-400 text-xs">Shorts</span>
                    <span className="text-white text-xs font-medium">
                      {terminalData.liquidations.shorts > 0 
                        ? `$${(terminalData.liquidations.shorts / 1e6).toFixed(1)}M`
                        : 'Loading...'}
                    </span>
                  </div>
                  {(terminalData.liquidations.longs > 0 || terminalData.liquidations.shorts > 0) && (
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-green-500 to-red-500 h-2 rounded-full"
                        style={{ 
                          width: `${(terminalData.liquidations.longs / (terminalData.liquidations.longs + terminalData.liquidations.shorts)) * 100}%` 
                        }}
                      ></div>
                    </div>
                  )}
                </div>
            </div>

            {/* Open Interest */}
            <div className="bg-gray-800 rounded-lg p-3">
              <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center">
                <PieChart className="h-4 w-4 mr-1" />
                🎯 OPEN INTEREST
              </h3>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {terminalData.open_interest > 0 
                    ? `$${(terminalData.open_interest / 1e9).toFixed(1)}B`
                    : 'Loading...'}
                </div>
                <div className="text-xs text-gray-400">
                  {terminalData.open_interest > 0 ? 'Total OI - Live' : 'Total OI'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Terminal Footer */}
      <div className="bg-gray-800 border-t border-gray-700 p-2 text-xs text-gray-400 flex justify-between">
        <div className="flex space-x-6">
          <span>🔥 Alpha Terminal - Professional Trading Intelligence</span>
          <span>📊 Real-time data from 17+ exchanges</span>
        </div>
        <div className="flex space-x-6">
          <span>💼 Professional Tools Enabled</span>
          <span>🚀 Ultra-low latency feeds</span>
        </div>
      </div>
    </div>
  );
} 