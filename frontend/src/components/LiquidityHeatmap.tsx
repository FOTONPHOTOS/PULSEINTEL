import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { apiConfig } from '../apiConfig';
import { subscribeToDepth } from '../services/WebSocketService';

interface Props {
  symbol: string;
}

const LiquidityHeatmap: React.FC<Props> = ({ symbol = 'BTCUSDT' }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [xLabels, setXLabels] = useState<string[]>([]);
  const [yLabels, setYLabels] = useState<string[]>([]);
  const [heatmapData, setHeatmapData] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    console.log(`🔌 LiquidityHeatmap: Subscribing to ${symbol} depth data`);

    // Subscribe to real-time depth data
    const unsubscribeDepth = subscribeToDepth(symbol, (data) => {
      console.log('📊 Depth data for heatmap:', data);
      
      if (data && data.bids?.length && data.asks?.length) {
        processOrderbookData(data.bids, data.asks);
        setLoading(false);
        setError(null);
      } else {
        setError('Received invalid orderbook data');
        setLoading(false);
      }
    });

    // Fallback: fetch initial data from REST API if available
    const fetchInitialData = async () => {
      try {
        const response = await fetch(`${apiConfig.REST_API_SERVICE}/api/market-microstructure/${symbol}`);
        if (response.ok) {
          const data = await response.json();
          console.log('Initial market microstructure data:', data);
          
          // Create mock orderbook data for heatmap
          const mockBids = Array.from({ length: 20 }, (_, i) => [
            100000 - (i * 100), // Price decreasing
            Math.random() * 10 + 1 // Size
          ]);
          
          const mockAsks = Array.from({ length: 20 }, (_, i) => [
            100100 + (i * 100), // Price increasing
            Math.random() * 10 + 1 // Size
          ]);
          
          processOrderbookData(mockBids, mockAsks);
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching initial data:', error);
      }
    };

    fetchInitialData();

    return () => {
      unsubscribeDepth();
    };
  }, [symbol]);

  const processOrderbookData = (bids: number[][], asks: number[][]) => {
    // Get min and max prices from the orderbook data
    const allPrices = [...bids.map(bid => bid[0]), ...asks.map(ask => ask[0])];
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);

    // Create price buckets for y-axis
    const priceBuckets = 20;
    const priceStep = (maxPrice - minPrice) / priceBuckets;
    const pricesArray: string[] = [];
    for (let i = 0; i <= priceBuckets; i++) {
      pricesArray.push((minPrice + i * priceStep).toFixed(1));
    }

    // Create liquidity buckets for x-axis (representing depth)
    const liquidityBuckets = ['0-10', '10-50', '50-100', '100-500', '500-1000', '1000+'];

    // Create heatmap data
    const heatmapValues: any[] = [];
    pricesArray.forEach((price, priceIdx) => {
      const priceValue = parseFloat(price);
      const priceRange = [
        priceValue,
        priceValue + priceStep
      ];

      liquidityBuckets.forEach((bucket, bucketIdx) => {
        // Count liquidity in this price range and bucket
        let intensity = 0;
        let [min, max] = bucket.split('-').map(v => v === '1000+' ? Infinity : parseFloat(v));

        // Process bids in this range
        bids.forEach(bid => {
          const [bidPrice, bidSize] = bid;
          if (bidPrice >= priceRange[0] && bidPrice < priceRange[1]) {
            if (bidSize >= min && (bidSize < max || bucket === '1000+')) {
              intensity += bidSize;
            }
          }
        });

        // Process asks in this range
        asks.forEach(ask => {
          const [askPrice, askSize] = ask;
          if (askPrice >= priceRange[0] && askPrice < priceRange[1]) {
            if (askSize >= min && (askSize < max || bucket === '1000+')) {
              intensity += askSize;
            }
          }
        });

        // Add data point to heatmap
        if (intensity > 0) {
          heatmapValues.push([bucketIdx, priceIdx, intensity]);
        }
      });
    });

    setYLabels(pricesArray.reverse());
    setXLabels(liquidityBuckets);
    setHeatmapData(heatmapValues);
  };

  useEffect(() => {
    if (chartInstance.current) {
      chartInstance.current.dispose();
    }

    if (!chartRef.current || loading || error || !heatmapData.length) {
      return;
    }

    // Create chart
    chartInstance.current = echarts.init(chartRef.current);
    
    const option = {
      tooltip: {
        position: 'top',
        formatter: function (params: any) {
          const price = yLabels[params.data[1]];
          const bucket = xLabels[params.data[0]];
          return `Price: ${price}<br/>Size: ${bucket}<br/>Liquidity: ${params.data[2].toFixed(2)}`;
        }
      },
      animation: true,
      grid: {
        height: '80%',
        top: '10%',
        left: '15%',
        right: '10%'
      },
      xAxis: {
        type: 'category',
        data: xLabels,
        splitArea: {
          show: true
        },
        axisLabel: {
          color: '#888'
        }
      },
      yAxis: {
        type: 'category',
        data: yLabels,
        splitArea: {
          show: true
        },
        axisLabel: {
          color: '#888',
          formatter: function (value: any) {
            return parseFloat(value).toLocaleString();
          }
        }
      },
      visualMap: {
        min: 0,
        max: Math.max(...heatmapData.map(item => item[2])),
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '0%',
        inRange: {
          color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026']
        },
        textStyle: {
          color: '#888'
        }
      },
      series: [{
        name: 'Liquidity',
        type: 'heatmap',
        data: heatmapData,
        label: { show: false },
        emphasis: { 
          itemStyle: { 
            shadowBlur: 10, 
            shadowColor: 'rgba(0,0,0,0.5)' 
          } 
        }
      }]
    };
    
    chartInstance.current.setOption(option as any);
    
    const handleResize = () => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [heatmapData, xLabels, yLabels, loading, error, symbol]);

  return (
    <div className="w-full">
      <h3 className="font-bold mb-4 text-xl">Liquidity Heatmap</h3>
      {loading ? (
        <div className="flex justify-center items-center h-52">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 h-52 flex items-center justify-center">{error}</div>
      ) : (!heatmapData.length || !xLabels.length || !yLabels.length) ? (
        <div className="text-gray-500 h-52 flex items-center justify-center">No data available for this symbol.</div>
      ) : (
        <div ref={chartRef} className="w-full h-80 flex-1" style={{minHeight: '320px'}}></div>
      )}
    </div>
  );
};

export default LiquidityHeatmap; 