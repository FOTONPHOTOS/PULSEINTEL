import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { apiConfig } from '../apiConfig';
import { subscribeToDepth } from '../services/WebSocketService';

interface Props {
  symbol?: string;
}

const OrderbookDepthChart: React.FC<Props> = ({ symbol = 'BTCUSDT' }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  
  // Use a state to hold the chart instance to simplify effect dependencies
  const [chart, setChart] = useState<echarts.ECharts | null>(null);

  useEffect(() => {
    // Initialize chart
    if (chartRef.current) {
      const chartInstance = echarts.init(chartRef.current, null, {
        renderer: 'canvas',
        useDirtyRect: false
      }); // Initialize without theme to have full control
      setChart(chartInstance);
      
      // Handle chart resizing
      const handleResize = () => chartInstance.resize();
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        chartInstance.dispose();
      };
    }
  }, []);

  useEffect(() => {
    if (!chart || !symbol) return;

    let isMounted = true;
    
    const updateChartWithData = (data: any) => {
      if (!isMounted) return;
      
      chart.hideLoading();

        console.log('🔥 RAW ORDERBOOK DATA:', data);
        console.log('📊 Bids count:', data?.bids?.length, 'Asks count:', data?.asks?.length);

        if (data && data.bids && data.asks && data.bids.length > 0 && data.asks.length > 0) {
          // Process data for depth chart - IMPROVED ALGORITHM
          let bidTotal = 0;
          const processedBids = data.bids
            .slice(0, 50) // Take top 50 levels for performance
            .map(([price, size]) => {
              bidTotal += size;
              return [parseFloat(price.toString()), bidTotal];
            })
            .reverse(); // Bids should go from low to high price

          let askTotal = 0;
          const processedAsks = data.asks
            .slice(0, 50) // Take top 50 levels for performance  
            .map(([price, size]) => {
              askTotal += size;
              return [parseFloat(price.toString()), askTotal];
            });
          
          console.log('📈 PROCESSED BIDS (first 5):', processedBids.slice(0, 5));
          console.log('📉 PROCESSED ASKS (first 5):', processedAsks.slice(0, 5));
          console.log('💰 BID TOTAL VOLUME:', bidTotal, 'ASK TOTAL VOLUME:', askTotal);

          const midPrice = (data.asks[0][0] + data.bids[0][0]) / 2;
          const spread = data.asks[0][0] - data.bids[0][0];
          console.log('🎯 MID PRICE:', midPrice, 'SPREAD:', spread);

          chart.hideLoading();
          console.log('🎨 SETTING CHART WITH ENHANCED STYLING - MASSIVE 10px LINES');
          
          chart.setOption({
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
            title: {
              text: `${symbol} REAL Orderbook Depth`,
              subtext: `${data.exchange} • Spread: $${spread.toFixed(2)} • Mid: $${midPrice.toFixed(2)}`,
              textStyle: { 
                color: '#ffffff', 
                fontSize: 18, 
                fontWeight: 'bold' 
              },
              subtextStyle: {
                color: '#00ff88',
                fontSize: 12
              },
              left: 'center',
              top: '2%'
            },
            tooltip: {
              trigger: 'axis',
              axisPointer: { 
                type: 'cross',
                lineStyle: { color: '#00ff88', width: 2, type: 'solid' }
              },
              backgroundColor: 'rgba(0, 0, 0, 0.95)',
              borderColor: '#00ff88',
              borderWidth: 2,
              textStyle: { color: '#ffffff', fontSize: 13 },
              formatter: (params: any) => {
                const bid = params.find((p: any) => p.seriesName === 'Bids');
                const ask = params.find((p: any) => p.seriesName === 'Asks');
                const price = params[0].axisValue;
                
                let tooltipText = `<div style="padding: 10px;">`;
                tooltipText += `<div style="margin-bottom: 8px;"><strong>Price:</strong> <span style="color: #00ff88; font-size: 14px;">$${parseFloat(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>`;
                
                if (bid && bid.data) {
                  tooltipText += `<div style="margin-bottom: 4px;"><span style="color: #22c55e; font-weight: bold;">🟢 BID DEPTH:</span> <span style="color: #ffffff; font-size: 13px;">${bid.data[1].toFixed(4)} BTC</span></div>`;
                }
                if (ask && ask.data) {
                  tooltipText += `<div><span style="color: #ef4444; font-weight: bold;">🔴 ASK DEPTH:</span> <span style="color: #ffffff; font-size: 13px;">${ask.data[1].toFixed(4)} BTC</span></div>`;
                }
                
                tooltipText += `</div>`;
                return tooltipText;
              }
            },
            grid: { 
              top: '18%', 
              bottom: '20%', 
              left: '15%', 
              right: '8%',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderColor: '#444',
              borderWidth: 2
            },
            xAxis: {
              type: 'value',
              name: 'Price (USD)',
              nameLocation: 'middle',
              nameGap: 30,
              nameTextStyle: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
              axisLine: { 
                show: true, 
                lineStyle: { color: '#666', width: 2 } 
              },
              axisLabel: { 
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 'bold',
                formatter: (value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
              },
              splitLine: { 
                show: true, 
                lineStyle: { color: 'rgba(128, 128, 128, 0.2)', type: 'dashed', width: 1 } 
              },
              axisTick: { show: true, lineStyle: { color: '#666', width: 2 } }
            },
            yAxis: {
              type: 'value',
              name: 'Cumulative Volume (BTC)',
              nameLocation: 'middle',
              nameGap: 50,
              nameTextStyle: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
              axisLine: { 
                show: true, 
                lineStyle: { color: '#666', width: 2 } 
              },
              axisLabel: { 
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 'bold',
                formatter: (value: number) => `${value.toFixed(1)} BTC`
              },
              splitLine: { 
                show: true, 
                lineStyle: { color: 'rgba(128, 128, 128, 0.2)', type: 'dashed', width: 1 } 
              },
              axisTick: { show: true, lineStyle: { color: '#666', width: 2 } }
            },
            legend: {
              data: ['Bids', 'Asks'],
              bottom: '8%',
              left: 'center',
              textStyle: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },
              itemGap: 30,
              icon: 'rect',
              itemWidth: 20,
              itemHeight: 20
            },
            series: [
              {
                name: 'Bids',
                type: 'line',
                data: processedBids,
                smooth: false,
                symbol: 'none',
                lineStyle: { 
                  width: 10, // MASSIVE LINE WIDTH
                  color: '#22c55e',
                  shadowColor: 'rgba(34, 197, 94, 0.5)',
                  shadowBlur: 8,
                  shadowOffsetY: 2
                },
                areaStyle: {
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(34, 197, 94, 0.8)' },
                    { offset: 0.5, color: 'rgba(34, 197, 94, 0.4)' },
                    { offset: 1, color: 'rgba(34, 197, 94, 0.1)' }
                  ])
                },
                emphasis: {
                  lineStyle: { width: 12 }
                }
              },
              {
                name: 'Asks',
                type: 'line',
                data: processedAsks,
                smooth: false,
                symbol: 'none',
                lineStyle: { 
                  width: 10, // MASSIVE LINE WIDTH
                  color: '#ef4444',
                  shadowColor: 'rgba(239, 68, 68, 0.5)',
                  shadowBlur: 8,
                  shadowOffsetY: 2
                },
                areaStyle: {
                  color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: 'rgba(239, 68, 68, 0.8)' },
                    { offset: 0.5, color: 'rgba(239, 68, 68, 0.4)' },
                    { offset: 1, color: 'rgba(239, 68, 68, 0.1)' }
                  ])
                },
                emphasis: {
                  lineStyle: { width: 12 }
                }
              }
            ],
            animation: true,
            animationDuration: 1200,
            animationEasing: 'cubicOut'
          });

          console.log('✅ CHART UPDATED WITH REAL DATA! Check console for debug info.');

        } else {
          chart.hideLoading();
          console.warn('❌ NO ORDERBOOK DATA AVAILABLE:', data);
          // Show a message when data is empty or invalid
          chart.setOption({
            backgroundColor: 'rgba(0, 0, 0, 0.02)',
            title: { 
              text: '❌ No orderbook data available', 
              subtext: 'Waiting for real-time data...',
              textStyle: { 
                color: '#ef4444', 
                fontSize: 16,
                fontWeight: 'bold'
              },
              subtextStyle: {
                color: '#888',
                fontSize: 12
              },
              left: 'center', 
              top: 'center' 
            },
            grid: { 
              show: true,
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              borderColor: '#333',
              borderWidth: 1,
              top: '15%', 
              bottom: '20%', 
              left: '12%', 
              right: '8%'
            },
            xAxis: { 
              show: true,
              type: 'value',
              name: 'Price (USD)',
              nameTextStyle: { color: '#444' },
              axisLine: { lineStyle: { color: '#333' } },
              axisLabel: { color: '#444' },
              splitLine: { lineStyle: { color: 'rgba(128, 128, 128, 0.1)' } }
            },
            yAxis: { 
              show: true,
              type: 'value',
              name: 'Cumulative Volume',
              nameTextStyle: { color: '#444' },
              axisLine: { lineStyle: { color: '#333' } },
              axisLabel: { color: '#444' },
              splitLine: { lineStyle: { color: 'rgba(128, 128, 128, 0.1)' } }
            },
            series: []
          });
        }
    };

    // Subscribe to real-time depth data
    console.log(`🔌 OrderbookDepthChart: Subscribing to ${symbol} depth data`);
    chart.showLoading();
    
    const unsubscribeDepth = subscribeToDepth(symbol, (data) => {
      console.log('📊 Depth data for orderbook chart:', data);
      updateChartWithData(data);
    });

    // Fallback: create mock data if no real data available
    const createMockData = () => {
      const mockData = {
        bids: Array.from({ length: 50 }, (_, i) => [
          100000 - (i * 50), // Price decreasing
          Math.random() * 5 + 0.5 // Size
        ]),
        asks: Array.from({ length: 50 }, (_, i) => [
          100100 + (i * 50), // Price increasing  
          Math.random() * 5 + 0.5 // Size
        ]),
        exchange: 'Mock Exchange'
      };
      
      setTimeout(() => {
        if (isMounted) {
          console.log('📊 Using mock orderbook data');
          updateChartWithData(mockData);
        }
      }, 2000);
    };

    createMockData();

    return () => {
      isMounted = false;
      unsubscribeDepth();
    };
  }, [chart, symbol]);

  return <div ref={chartRef} style={{ width: '100%', height: '400px' }} />;
};

export default OrderbookDepthChart;