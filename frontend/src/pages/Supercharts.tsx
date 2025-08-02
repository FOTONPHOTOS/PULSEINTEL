import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  LineSeries,
  MouseEventParams,
  LogicalRange
} from 'lightweight-charts';
import { 
  TrendingUp, 
  TrendingDown, 
  Volume2, 
  Activity,
  BarChart3,
  Settings,
  Search,
  Maximize2,
  RefreshCw,
  MousePointer2,
  Minus,
  TrendingUpDown,
  PlusCircle,
  Target,
  Layers,
  Move3D,
  Palette,
  Save,
  Download,
  Fullscreen,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crosshair
} from 'lucide-react';

// Professional Technical Indicators Engine
class TechnicalIndicators {
  static calculateSMA(data: any[], period: number = 20) {
    const smaData: LineData[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const average = slice.reduce((sum, item) => sum + item.close, 0) / period;
      smaData.push({
        time: data[i].time,
        value: average
      });
    }
    return smaData;
  }

  static calculateEMA(data: any[], period: number = 20) {
    const emaData: LineData[] = [];
    const multiplier = 2 / (period + 1);
    
    // First EMA value is SMA
    let ema = data.slice(0, period).reduce((sum, item) => sum + item.close, 0) / period;
    emaData.push({ time: data[period - 1].time, value: ema });
    
    // Calculate subsequent EMA values
    for (let i = period; i < data.length; i++) {
      ema = (data[i].close * multiplier) + (ema * (1 - multiplier));
      emaData.push({ time: data[i].time, value: ema });
    }
    
    return emaData;
  }

  static calculateRSI(data: any[], period: number = 14) {
    const rsiData: LineData[] = [];
    const gains: number[] = [];
    const losses: number[] = [];
    
    // Calculate price changes
    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    // Calculate RSI
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

  static calculateMACD(data: any[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) {
    const fastEMA = this.calculateEMA(data, fastPeriod);
    const slowEMA = this.calculateEMA(data, slowPeriod);
    
    const macdLine: LineData[] = [];
    const startIndex = Math.max(fastEMA.length, slowEMA.length) - Math.min(fastEMA.length, slowEMA.length);
    
    for (let i = startIndex; i < Math.min(fastEMA.length, slowEMA.length); i++) {
      macdLine.push({
        time: fastEMA[i].time,
        value: fastEMA[i].value - slowEMA[i].value
      });
    }
    
    const signalLine = this.calculateEMA(macdLine.map(item => ({ time: item.time, close: item.value })), signalPeriod);
    const histogram: HistogramData[] = [];
    
    for (let i = 0; i < Math.min(macdLine.length, signalLine.length); i++) {
      const histValue = macdLine[i].value - signalLine[i].value;
      histogram.push({
        time: macdLine[i].time,
        value: histValue,
        color: histValue >= 0 ? '#26a69a' : '#ef5350'
      });
    }
    
    return { macdLine, signalLine, histogram };
  }

  static calculateBollingerBands(data: any[], period: number = 20, multiplier: number = 2) {
    const sma = this.calculateSMA(data, period);
    const bands = { upper: [] as LineData[], middle: [] as LineData[], lower: [] as LineData[] };
    
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = slice.reduce((sum, item) => sum + item.close, 0) / period;
      const variance = slice.reduce((sum, item) => sum + Math.pow(item.close - mean, 2), 0) / period;
      const stdDev = Math.sqrt(variance);
      
      const timestamp = data[i].time;
      bands.upper.push({ time: timestamp, value: mean + (multiplier * stdDev) });
      bands.middle.push({ time: timestamp, value: mean });
      bands.lower.push({ time: timestamp, value: mean - (multiplier * stdDev) });
    }
    
    return bands;
  }

  // 🚀 PROFESSIONAL INDICATORS - Advanced Analysis Capabilities

  static calculateStochastic(data: any[], kPeriod: number = 14, dPeriod: number = 3) {
    const stochData: { k: LineData[], d: LineData[] } = { k: [], d: [] };
    
    for (let i = kPeriod - 1; i < data.length; i++) {
      const slice = data.slice(i - kPeriod + 1, i + 1);
      const high = Math.max(...slice.map(item => item.high));
      const low = Math.min(...slice.map(item => item.low));
      const current = data[i].close;
      
      const k = ((current - low) / (high - low)) * 100;
      stochData.k.push({ time: data[i].time, value: k });
    }
    
    // Calculate %D (SMA of %K)
    for (let i = dPeriod - 1; i < stochData.k.length; i++) {
      const slice = stochData.k.slice(i - dPeriod + 1, i + 1);
      const d = slice.reduce((sum, item) => sum + item.value, 0) / dPeriod;
      stochData.d.push({ time: stochData.k[i].time, value: d });
    }
    
    return stochData;
  }

  static calculateWilliamsR(data: any[], period: number = 14) {
    const williamsData: LineData[] = [];
    
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const high = Math.max(...slice.map(item => item.high));
      const low = Math.min(...slice.map(item => item.low));
      const current = data[i].close;
      
      const williamsR = ((high - current) / (high - low)) * -100;
      williamsData.push({ time: data[i].time, value: williamsR });
    }
    
    return williamsData;
  }

  static calculateCCI(data: any[], period: number = 20) {
    const cciData: LineData[] = [];
    
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      
      // Calculate typical price for each candle
      const typicalPrices = slice.map(item => (item.high + item.low + item.close) / 3);
      
      // Calculate SMA of typical prices
      const smaTP = typicalPrices.reduce((sum, tp) => sum + tp, 0) / period;
      
      // Calculate mean deviation
      const meanDeviation = typicalPrices.reduce((sum, tp) => sum + Math.abs(tp - smaTP), 0) / period;
      
      // Current typical price
      const currentTP = (data[i].high + data[i].low + data[i].close) / 3;
      
      // CCI calculation
      const cci = (currentTP - smaTP) / (0.015 * meanDeviation);
      cciData.push({ time: data[i].time, value: cci });
    }
    
