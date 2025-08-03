import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { 
  createChart, 
  IChartApi, 
  ISeriesApi, 
  ColorType,
  CandlestickData,
  HistogramData,
  LineData,
  Time
} from 'lightweight-charts';
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3,
  PieChart,
  Brain,
  RefreshCw,
  Wifi,
  WifiOff,
  BookOpen,
  Zap
} from 'lucide-react';
import { apiConfig } from '../apiConfig';
import { 
  subscribeToTrades, 
  subscribeToCandles, 
  subscribeToDepth, 
  subscribeToLiquidations
} from '../services/WebSocketService';

// --- Helper Components ---
const OrderBookRow = memo(({ price, size, total, maxTotal, type }: { price: string, size: string, total: string, maxTotal: number, type: 'bid' | 'ask' }) => {
  const barWidth = (parseFloat(total) / maxTotal) * 100;
  const colorClass = type === 'bid' ? 'bg-green-500/10' : 'bg-red-500/10';
  
  return (
    <div className="relative flex justify-between text-xs font-mono h-5 items-center px-1">
      <div className={`absolute top-0 bottom-0 ${type === 'bid' ? 'right-0' : 'left-0'} ${colorClass}`} style={{ width: `${barWidth}%` }}></div>
      <span className={`z-10 w-1/3 text-left ${type === 'bid' ? 'text-green-400' : 'text-red-400'}`}>{price}</span>
      <span className="z-10 w-1/3 text-right text-white">{size}</span>
      <span className="z-10 w-1/3 text-right text-slate-400">{total}</span>
    </div>
  );
});

const RecentTradeRow = memo(({ price, quantity, timestamp, side }: { price: number, quantity: number, timestamp: number, side: string }) => (
  <div className="flex justify-between text-xs font-mono">
    <span className={side === 'buy' ? 'text-green-400' : 'text-red-400'}>{price.toFixed(2)}</span>
    <span className="text-white">{quantity.toFixed(4)}</span>
    <span className="text-slate-500">{new Date(timestamp).toLocaleTimeString()}</span>
  </div>
));


// --- Technical Indicators Engine ---
class TerminalIndicators {
    static calculateRSI(data: any[], period: number = 14): LineData[] {
        const rsiData: LineData[] = [];
        if (data.length <= period) return rsiData;

        let gains: number[] = [];
        let losses: number[] = [];

        for (let i = 1; i < data.length; i++) {
            const change = data[i].close - data[i - 1].close;
            gains.push(change > 0 ? change : 0);
            losses.push(change < 0 ? Math.abs(change) : 0);
        }

        let avgGain = gains.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
        let avgLoss = losses.slice(0, period).reduce((sum, val) => sum + val, 0) / period;

        for (let i = period; i < gains.length; i++) {
            const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
            const rsi = 100 - (100 / (1 + rs));
            if (data[i + 1]) {
                rsiData.push({ time: data[i + 1].time, value: rsi });
            }

            avgGain = (avgGain * (period - 1) + gains[i]) / period;
            avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
        }
        return rsiData;
    }

    static calculateCVD(data: any[]): LineData[] {
        let cvd = 0;
        return data.map(candle => {
            const volumeDelta = candle.close > candle.open ? (candle.volume || 0) : -(candle.volume || 0);
            cvd += volumeDelta;
            return { time: candle.time, value: cvd };
        });
    }
}