    return cciData;
  }

  static calculateADX(data: any[], period: number = 14) {
    const adxData: LineData[] = [];
    const plusDI: number[] = [];
    const minusDI: number[] = [];
    
    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevHigh = data[i - 1].high;
      const prevLow = data[i - 1].low;
      const prevClose = data[i - 1].close;
      
      const trueRange = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      
      const plusDM = high - prevHigh > prevLow - low ? Math.max(high - prevHigh, 0) : 0;
      const minusDM = prevLow - low > high - prevHigh ? Math.max(prevLow - low, 0) : 0;
      
      if (i >= period) {
        // Calculate smoothed values
        const avgTR = data.slice(i - period + 1, i + 1)
          .reduce((sum, item, idx) => sum + (idx === 0 ? trueRange : 0), 0) / period;
        
        const smoothedPlusDM = plusDM / period;
        const smoothedMinusDM = minusDM / period;
        
        const plusDIValue = (smoothedPlusDM / avgTR) * 100;
        const minusDIValue = (smoothedMinusDM / avgTR) * 100;
        
        plusDI.push(plusDIValue);
        minusDI.push(minusDIValue);
        
        if (plusDI.length >= period) {
          const dx = Math.abs(plusDIValue - minusDIValue) / (plusDIValue + minusDIValue) * 100;
          const adx = dx; // Simplified ADX calculation
          adxData.push({ time: data[i].time, value: adx });
        }
      }
    }
    
    return adxData;
  }

  static calculateATR(data: any[], period: number = 14) {
    const atrData: LineData[] = [];
    
    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevClose = data[i - 1].close;
      
      const trueRange = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );
      
      if (i >= period) {
        const slice = data.slice(i - period + 1, i + 1);
        const avgTR = slice.reduce((sum, item, idx) => {
          if (idx === 0) return trueRange;
          const tr = Math.max(
            item.high - item.low,
            Math.abs(item.high - slice[idx - 1].close),
            Math.abs(item.low - slice[idx - 1].close)
          );
          return sum + tr;
        }, 0) / period;
        
        atrData.push({ time: data[i].time, value: avgTR });
      }
    }
    
    return atrData;
  }

  static calculateVolumeSMA(data: any[], period: number = 20) {
    const volumeData: LineData[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const average = slice.reduce((sum, item) => sum + (item.volume || 0), 0) / period;
      volumeData.push({
        time: data[i].time,
        value: average
      });
    }
    return volumeData;
  }

  // 🚀 PROFESSIONAL ANALYSIS ENGINE - Advanced Pattern Recognition
  
  static analyzeMarket(data: any[]) {
    if (data.length < 50) return null;

    const analysis = {
      trend: 'SIDEWAYS' as 'BULLISH' | 'BEARISH' | 'SIDEWAYS',
      strength: 0,
      signals: [] as string[],
      patterns: [] as string[],
      supportResistance: { support: 0, resistance: 0 }
    };

    // Trend Analysis using multiple timeframes
    const recent20 = data.slice(-20);
    const recent50 = data.slice(-50);
    
    const sma20 = recent20.reduce((sum, item) => sum + item.close, 0) / 20;
    const sma50 = recent50.reduce((sum, item) => sum + item.close, 0) / 50;
    const currentPrice = data[data.length - 1].close;

    // Determine trend
    if (currentPrice > sma20 && sma20 > sma50) {
      analysis.trend = 'BULLISH';
      analysis.strength = Math.min(((currentPrice - sma50) / sma50) * 100, 100);
    } else if (currentPrice < sma20 && sma20 < sma50) {
      analysis.trend = 'BEARISH';
      analysis.strength = Math.min(((sma50 - currentPrice) / sma50) * 100, 100);
    } else {
      analysis.trend = 'SIDEWAYS';
      analysis.strength = 25;
    }

    // Signal Generation
    const rsi = this.calculateRSI(data, 14);
    const lastRSI = rsi[rsi.length - 1]?.value || 50;
    
    if (lastRSI > 70) {
      analysis.signals.push('RSI Overbought - Consider selling');
    } else if (lastRSI < 30) {
      analysis.signals.push('RSI Oversold - Consider buying');
    }

    if (analysis.trend === 'BULLISH' && lastRSI < 50) {
      analysis.signals.push('Bullish trend + RSI dip - Strong buy signal');
    }

    // Pattern Recognition
    const last5 = data.slice(-5);
    
    // Doji pattern
    const lastCandle = last5[4];
    const bodySize = Math.abs(lastCandle.close - lastCandle.open);
    const candleRange = lastCandle.high - lastCandle.low;
    
    if (bodySize / candleRange < 0.1) {
      analysis.patterns.push('Doji - Potential reversal');
    }

    // Hammer pattern
    const lowerShadow = lastCandle.open < lastCandle.close ? 
      lastCandle.open - lastCandle.low : lastCandle.close - lastCandle.low;
    const upperShadow = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
    
    if (lowerShadow > bodySize * 2 && upperShadow < bodySize) {
      analysis.patterns.push('Hammer - Bullish reversal signal');
    }

    // Support and Resistance Levels
    const highs = data.slice(-20).map(item => item.high);
    const lows = data.slice(-20).map(item => item.low);
    
    analysis.supportResistance.resistance = Math.max(...highs);
    analysis.supportResistance.support = Math.min(...lows);

    // Volume analysis
    const avgVolume = data.slice(-20).reduce((sum, item) => sum + (item.volume || 0), 0) / 20;
    const currentVolume = lastCandle.volume || 0;
    
    if (currentVolume > avgVolume * 1.5) {
      analysis.signals.push('High volume - Strong momentum');
    }

    return analysis;
  }

  static generateTradingSignals(data: any[]) {
    const signals: Array<{ type: string; reason: string; strength: number; }> = [];
    
    if (data.length < 26) return signals;

    // MACD Signal
    const macd = this.calculateMACD(data);
    const lastMACD = macd.macdLine[macd.macdLine.length - 1];
    const lastSignal = macd.signalLine[macd.signalLine.length - 1];
    
    if (lastMACD && lastSignal) {
      if (lastMACD.value > lastSignal.value) {
        signals.push({ type: 'BUY', reason: 'MACD bullish crossover', strength: 75 });
      } else {
        signals.push({ type: 'SELL', reason: 'MACD bearish crossover', strength: 75 });
      }
    }

    // Bollinger Bands Signal
    const bb = this.calculateBollingerBands(data);
    const currentPrice = data[data.length - 1].close;
    const lastUpper = bb.upper[bb.upper.length - 1]?.value;
    const lastLower = bb.lower[bb.lower.length - 1]?.value;
    
    if (lastUpper && lastLower) {
      if (currentPrice > lastUpper) {
        signals.push({ type: 'SELL', reason: 'Price above upper Bollinger Band', strength: 60 });
      } else if (currentPrice < lastLower) {
        signals.push({ type: 'BUY', reason: 'Price below lower Bollinger Band', strength: 60 });
      }
    }

    return signals;
  }
}

interface MarketData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TickerData {
  symbol: string;
  price: number;
  change_24h: number;
  volume_24h: number;
  high_24h: number;
  low_24h: number;
  last_updated: string;
}

interface Indicator {
  id: string;
  name: string;
  type: 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'BOLLINGER' | 'STOCHASTIC' | 'WILLIAMS_R' | 'CCI' | 'ADX' | 'ICHIMOKU' | 'VOLUME_SMA' | 'ATR';
  params: any;
  visible: boolean;
  color?: string;
}

const PROFESSIONAL_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'SOLUSDT', 'DOTUSDT',
  'LINKUSDT', 'AVAXUSDT', 'MATICUSDT', 'UNIUSDT', 'LTCUSDT',
  'BNBUSDT', 'XRPUSDT', 'ATOMUSDT', 'NEARUSDT', 'FTMUSDT'
];

const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' }
];

const DRAWING_TOOLS = [
  { id: 'cursor', name: 'Cursor', icon: MousePointer2 },
  { id: 'line', name: 'Trend Line', icon: Minus },
  { id: 'horizontal', name: 'Horizontal Line', icon: TrendingUpDown },
  { id: 'vertical', name: 'Vertical Line', icon: TrendingUpDown },
  { id: 'rectangle', name: 'Rectangle', icon: PlusCircle },
  { id: 'circle', name: 'Circle', icon: Target },
  { id: 'channel', name: 'Channel', icon: Layers },
  { id: 'pitchfork', name: 'Pitchfork', icon: Move3D },
  { id: 'text', name: 'Text', icon: Activity },
  { id: 'arrow', name: 'Arrow', icon: TrendingUp },
  { id: 'fibonacci', name: 'Fibonacci', icon: Target }
];

export default function ProfessionalSupercharts() {
  const mainChartRef = useRef<HTMLDivElement>(null);
  const indicatorChartRef = useRef<HTMLDivElement>(null);
  const mainChart = useRef<IChartApi | null>(null);
  const indicatorChart = useRef<IChartApi | null>(null);
  const candlestickSeries = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeries = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [currentSymbol, setCurrentSymbol] = useState('BTCUSDT');
  const [currentTimeframe, setCurrentTimeframe] = useState('15m');
  const [tickerData, setTickerData] = useState<TickerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [activeDrawingTool, setActiveDrawingTool] = useState('cursor');
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [chartTheme, setChartTheme] = useState('dark');
  const [chartType, setChartType] = useState<'candlestick' | 'line' | 'area'>('candlestick');
  const [showCrosshair, setShowCrosshair] = useState(true);
  const [activeSeries, setActiveSeries] = useState<{ [key: string]: ISeriesApi<any> }>({});
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<any[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<Time | null>(null);
  const [wsConnections, setWsConnections] = useState<{ [key: string]: WebSocket }>({});
  const [realTimeData, setRealTimeData] = useState<CandlestickData[]>([]);
  const [marketAnalysis, setMarketAnalysis] = useState<{
    trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    strength: number;
    signals: string[];
    patterns: string[];
    supportResistance: { support: number; resistance: number; };
  } | null>(null);

  // Initialize professional charts with multiple panes
  useEffect(() => {
    if (!mainChartRef.current || !indicatorChartRef.current) return;

    // Main chart configuration
    const mainChartOptions = {
      width: mainChartRef.current.clientWidth,
      height: 500,
      layout: {
        background: { type: ColorType.Solid, color: chartTheme === 'dark' ? '#0a0a0a' : '#ffffff' },
        textColor: chartTheme === 'dark' ? '#e0e0e0' : '#333333',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: chartTheme === 'dark' ? '#1a1a1a' : '#f0f0f0' },
        horzLines: { color: chartTheme === 'dark' ? '#1a1a1a' : '#f0f0f0' },
      },
             crosshair: {
         mode: 1,
         vertLine: {
           color: '#00ff88',
           style: LineStyle.Dotted,
           labelVisible: true,
         },
         horzLine: {
           color: '#00ff88',
           style: LineStyle.Dotted,
           labelVisible: true,
         },
       },
      rightPriceScale: {
        borderColor: chartTheme === 'dark' ? '#333333' : '#cccccc',
        textColor: chartTheme === 'dark' ? '#e0e0e0' : '#333333',
        entireTextOnly: true,
      },
      timeScale: {
        borderColor: chartTheme === 'dark' ? '#333333' : '#cccccc',
        timeVisible: true,
        secondsVisible: false,
        rightBarStaysOnScroll: true,
        barSpacing: 12,
        minBarSpacing: 8,
      },
      localization: {
        priceFormatter: (price: number) => `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
    };

    // Indicator chart configuration
    const indicatorChartOptions = {
      width: indicatorChartRef.current.clientWidth,
      height: 200,
      layout: {
        background: { type: ColorType.Solid, color: chartTheme === 'dark' ? '#0a0a0a' : '#ffffff' },
        textColor: chartTheme === 'dark' ? '#e0e0e0' : '#333333',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: chartTheme === 'dark' ? '#1a1a1a' : '#f0f0f0' },
        horzLines: { color: chartTheme === 'dark' ? '#1a1a1a' : '#f0f0f0' },
      },
      rightPriceScale: {
        borderColor: chartTheme === 'dark' ? '#333333' : '#cccccc',
        textColor: chartTheme === 'dark' ? '#e0e0e0' : '#333333',
      },
      timeScale: {
        borderColor: chartTheme === 'dark' ? '#333333' : '#cccccc',
        visible: false,
      },
    };

    mainChart.current = createChart(mainChartRef.current, mainChartOptions);
    indicatorChart.current = createChart(indicatorChartRef.current, indicatorChartOptions);

    // Add professional candlestick series
    candlestickSeries.current = mainChart.current.addSeries(CandlestickSeries, {
      upColor: '#00ff88',
      downColor: '#ff4444',
      borderDownColor: '#ff4444',
      borderUpColor: '#00ff88',
      wickDownColor: '#ff4444',
      wickUpColor: '#00ff88',
      priceLineVisible: true,
    });

    // Add volume series
    volumeSeries.current = mainChart.current.addSeries(HistogramSeries, {
      color: '#26a69a88',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    // Configure volume scale
    volumeSeries.current.priceScale().applyOptions({
      scaleMargins: { top: 0.7, bottom: 0 },
    });

    // Professional crosshair with price/time display and drawing tools
    mainChart.current.subscribeCrosshairMove((param: MouseEventParams) => {
      if (indicatorChart.current && param.time) {
        indicatorChart.current.timeScale().scrollToPosition(
          mainChart.current!.timeScale().timeToCoordinate(param.time as Time) || 0,
          false
        );
      }
      
      // Update crosshair data for display
      if (param.time && param.point) {
        setCurrentTime(param.time as Time);
        const priceData = param.seriesData.get(candlestickSeries.current!);
        if (priceData && typeof priceData === 'object' && 'close' in priceData) {
          setCurrentPrice(priceData.close as number);
        }
      }
    });

    // Professional drawing tools event handling
    mainChart.current.subscribeClick((param: MouseEventParams) => {
      if (activeDrawingTool !== 'cursor' && param.time && param.point) {
        handleDrawingClick(param.time as Time, param.point.y);
      }
    });

    // Handle resize
    const handleResize = () => {
      if (mainChartRef.current && mainChart.current) {
        mainChart.current.applyOptions({
          width: mainChartRef.current.clientWidth,
        });
      }
      if (indicatorChartRef.current && indicatorChart.current) {
        indicatorChart.current.applyOptions({
          width: indicatorChartRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mainChart.current) mainChart.current.remove();
      if (indicatorChart.current) indicatorChart.current.remove();
    };
  }, [chartTheme]);

  // 🚀 WebSocket-First Chart Data Loading (Rate Limit Protection)
  const loadChartData = async (symbol: string, timeframe: string) => {
    try {
      setIsLoading(true);
      
      // Close existing WebSocket connections
      Object.values(wsConnections).forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
      
      // 1. Load initial historical data via REST (one-time only)
      console.log(`🔄 Loading initial historical data for ${symbol} via REST (one-time)...`);
      const response = await fetch(`http://localhost:8888/api/historical-price/${symbol}?timeframe=${timeframe}&limit=2000`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();

      if (data.real_data && data.data && data.data.length > 0) {
        const chartData: CandlestickData[] = data.data.map((item: any) => ({
          time: Math.floor(item.timestamp / 1000) as Time,
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
        }));

        const volumeData: HistogramData[] = data.data.map((item: any) => ({
          time: Math.floor(item.timestamp / 1000) as Time,
          value: parseFloat(item.volume || '0'),
          color: item.close > item.open ? '#00ff8844' : '#ff444444',
        }));

        if (candlestickSeries.current && volumeSeries.current) {
          candlestickSeries.current.setData(chartData);
          volumeSeries.current.setData(volumeData);
          
          // Auto-fit content for better visibility
          mainChart.current?.timeScale().fitContent();
        }

        // Store initial data for real-time updates
        setRealTimeData(chartData);

        // Calculate and display indicators
        updateIndicators(chartData);

        // 🚀 PROFESSIONAL ANALYSIS - Real-time market analysis
        const analysis = TechnicalIndicators.analyzeMarket(chartData);
        setMarketAnalysis(analysis);

        console.log(`✅ Loaded ${chartData.length} historical candles for ${symbol} (${timeframe})`);
        
        // 2. 🔥 ESTABLISH REAL-TIME WEBSOCKET CONNECTION
        setupWebSocketConnections(symbol, timeframe);
        
        setIsConnected(true);
      } else {
        throw new Error('Invalid or no real data received from API');
      }
    } catch (error) {
      console.error('Error loading chart data:', error);
      setIsConnected(false);
      // Clear charts if no real data available
      if (candlestickSeries.current && volumeSeries.current) {
        candlestickSeries.current.setData([]);
        volumeSeries.current.setData([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 🚀 WEBSOCKET REAL-TIME CONNECTIONS (Rate Limit Protection)
  const setupWebSocketConnections = (symbol: string, timeframe: string) => {
    const newConnections: { [key: string]: WebSocket } = {};

    console.log(`🚀 Setting up WebSocket connections for ${symbol}...`);

    // Real-time ticker WebSocket
    const tickerWs = new WebSocket(`ws://localhost:8888/ws/ticker/${symbol}`);
    
    tickerWs.onopen = () => {
      console.log(`✅ WebSocket connected: Real-time ticker for ${symbol}`);
      setIsConnected(true);
    };
    
    tickerWs.onmessage = (event) => {
      try {
        const tickerUpdate = JSON.parse(event.data);
        console.log(`📊 Real-time ticker update:`, tickerUpdate);
        
        // Update ticker data in real-time
        if (tickerUpdate.symbol === symbol) {
          setTickerData({
            symbol: tickerUpdate.symbol,
            price: parseFloat(tickerUpdate.price),
            change_24h: parseFloat(tickerUpdate.change_24h || '0'),
            volume_24h: parseFloat(tickerUpdate.volume_24h || '0'),
            high_24h: parseFloat(tickerUpdate.high_24h || '0'),
            low_24h: parseFloat(tickerUpdate.low_24h || '0'),
            last_updated: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error processing ticker WebSocket data:', error);
      }
    };
    
    tickerWs.onerror = (error) => {
      console.error('Ticker WebSocket error:', error);
      setIsConnected(false);
    };
    
    tickerWs.onclose = () => {
      console.log('🔄 Ticker WebSocket disconnected. Attempting reconnection...');
      setIsConnected(false);
      // Auto-reconnect after 3 seconds
      setTimeout(() => setupWebSocketConnections(symbol, timeframe), 3000);
    };

    newConnections['ticker'] = tickerWs;

    // Real-time price updates WebSocket
    const realtimeWs = new WebSocket(`ws://localhost:8888/ws/realtime`);
    
    realtimeWs.onopen = () => {
      console.log(`✅ WebSocket connected: Real-time price updates`);
      // Subscribe to specific symbol
      realtimeWs.send(JSON.stringify({
        action: 'subscribe',
        symbol: symbol,
        timeframe: timeframe
      }));
    };
    
    realtimeWs.onmessage = (event) => {
      try {
        const priceUpdate = JSON.parse(event.data);
        console.log(`📈 Real-time price update:`, priceUpdate);
        
        // Update chart with new price data
        if (priceUpdate.symbol === symbol && priceUpdate.data) {
          const newCandle: CandlestickData = {
            time: Math.floor(priceUpdate.data.timestamp / 1000) as Time,
            open: parseFloat(priceUpdate.data.open),
            high: parseFloat(priceUpdate.data.high),
            low: parseFloat(priceUpdate.data.low),
            close: parseFloat(priceUpdate.data.close),
          };

          const newVolume: HistogramData = {
            time: Math.floor(priceUpdate.data.timestamp / 1000) as Time,
            value: parseFloat(priceUpdate.data.volume || '0'),
            color: priceUpdate.data.close > priceUpdate.data.open ? '#00ff8844' : '#ff444444',
          };

          // Update series with new data
          if (candlestickSeries.current && volumeSeries.current) {
            candlestickSeries.current.update(newCandle);
            volumeSeries.current.update(newVolume);
          }

          // Update real-time data array
          setRealTimeData(prev => {
            const updated = [...prev];
            const lastIndex = updated.length - 1;
            
            // If it's the same timeframe, update the last candle; otherwise add new
            if (updated[lastIndex] && updated[lastIndex].time === newCandle.time) {
              updated[lastIndex] = newCandle;
            } else {
              updated.push(newCandle);
              // Keep only last 2000 candles for performance
              if (updated.length > 2000) {
                updated.shift();
              }
            }
            
            return updated;
          });
        }
      } catch (error) {
        console.error('Error processing real-time WebSocket data:', error);
      }
    };
    
    realtimeWs.onerror = (error) => {
      console.error('Real-time WebSocket error:', error);
    };
    
    realtimeWs.onclose = () => {
      console.log('🔄 Real-time WebSocket disconnected. Attempting reconnection...');
      // Auto-reconnect after 3 seconds
      setTimeout(() => setupWebSocketConnections(symbol, timeframe), 3000);
    };

    newConnections['realtime'] = realtimeWs;

    setWsConnections(newConnections);
  };

  // Load professional ticker data (LEGACY - Now using WebSocket)
  const loadTickerData = async (symbol: string) => {
    // This function is now handled by WebSocket connections in setupWebSocketConnections()
    console.log(`⚠️ loadTickerData called for ${symbol} - Now using WebSocket instead`);
  };

  // Professional indicator management
  const addIndicator = (type: Indicator['type'], params: any = {}) => {
    const newIndicator: Indicator = {
      id: `${type}-${Date.now()}`,
      name: type,
      type,
      params,
      visible: true,
      color: getIndicatorColor(type)
    };
    
    setIndicators(prev => [...prev, newIndicator]);
  };

  const removeIndicator = (id: string) => {
    setIndicators(prev => prev.filter(ind => ind.id !== id));
  };

  const updateIndicators = (data: CandlestickData[]) => {
    if (!data.length || !indicatorChart.current || !mainChart.current) return;

    // Clear existing indicator series
    Object.keys(activeSeries).forEach((key) => {
      if (key.includes('indicator_')) {
        const series = activeSeries[key];
        mainChart.current?.removeSeries(series);
        indicatorChart.current?.removeSeries(series);
      }
    });

    indicators.forEach(indicator => {
      if (!indicator.visible) return;

      switch (indicator.type) {
        case 'RSI':
          const rsiData = TechnicalIndicators.calculateRSI(data, indicator.params.period || 14);
          const rsiSeries = indicatorChart.current!.addSeries(LineSeries, {
            color: indicator.color || '#ff6b6b',
            lineWidth: 2,
            priceScaleId: 'rsi',
          });
          rsiSeries.setData(rsiData);
          setActiveSeries(prev => ({ ...prev, [`indicator_rsi_${indicator.id}`]: rsiSeries }));
          break;

        case 'STOCHASTIC':
          const stochData = TechnicalIndicators.calculateStochastic(data, indicator.params.kPeriod || 14, indicator.params.dPeriod || 3);
          const stochKSeries = indicatorChart.current!.addSeries(LineSeries, {
            color: '#4caf50',
            lineWidth: 2,
            title: '%K',
          });
          const stochDSeries = indicatorChart.current!.addSeries(LineSeries, {
            color: '#ff9800',
            lineWidth: 2,
            title: '%D',
          });
          stochKSeries.setData(stochData.k);
          stochDSeries.setData(stochData.d);
          setActiveSeries(prev => ({ 
            ...prev, 
            [`indicator_stoch_k_${indicator.id}`]: stochKSeries,
            [`indicator_stoch_d_${indicator.id}`]: stochDSeries
          }));
          break;

        case 'WILLIAMS_R':
          const williamsData = TechnicalIndicators.calculateWilliamsR(data, indicator.params.period || 14);
          const williamsSeries = indicatorChart.current!.addSeries(LineSeries, {
            color: '#9c27b0',
            lineWidth: 2,
          });
          williamsSeries.setData(williamsData);
          setActiveSeries(prev => ({ ...prev, [`indicator_williams_${indicator.id}`]: williamsSeries }));
          break;

        case 'CCI':
          const cciData = TechnicalIndicators.calculateCCI(data, indicator.params.period || 20);
          const cciSeries = indicatorChart.current!.addSeries(LineSeries, {
            color: '#00bcd4',
            lineWidth: 2,
          });
          cciSeries.setData(cciData);
          setActiveSeries(prev => ({ ...prev, [`indicator_cci_${indicator.id}`]: cciSeries }));
          break;

        case 'ADX':
          const adxData = TechnicalIndicators.calculateADX(data, indicator.params.period || 14);
          const adxSeries = indicatorChart.current!.addSeries(LineSeries, {
            color: '#795548',
            lineWidth: 2,
          });
          adxSeries.setData(adxData);
          setActiveSeries(prev => ({ ...prev, [`indicator_adx_${indicator.id}`]: adxSeries }));
          break;

        case 'ATR':
          const atrData = TechnicalIndicators.calculateATR(data, indicator.params.period || 14);
          const atrSeries = indicatorChart.current!.addSeries(LineSeries, {
            color: '#607d8b',
            lineWidth: 2,
          });
          atrSeries.setData(atrData);
          setActiveSeries(prev => ({ ...prev, [`indicator_atr_${indicator.id}`]: atrSeries }));
          break;

        case 'MACD':
          const macdData = TechnicalIndicators.calculateMACD(data, 
            indicator.params.fast || 12, 
            indicator.params.slow || 26, 
            indicator.params.signal || 9
          );
          
          const macdSeries = indicatorChart.current!.addSeries(LineSeries, {
            color: '#2196F3',
            lineWidth: 2,
            title: 'MACD',
          });
          const signalSeries = indicatorChart.current!.addSeries(LineSeries, {
            color: '#ff9800',
            lineWidth: 2,
            title: 'Signal',
          });
          const histogramSeries = indicatorChart.current!.addSeries(HistogramSeries, {
            color: '#4caf50',
            title: 'Histogram',
          });
          
          macdSeries.setData(macdData.macdLine);
          signalSeries.setData(macdData.signalLine);
          histogramSeries.setData(macdData.histogram);
          
          setActiveSeries(prev => ({ 
            ...prev, 
            [`indicator_macd_${indicator.id}`]: macdSeries,
            [`indicator_signal_${indicator.id}`]: signalSeries,
            [`indicator_histogram_${indicator.id}`]: histogramSeries
          }));
          break;

        case 'SMA':
          const smaData = TechnicalIndicators.calculateSMA(data, indicator.params.period || 20);
          const smaSeries = mainChart.current!.addSeries(LineSeries, {
            color: indicator.color || '#2196F3',
            lineWidth: 2,
            title: `SMA (${indicator.params.period || 20})`,
          });
          smaSeries.setData(smaData);
          setActiveSeries(prev => ({ ...prev, [`indicator_sma_${indicator.id}`]: smaSeries }));
          break;

        case 'EMA':
          const emaData = TechnicalIndicators.calculateEMA(data, indicator.params.period || 21);
          const emaSeries = mainChart.current!.addSeries(LineSeries, {
            color: indicator.color || '#ff9800',
            lineWidth: 2,
            title: `EMA (${indicator.params.period || 21})`,
          });
          emaSeries.setData(emaData);
          setActiveSeries(prev => ({ ...prev, [`indicator_ema_${indicator.id}`]: emaSeries }));
          break;

        case 'BOLLINGER':
          const bollingerData = TechnicalIndicators.calculateBollingerBands(data, 
            indicator.params.period || 20, 
            indicator.params.multiplier || 2
          );
          
          const upperBandSeries = mainChart.current!.addSeries(LineSeries, {
            color: '#9c27b0',
            lineWidth: 1,
            title: 'Upper Band',
            lineStyle: LineStyle.Dashed,
          });
          const middleBandSeries = mainChart.current!.addSeries(LineSeries, {
            color: '#2196F3',
            lineWidth: 1,
            title: 'Middle Band',
          });
          const lowerBandSeries = mainChart.current!.addSeries(LineSeries, {
            color: '#9c27b0',
            lineWidth: 1,
            title: 'Lower Band',
            lineStyle: LineStyle.Dashed,
          });
          
          upperBandSeries.setData(bollingerData.upper);
          middleBandSeries.setData(bollingerData.middle);
          lowerBandSeries.setData(bollingerData.lower);
          
          setActiveSeries(prev => ({ 
            ...prev, 
            [`indicator_bb_upper_${indicator.id}`]: upperBandSeries,
            [`indicator_bb_middle_${indicator.id}`]: middleBandSeries,
            [`indicator_bb_lower_${indicator.id}`]: lowerBandSeries
          }));
          break;

        case 'VOLUME_SMA':
          const volumeSmaData = TechnicalIndicators.calculateVolumeSMA(data, indicator.params.period || 20);
          const volumeSmaSeries = indicatorChart.current!.addSeries(LineSeries, {
            color: '#ff5722',
            lineWidth: 2,
            title: `Volume SMA (${indicator.params.period || 20})`,
          });
          volumeSmaSeries.setData(volumeSmaData);
          setActiveSeries(prev => ({ ...prev, [`indicator_volume_sma_${indicator.id}`]: volumeSmaSeries }));
          break;
      }
    });
  };

  const getIndicatorColor = (type: string): string => {
    const colors = {
      'RSI': '#ff6b6b',
      'MACD': '#4ecdc4',
      'SMA': '#2196F3',
      'EMA': '#ff9800',
      'BOLLINGER': '#9c27b0'
    };
    return colors[type as keyof typeof colors] || '#ffffff';
  };

  // Professional Drawing Tools Implementation
  const handleDrawingClick = (time: Time, price: number) => {
    if (!mainChart.current) return;

    const newPoint = { time, price };
    const currentPoints = [...drawingPoints, newPoint];

    switch (activeDrawingTool) {
      case 'line':
        if (currentPoints.length === 2) {
          // Draw trend line
          drawTrendLine(currentPoints[0], currentPoints[1]);
          setDrawingPoints([]);
          setActiveDrawingTool('cursor');
        } else {
          setDrawingPoints(currentPoints);
        }
        break;

      case 'horizontal':
        // Draw horizontal line
        drawHorizontalLine(price);
        setActiveDrawingTool('cursor');
        break;

      case 'vertical':
        // Draw vertical line
        drawVerticalLine(time);
        setActiveDrawingTool('cursor');
        break;

      case 'rectangle':
        if (currentPoints.length === 2) {
          // Draw rectangle
          drawRectangle(currentPoints[0], currentPoints[1]);
          setDrawingPoints([]);
          setActiveDrawingTool('cursor');
        } else {
          setDrawingPoints(currentPoints);
        }
        break;

      case 'circle':
        if (currentPoints.length === 2) {
          // Draw circle
          drawCircle(currentPoints[0], currentPoints[1]);
          setDrawingPoints([]);
          setActiveDrawingTool('cursor');
        } else {
          setDrawingPoints(currentPoints);
        }
        break;

      case 'channel':
        if (currentPoints.length === 3) {
          // Draw channel (parallel lines)
          drawChannel(currentPoints[0], currentPoints[1], currentPoints[2]);
          setDrawingPoints([]);
          setActiveDrawingTool('cursor');
        } else {
          setDrawingPoints(currentPoints);
        }
        break;

      case 'pitchfork':
        if (currentPoints.length === 3) {
          // Draw Andrews Pitchfork
          drawPitchfork(currentPoints[0], currentPoints[1], currentPoints[2]);
          setDrawingPoints([]);
          setActiveDrawingTool('cursor');
        } else {
          setDrawingPoints(currentPoints);
        }
        break;

      case 'text':
        // Draw text annotation
        drawTextAnnotation(time, price);
        setActiveDrawingTool('cursor');
        break;

      case 'arrow':
        if (currentPoints.length === 2) {
          // Draw arrow
          drawArrow(currentPoints[0], currentPoints[1]);
          setDrawingPoints([]);
          setActiveDrawingTool('cursor');
        } else {
          setDrawingPoints(currentPoints);
        }
        break;

      case 'fibonacci':
        if (currentPoints.length === 2) {
          // Draw Fibonacci retracement
          drawFibonacci(currentPoints[0], currentPoints[1]);
          setDrawingPoints([]);
          setActiveDrawingTool('cursor');
        } else {
          setDrawingPoints(currentPoints);
        }
        break;
    }
  };

  const drawTrendLine = (point1: any, point2: any) => {
    if (!mainChart.current) return;
    
    const lineSeries = mainChart.current.addSeries(LineSeries, {
      color: '#2196F3',
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
    });

    const lineData = [
      { time: point1.time, value: point1.price },
      { time: point2.time, value: point2.price }
    ];

    lineSeries.setData(lineData);
    setActiveSeries(prev => ({ ...prev, [`line_${Date.now()}`]: lineSeries }));
  };

  const drawHorizontalLine = (price: number) => {
    if (!mainChart.current) return;

    const priceLine = {
      price: price,
      color: '#ff9800',
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: `Support/Resistance: $${price.toFixed(2)}`,
    };

    candlestickSeries.current?.createPriceLine(priceLine);
  };

  const drawVerticalLine = (time: Time) => {
    if (!mainChart.current) return;

    // Create a vertical line using a line series with same time points
    const lineSeries = mainChart.current.addSeries(LineSeries, {
      color: '#ff9800',
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
    });

    // Get chart visible range to draw full vertical line
    const visibleRange = mainChart.current.timeScale().getVisibleLogicalRange();
    if (visibleRange && realTimeData.length > 0) {
      const priceRange = {
        min: Math.min(...realTimeData.map(d => d.low)),
        max: Math.max(...realTimeData.map(d => d.high))
      };

      const lineData = [
        { time, value: priceRange.min },
        { time, value: priceRange.max }
      ];

      lineSeries.setData(lineData);
      setActiveSeries(prev => ({ ...prev, [`vertical_${Date.now()}`]: lineSeries }));
    }
  };

  const drawRectangle = (point1: any, point2: any) => {
    if (!mainChart.current) return;
    
    // Draw rectangle using multiple line series
    const rectColor = '#9c27b0';
    
    // Top line
    const topLine = mainChart.current.addSeries(LineSeries, {
      color: rectColor,
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
    });
    
    // Bottom line
    const bottomLine = mainChart.current.addSeries(LineSeries, {
      color: rectColor,
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
    });

    const topPrice = Math.max(point1.price, point2.price);
    const bottomPrice = Math.min(point1.price, point2.price);

    topLine.setData([
      { time: point1.time, value: topPrice },
      { time: point2.time, value: topPrice }
    ]);

    bottomLine.setData([
      { time: point1.time, value: bottomPrice },
      { time: point2.time, value: bottomPrice }
    ]);

    setActiveSeries(prev => ({ 
      ...prev, 
      [`rect_top_${Date.now()}`]: topLine,
      [`rect_bottom_${Date.now()}`]: bottomLine
    }));
  };

  const drawCircle = (point1: any, point2: any) => {
    if (!mainChart.current) return;
    
    // Approximate circle with multiple line segments
    const centerTime = point1.time;
    const centerPrice = point1.price;
    const radius = Math.abs(point2.price - point1.price);
    
    const circleSeries = mainChart.current.addSeries(LineSeries, {
      color: '#e91e63',
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
    });

    // Create circle approximation with 16 points
    const circleData: LineData[] = [];
    for (let i = 0; i <= 16; i++) {
      const angle = (i / 16) * 2 * Math.PI;
      const timeOffset = Math.cos(angle) * radius * 1000; // Convert to timestamp offset
      const priceOffset = Math.sin(angle) * radius;
      
      circleData.push({
        time: (centerTime as number) + timeOffset as Time,
        value: centerPrice + priceOffset
      });
    }

    circleSeries.setData(circleData);
    setActiveSeries(prev => ({ ...prev, [`circle_${Date.now()}`]: circleSeries }));
  };

  const drawChannel = (point1: any, point2: any, point3: any) => {
    if (!mainChart.current) return;
    
    // Draw parallel channel lines
    const channelColor = '#00bcd4';
    
    // Main trend line
    const mainLine = mainChart.current.addSeries(LineSeries, {
      color: channelColor,
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
    });

    // Parallel line
    const parallelLine = mainChart.current.addSeries(LineSeries, {
      color: channelColor,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
    });

    // Calculate parallel line offset based on point3
    const priceOffset = point3.price - point1.price;
    
    mainLine.setData([
      { time: point1.time, value: point1.price },
      { time: point2.time, value: point2.price }
    ]);

    parallelLine.setData([
      { time: point1.time, value: point1.price + priceOffset },
      { time: point2.time, value: point2.price + priceOffset }
    ]);

    setActiveSeries(prev => ({ 
      ...prev, 
      [`channel_main_${Date.now()}`]: mainLine,
      [`channel_parallel_${Date.now()}`]: parallelLine
    }));
  };

  const drawPitchfork = (point1: any, point2: any, point3: any) => {
    if (!mainChart.current) return;
    
    // Andrews Pitchfork implementation
    const pitchforkColor = '#795548';
    
    // Calculate median line (from point1 to midpoint of point2-point3)
    const midTime = (point2.time + point3.time) / 2;
    const midPrice = (point2.price + point3.price) / 2;
    
    // Median line
    const medianLine = mainChart.current.addSeries(LineSeries, {
      color: pitchforkColor,
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
    });

    // Upper and lower parallel lines
    const upperLine = mainChart.current.addSeries(LineSeries, {
      color: pitchforkColor,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
    });

    const lowerLine = mainChart.current.addSeries(LineSeries, {
      color: pitchforkColor,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
    });

    // Extend lines to chart end
    const extendTime = point1.time + (midTime - point1.time) * 3;

    medianLine.setData([
      { time: point1.time, value: point1.price },
      { time: extendTime as Time, value: midPrice }
    ]);

    // Calculate parallel offsets
    const upperOffset = point2.price - midPrice;
    const lowerOffset = point3.price - midPrice;

    upperLine.setData([
      { time: point2.time, value: point2.price },
      { time: extendTime as Time, value: midPrice + upperOffset }
    ]);

    lowerLine.setData([
      { time: point3.time, value: point3.price },
      { time: extendTime as Time, value: midPrice + lowerOffset }
    ]);

    setActiveSeries(prev => ({ 
      ...prev, 
      [`pitchfork_median_${Date.now()}`]: medianLine,
      [`pitchfork_upper_${Date.now()}`]: upperLine,
      [`pitchfork_lower_${Date.now()}`]: lowerLine
    }));
  };

  const drawTextAnnotation = (time: Time, price: number) => {
    if (!mainChart.current) return;
    
    // Text annotations using price lines with titles
    const priceLine = {
      price: price,
      color: '#4caf50',
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: `📝 Note: ${new Date((time as number) * 1000).toLocaleTimeString()}`,
    };

    candlestickSeries.current?.createPriceLine(priceLine);
  };

  const drawArrow = (point1: any, point2: any) => {
    if (!mainChart.current) return;
    
    // Draw arrow using line series with arrow styling
    const arrowSeries = mainChart.current.addSeries(LineSeries, {
      color: '#ff5722',
      lineWidth: 3,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
    });

    arrowSeries.setData([
      { time: point1.time, value: point1.price },
      { time: point2.time, value: point2.price }
    ]);

    setActiveSeries(prev => ({ ...prev, [`arrow_${Date.now()}`]: arrowSeries }));
  };

  const drawFibonacci = (point1: any, point2: any) => {
    if (!mainChart.current) return;
    
    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
    const priceDiff = point2.price - point1.price;

    levels.forEach((level) => {
      const fibPrice = point1.price + (priceDiff * level);
      const fibColor = getFibColor(level);
      
      const priceLine = {
        price: fibPrice,
        color: fibColor,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: `Fib ${(level * 100).toFixed(1)}%`,
      };

      candlestickSeries.current?.createPriceLine(priceLine);
    });
  };

  const getFibColor = (level: number): string => {
    const colors: { [key: number]: string } = {
      0: '#808080',      // 0%
      0.236: '#ff6b6b',  // 23.6%
      0.382: '#4ecdc4',  // 38.2%
      0.5: '#45b7d1',    // 50%
      0.618: '#96ceb4',  // 61.8%
      0.786: '#ffd93d',  // 78.6%
      1: '#ff9ff3'       // 100%
    };
    return colors[level] || '#ffffff';
  };

  // Chart Type Switching
  const changeChartType = (type: 'candlestick' | 'line' | 'area') => {
    if (!mainChart.current || !candlestickSeries.current) return;

    setChartType(type);
    
    // Remove current series
    mainChart.current.removeSeries(candlestickSeries.current);
    
    // Add new series based on type
    switch (type) {
      case 'line':
        const lineSeries = mainChart.current.addSeries(LineSeries, {
          color: '#2196F3',
          lineWidth: 2,
        });
        candlestickSeries.current = lineSeries as any;
        break;
        
      case 'area':
        const areaSeries = mainChart.current.addSeries(LineSeries, {
          color: '#2196F3',
          lineWidth: 2,
        });
        candlestickSeries.current = areaSeries as any;
        break;
        
      default: // candlestick
        const candleSeries = mainChart.current.addSeries(CandlestickSeries, {
          upColor: '#00ff88',
          downColor: '#ff4444',
          borderDownColor: '#ff4444',
          borderUpColor: '#00ff88',
          wickDownColor: '#ff4444',
          wickUpColor: '#00ff88',
          priceLineVisible: true,
        });
        candlestickSeries.current = candleSeries;
        break;
    }
    
    // Reload data for new chart type
    loadChartData(currentSymbol, currentTimeframe);
  };

  // Professional Zoom Controls
  const zoomIn = () => {
    if (!mainChart.current) return;
    const visibleRange = mainChart.current.timeScale().getVisibleLogicalRange();
    if (visibleRange) {
      const center = (visibleRange.from + visibleRange.to) / 2;
      const newRange = (visibleRange.to - visibleRange.from) * 0.8;
      mainChart.current.timeScale().setVisibleLogicalRange({
        from: center - newRange / 2,
        to: center + newRange / 2,
      });
    }
  };

  const zoomOut = () => {
    if (!mainChart.current) return;
    const visibleRange = mainChart.current.timeScale().getVisibleLogicalRange();
    if (visibleRange) {
      const center = (visibleRange.from + visibleRange.to) / 2;
      const newRange = (visibleRange.to - visibleRange.from) * 1.2;
      mainChart.current.timeScale().setVisibleLogicalRange({
        from: center - newRange / 2,
        to: center + newRange / 2,
      });
    }
  };

  const resetZoom = () => {
    if (!mainChart.current) return;
    mainChart.current.timeScale().fitContent();
  };

  // Symbol and timeframe changes - WebSocket-first
  const changeSymbol = async (symbol: string) => {
    setCurrentSymbol(symbol);
    // Close existing connections and establish new ones for the new symbol
    await loadChartData(symbol, currentTimeframe);
    // Ticker data automatically handled by WebSocket
  };

  const changeTimeframe = async (timeframe: string) => {
    setCurrentTimeframe(timeframe);
    // Close existing connections and establish new ones for the new timeframe
    await loadChartData(currentSymbol, timeframe);
  };

  // Filter symbols
  const filteredSymbols = PROFESSIONAL_SYMBOLS.filter(symbol =>
    symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Initial load - WebSocket-first approach
  useEffect(() => {
    loadChartData(currentSymbol, currentTimeframe);
    // loadTickerData is now handled by WebSocket in setupWebSocketConnections
  }, []);

  // WebSocket cleanup on component unmount
  useEffect(() => {
    return () => {
      // Close all WebSocket connections on cleanup
      Object.values(wsConnections).forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
    };
  }, [wsConnections]);

  // No more auto-refresh interval - WebSocket handles real-time updates!

  return (
    <div className={`h-screen bg-gray-900 text-white overflow-hidden flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Professional Trading Header */}
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <BarChart3 className="h-7 w-7 text-blue-500" />
            <h1 className="text-xl font-bold">PulseIntel SuperChart</h1>
            <span className="bg-gradient-to-r from-green-500 to-blue-500 text-white text-xs px-3 py-1 rounded-full">
              17+ Exchanges | Professional Trading
            </span>
          </div>
          
          {tickerData && (
            <div className="flex items-center space-x-6">
              <div className="text-3xl font-bold">{currentSymbol}</div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-400">
                  ${tickerData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className={`text-sm flex items-center ${tickerData.change_24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tickerData.change_24h >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                  {tickerData.change_24h > 0 ? '+' : ''}{tickerData.change_24h.toFixed(2)}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Professional Controls */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-400">
              {isConnected ? '🚀 WebSocket Live' : '❌ WebSocket Disconnected'}
            </span>
            <span className="text-xs text-gray-500">
              {Object.keys(wsConnections).length} connections
            </span>
          </div>

                     <button
             onClick={() => setIsFullscreen(!isFullscreen)}
             className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
           >
             <Fullscreen className="h-4 w-4" />
           </button>

          <button
            onClick={() => loadChartData(currentSymbol, currentTimeframe)}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Professional Sidebar */}
        <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden">
          {/* Symbol Search */}
          <div className="p-4 border-b border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search symbols..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Symbol List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Professional Trading Pairs</h3>
              {filteredSymbols.map((symbol) => (
                <button
                  key={symbol}
                  onClick={() => changeSymbol(symbol)}
                  className={`w-full text-left p-3 rounded-lg mb-1 transition-colors ${
                    currentSymbol === symbol
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-700 text-gray-300'
                  }`}
                >
                  <div className="font-medium">{symbol}</div>
                  <div className="text-xs text-gray-400">Multi-Exchange</div>
                </button>
              ))}
            </div>
          </div>

          {/* Professional Technical Indicators Panel */}
          <div className="p-4 border-t border-gray-700">
            <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">🚀 Professional Indicators</h3>
            
            {/* Trend Indicators */}
            <div className="mb-4">
              <h4 className="text-xs font-medium text-blue-400 mb-2">Trend Analysis</h4>
              <div className="space-y-1">
                <button
                  onClick={() => addIndicator('SMA', { period: 20 })}
                  className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-blue-600 rounded-lg text-sm transition-colors"
                >
                  + SMA (20)
                </button>
                <button
                  onClick={() => addIndicator('EMA', { period: 21 })}
                  className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-blue-600 rounded-lg text-sm transition-colors"
                >
                  + EMA (21)
                </button>
                <button
                  onClick={() => addIndicator('BOLLINGER', { period: 20, multiplier: 2 })}
                  className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-blue-600 rounded-lg text-sm transition-colors"
                >
                  + Bollinger Bands
                </button>
                <button
                  onClick={() => addIndicator('ADX', { period: 14 })}
                  className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-blue-600 rounded-lg text-sm transition-colors"
                >
                  + ADX (14)
                </button>
              </div>
            </div>

            {/* Momentum Oscillators */}
            <div className="mb-4">
              <h4 className="text-xs font-medium text-green-400 mb-2">Momentum Oscillators</h4>
              <div className="space-y-1">
                <button
                  onClick={() => addIndicator('RSI', { period: 14 })}
                  className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-green-600 rounded-lg text-sm transition-colors"
                >
                  + RSI (14)
                </button>
                <button
                  onClick={() => addIndicator('STOCHASTIC', { kPeriod: 14, dPeriod: 3 })}
                  className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-green-600 rounded-lg text-sm transition-colors"
                >
                  + Stochastic
                </button>
                <button
                  onClick={() => addIndicator('WILLIAMS_R', { period: 14 })}
                  className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-green-600 rounded-lg text-sm transition-colors"
                >
                  + Williams %R
                </button>
                <button
                  onClick={() => addIndicator('CCI', { period: 20 })}
                  className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-green-600 rounded-lg text-sm transition-colors"
                >
                  + CCI (20)
                </button>
              </div>
            </div>

            {/* Advanced Indicators */}
            <div className="mb-4">
              <h4 className="text-xs font-medium text-purple-400 mb-2">Advanced Analysis</h4>
              <div className="space-y-1">
                <button
                  onClick={() => addIndicator('MACD', { fast: 12, slow: 26, signal: 9 })}
                  className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-purple-600 rounded-lg text-sm transition-colors"
                >
                  + MACD
                </button>
                <button
                  onClick={() => addIndicator('ATR', { period: 14 })}
                  className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-purple-600 rounded-lg text-sm transition-colors"
                >
                  + ATR (14)
                </button>
                <button
                  onClick={() => addIndicator('VOLUME_SMA', { period: 20 })}
                  className="w-full text-left px-3 py-2 bg-gray-700 hover:bg-purple-600 rounded-lg text-sm transition-colors"
                >
                  + Volume SMA
                </button>
              </div>
            </div>

            {/* Active Indicators */}
            {indicators.length > 0 && (
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Active</h4>
                {indicators.map((indicator) => (
                  <div key={indicator.id} className="flex items-center justify-between p-2 bg-gray-700 rounded mb-1">
                    <span className="text-sm">{indicator.name}</span>
                    <button
                      onClick={() => removeIndicator(indicator.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 🚀 PROFESSIONAL MARKET ANALYSIS */}
          {marketAnalysis && (
            <div className="p-4 border-t border-gray-700">
              <h3 className="text-xs font-semibold text-yellow-400 uppercase mb-3">🧠 Professional Analysis</h3>
              
              {/* Trend Analysis */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Market Trend</span>
                  <div className={`px-2 py-1 rounded-full text-xs font-bold ${
                    marketAnalysis.trend === 'BULLISH' ? 'bg-green-600' :
                    marketAnalysis.trend === 'BEARISH' ? 'bg-red-600' : 'bg-yellow-600'
                  }`}>
                    {marketAnalysis.trend}
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      marketAnalysis.trend === 'BULLISH' ? 'bg-green-500' :
                      marketAnalysis.trend === 'BEARISH' ? 'bg-red-500' : 'bg-yellow-500'
                    }`}
                    style={{ width: `${marketAnalysis.strength}%` }}
                  ></div>
                </div>
                <span className="text-xs text-gray-400">Strength: {marketAnalysis.strength.toFixed(1)}%</span>
              </div>

              {/* Trading Signals */}
              {marketAnalysis.signals.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-blue-400 mb-2">🚨 Live Signals</h4>
                  <div className="space-y-1">
                    {marketAnalysis.signals.slice(0, 3).map((signal, index) => (
                      <div key={index} className="text-xs p-2 bg-gray-700 rounded">
                        <span className="text-blue-300">• {signal}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pattern Recognition */}
              {marketAnalysis.patterns.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-xs font-medium text-purple-400 mb-2">📈 Patterns Detected</h4>
                  <div className="space-y-1">
                    {marketAnalysis.patterns.map((pattern, index) => (
                      <div key={index} className="text-xs p-2 bg-gray-700 rounded">
                        <span className="text-purple-300">• {pattern}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Support & Resistance */}
              <div className="mb-4">
                <h4 className="text-xs font-medium text-orange-400 mb-2">📊 Key Levels</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-xs">Resistance</span>
                    <span className="text-red-400 font-medium text-xs">
                      ${marketAnalysis.supportResistance.resistance.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-xs">Support</span>
                    <span className="text-green-400 font-medium text-xs">
                      ${marketAnalysis.supportResistance.support.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Market Stats */}
          {tickerData && (
            <div className="p-4 border-t border-gray-700">
              <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">24h Professional Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Volume</span>
                  <span className="text-white font-medium">
                    ${(tickerData.volume_24h / 1e6).toFixed(1)}M
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">High</span>
                  <span className="text-white font-medium">${tickerData.high_24h?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Low</span>
                  <span className="text-white font-medium">${tickerData.low_24h?.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Professional Chart Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Advanced Chart Controls */}
          <div className="p-3 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
            {/* Timeframes */}
            <div className="flex space-x-1">
              {TIMEFRAMES.map((timeframe) => (
                <button
                  key={timeframe.value}
                  onClick={() => changeTimeframe(timeframe.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentTimeframe === timeframe.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {timeframe.label}
                </button>
              ))}
            </div>

            {/* Drawing Tools */}
            <div className="flex space-x-1">
              {DRAWING_TOOLS.map((tool) => {
                const IconComponent = tool.icon;
                return (
                  <button
                    key={tool.id}
                    onClick={() => setActiveDrawingTool(tool.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      activeDrawingTool === tool.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    title={tool.name}
                  >
                    <IconComponent className="h-4 w-4" />
                  </button>
                );
              })}
            </div>

            {/* Working Chart Controls */}
            <div className="flex space-x-1">
              <button 
                onClick={zoomIn}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button 
                onClick={zoomOut}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button 
                onClick={resetZoom}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                title="Reset Zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button 
                onClick={() => changeChartType(chartType === 'candlestick' ? 'line' : 'candlestick')}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                title={`Switch to ${chartType === 'candlestick' ? 'Line' : 'Candlestick'} Chart`}
              >
                <BarChart3 className="h-4 w-4" />
              </button>
              <button 
                onClick={() => setShowCrosshair(!showCrosshair)}
                className={`p-2 rounded-lg transition-colors ${
                  showCrosshair ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
                }`}
                title="Toggle Crosshair"
              >
                <Crosshair className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Main Professional Chart */}
          <div className="flex-1 relative">
            {isLoading && (
              <div className="absolute inset-0 bg-gray-900/80 flex items-center justify-center z-10">
                <div className="flex items-center space-x-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="text-white text-lg">Loading professional chart data...</span>
                </div>
              </div>
            )}
            <div ref={mainChartRef} className="w-full h-full" />
          </div>

          {/* Indicator Chart Pane */}
          <div className="h-48 border-t border-gray-700 relative">
            <div ref={indicatorChartRef} className="w-full h-full" />
          </div>

          {/* Professional Status Bar */}
          <div className="p-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-400 flex justify-between">
            <div className="flex space-x-6">
              <span>PulseIntel Professional SuperChart</span>
              <span>Real-time data from 17+ exchanges</span>
              <span>2000+ historical candles loaded</span>
            </div>
            {tickerData && (
              <div className="flex space-x-6">
                <span>Last updated: {tickerData.last_updated}</span>
                <span>Data quality: Professional</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 