// --- Main Terminal Component ---
export default function AlphaTerminal() {
  const mainChartRef = useRef<HTMLDivElement>(null);
  const cvdChartRef = useRef<HTMLDivElement>(null);
  const volumeChartRef = useRef<HTMLDivElement>(null);
  const rsiChartRef = useRef<HTMLDivElement>(null);
  
  const charts = useRef<{ [key: string]: IChartApi | null }>({});
  const series = useRef<{ [key: string]: ISeriesApi<any> | null }>({});

  const [currentSymbol, setCurrentSymbol] = useState('BTCUSDT');
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  
  const [terminalData, setTerminalData] = useState({
    price: 0, change24h: 0, volume24h: 0, marketCap: 0, fear_greed: 50,
    funding_rate: 0, open_interest: 0,
    liquidations: { longs: 0, shorts: 0 },
    orderbook: { bids: [] as any[], asks: [] as any[] },
    recent_trades: [] as any[]
  });

  const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

  const initializeCharts = useCallback(() => {
    const refs = { main: mainChartRef, cvd: cvdChartRef, volume: volumeChartRef, rsi: rsiChartRef };
    Object.values(charts.current).forEach(chart => chart?.remove());

    const chartOptions = (height: number, timeScaleVisible = false) => ({
        width: refs.main.current?.clientWidth, height,
        layout: { background: { type: ColorType.Solid, color: '#111827' }, textColor: '#D1D5DB', fontFamily: 'Inter', fontSize: 12 },
        grid: { vertLines: { color: '#1F2937' }, horzLines: { color: '#1F2937' } },
        rightPriceScale: { borderColor: '#374151' },
        timeScale: { borderColor: '#374151', visible: timeScaleVisible, timeVisible: true, secondsVisible: false },
        crosshair: { mode: 1 }
    });

    charts.current.main = createChart(refs.main.current!, chartOptions(350, true));
    series.current.candles = charts.current.main.addCandlestickSeries({ upColor: '#10B981', downColor: '#EF4444', borderVisible: false, wickUpColor: '#10B981', wickDownColor: '#EF4444' });

    charts.current.cvd = createChart(refs.cvd.current!, chartOptions(100));
    series.current.cvd = charts.current.cvd.addLineSeries({ color: '#F59E0B', lineWidth: 2 });

    charts.current.volume = createChart(refs.volume.current!, chartOptions(100));
    series.current.volume = charts.current.volume.addHistogramSeries({ color: '#3B82F6' });

    charts.current.rsi = createChart(refs.rsi.current!, chartOptions(100));
    series.current.rsi = charts.current.rsi.addLineSeries({ color: '#8B5CF6', lineWidth: 2 });
  }, []);
  
  const loadTerminalData = useCallback(async (symbol: string) => {
    setIsLoading(true);
    try {
      const res = await Promise.all([
        fetch(`${apiConfig.REST_API_SERVICE}/api/historical-price/${symbol}?timeframe=1m&limit=500`),
        fetch(`${apiConfig.REST_API_SERVICE}/api/market-overview`),
        fetch(`${apiConfig.REST_API_SERVICE}/api/funding-rates/${symbol}`),
        fetch(`${apiConfig.REST_API_SERVICE}/api/open-interest/${symbol}`)
      ]);
      const [historical, overview, funding, oi] = await Promise.all(res.map(r => r.json()));

      if (historical && historical.length > 0) {
        const chartData = historical.map((d: any) => ({
          time: Math.floor(d.timestamp / 1000) as Time,
          open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume
        }));
        series.current.candles?.setData(chartData);
        series.current.volume?.setData(chartData.map((d: any) => ({ time: d.time, value: d.volume, color: d.close > d.open ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)' })));
        series.current.cvd?.setData(TerminalIndicators.calculateCVD(chartData));
        series.current.rsi?.setData(TerminalIndicators.calculateRSI(chartData));
        charts.current.main?.timeScale().fitContent();
      }

      setTerminalData(prev => ({
        ...prev, symbol,
        price: overview.current_price || 0, change24h: overview.price_change_percent_24h || 0,
        volume24h: overview.total_volume_usd || 0, marketCap: overview.total_market_cap_usd || 0,
        funding_rate: funding[0]?.rate || 0,
        open_interest: oi.reduce((sum: number, item: any) => sum + item.openInterest, 0) || 0,
      }));
    } catch (error) {
      console.error('Error loading initial terminal data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainChartRef.current && !charts.current.main) {
      initializeCharts();
    }
    loadTerminalData(currentSymbol);

    const subscriptions = [
      subscribeToTrades(currentSymbol, (trade) => {
        setTerminalData(prev => ({ ...prev, price: trade.price, recent_trades: [trade, ...prev.recent_trades.slice(0, 19)] }));
        setIsConnected(true);
      }),
      subscribeToCandles(currentSymbol, '1m', (candle) => {
        const candleData = {
            time: Math.floor(candle.timestamp / 1000) as Time,
            open: candle.open, high: candle.high, low: candle.low, close: candle.close, volume: candle.volume
        };
        series.current.candles?.update(candleData);
        series.current.volume?.update({ time: candleData.time, value: candleData.volume, color: candleData.close > candleData.open ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)' });
      }),
      subscribeToDepth(currentSymbol, (depth) => setTerminalData(prev => ({ ...prev, orderbook: depth }))),
      subscribeToLiquidations(currentSymbol, (liq) => setTerminalData(prev => ({ ...prev, liquidations: liq })))
    ];

    return () => {
      subscriptions.forEach(unsub => unsub());
      Object.values(charts.current).forEach(chart => chart?.remove());
      charts.current = {};
    };
  }, [currentSymbol, initializeCharts, loadTerminalData]);

  const maxOrderbookTotal = Math.max(
    ...[...terminalData.orderbook.bids, ...terminalData.orderbook.asks]
      .slice(0, 10).map(level => level[0] * level[1])
  ) || 1;

  if (isLoading) {
    return <div className="h-screen bg-slate-950 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div><span className="ml-3 text-lg">Loading Alpha Terminal...</span></div>;
  }

  return (
    <div className="h-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col font-sans">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-700/50 p-2 flex items-center justify-between">
        <div className="flex items-center space-x-4"><Brain className="h-6 w-6 text-blue-400" /><h1 className="text-lg font-bold">ALPHA TERMINAL</h1></div>
        <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-lg">
          {SYMBOLS.map(symbol => <button key={symbol} onClick={() => setCurrentSymbol(symbol)} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${currentSymbol === symbol ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>{symbol.replace('USDT', '')}</button>)}
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className={`text-lg font-bold ${terminalData.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>${terminalData.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div className={`text-xs flex items-center justify-end ${terminalData.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>{terminalData.change24h >= 0 ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}{terminalData.change24h.toFixed(2)}%</div>
          </div>
          <div className={`flex items-center space-x-2 text-sm ${isConnected ? 'text-green-400' : 'text-red-400'}`}>{isConnected ? <Wifi size={16} /> : <WifiOff size={16} />}<span>{isConnected ? 'LIVE' : 'OFFLINE'}</span></div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 overflow-hidden p-2 grid grid-cols-12 gap-2">
        <div className="col-span-9 flex flex-col gap-2">
          <div className="bg-slate-900 rounded-md p-2 flex-grow"><div ref={mainChartRef} className="w-full h-full" /></div>
          <div className="grid grid-cols-3 gap-2 h-32">
            <div className="bg-slate-900 rounded-md p-2"><h4 className="text-xs text-amber-400 mb-1">CVD</h4><div ref={cvdChartRef} className="w-full h-full" /></div>
            <div className="bg-slate-900 rounded-md p-2"><h4 className="text-xs text-blue-400 mb-1">Volume</h4><div ref={volumeChartRef} className="w-full h-full" /></div>
            <div className="bg-slate-900 rounded-md p-2"><h4 className="text-xs text-purple-400 mb-1">RSI (14)</h4><div ref={rsiChartRef} className="w-full h-full" /></div>
          </div>
        </div>

        <div className="col-span-3 flex flex-col gap-2">
          <div className="bg-slate-900 rounded-md p-3">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center"><PieChart size={14} className="mr-2 text-purple-400"/>DERIVATIVES</h3>
            <div className="grid grid-cols-2 gap-3 text-center mb-3">
              <div><span className="text-xs text-slate-400">Open Interest</span><div className="text-lg font-semibold">${(terminalData.open_interest / 1e9).toFixed(2)}B</div></div>
              <div><span className="text-xs text-slate-400">Funding</span><div className={`text-lg font-semibold ${terminalData.funding_rate > 0 ? 'text-green-400' : 'text-red-400'}`}>{(terminalData.funding_rate * 100).toFixed(4)}%</div></div>
            </div>
            <h4 className="text-xs text-slate-400 mb-1">24h Liquidations</h4>
            <div className="w-full bg-slate-800 rounded-full h-2.5 relative"><div className="bg-green-500 h-2.5 rounded-l-full" style={{ width: `${(terminalData.liquidations.longs / (terminalData.liquidations.longs + terminalData.liquidations.shorts || 1)) * 100}%` }}></div></div>
            <div className="flex justify-between text-xs mt-1"><span>Longs: ${(terminalData.liquidations.longs / 1e6).toFixed(2)}M</span><span>Shorts: ${(terminalData.liquidations.shorts / 1e6).toFixed(2)}M</span></div>
          </div>
          
          <div className="bg-slate-900 rounded-md p-3 flex-grow flex flex-col">
            <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center"><BookOpen size={14} className="mr-2 text-blue-400"/>ORDER BOOK</h3>
            <div className="flex justify-between text-xs text-slate-500 px-1"><span>Price</span><span>Size</span><span>Total</span></div>
            <div className="flex flex-col-reverse mt-1">{terminalData.orderbook.asks.slice(0, 10).map((ask, i) => <OrderBookRow key={i} price={ask[0].toFixed(2)} size={ask[1].toFixed(3)} total={(ask[0] * ask[1]).toFixed(2)} maxTotal={maxOrderbookTotal} type="ask" />)}</div>
            <div className="border-t border-slate-700 my-1"></div>
            <div>{terminalData.orderbook.bids.slice(0, 10).map((bid, i) => <OrderBookRow key={i} price={bid[0].toFixed(2)} size={bid[1].toFixed(3)} total={(bid[0] * bid[1]).toFixed(2)} maxTotal={maxOrderbookTotal} type="bid" />)}</div>
          </div>

          <div className="bg-slate-900 rounded-md p-3 flex-grow flex flex-col">
            <h3 className="text-sm font-semibold text-slate-300 mb-2 flex items-center"><Zap size={14} className="mr-2 text-yellow-400"/>RECENT TRADES</h3>
            <div className="space-y-1 overflow-y-auto flex-grow">{terminalData.recent_trades.map((trade, i) => <RecentTradeRow key={i} {...trade} />)}</div>
          </div>
        </div>
      </div>
    </div>
  );
} 