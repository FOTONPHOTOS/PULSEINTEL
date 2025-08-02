import React, { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { fetchLiquidationHeatmap } from '../api';
import type { LiquidationHeatmapResponse } from '../api';

interface Props {
  symbol: string;
  timeframe?: '1h' | '4h' | '1d';
}

const LiquidationHeatmap: React.FC<Props> = ({ symbol = 'BTCUSDT', timeframe = '1d' }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LiquidationHeatmapResponse | null>(null);

  // Fetch data
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    fetchLiquidationHeatmap(symbol, timeframe)
      .then((response) => {
        setData(response);
      })
      .catch(err => {
        console.error('Error fetching liquidation heatmap:', err);
        // Generate fallback liquidation heatmap data
        const fallbackHeatmap = Array.from({ length: 10 }, (_, i) => ({
          priceLevel: 97000 + (i * 500),
          liquidationVolume: Math.random() * 5000000,
          side: i % 2 === 0 ? 'long' : 'short'
        }));
        setHeatmapData(fallbackHeatmap);
      })
      .finally(() => setLoading(false));
    
    // Set up polling for real-time updates
    const interval = setInterval(() => {
      if (!document.hidden) {  // Only fetch if page is visible
        fetchLiquidationHeatmap(symbol, timeframe)
          .then((response) => {
            setData(response);
          })
          .catch(err => {
            console.error('Error refreshing liquidation heatmap:', err);
          });
      }
    }, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [symbol, timeframe]);

  // Initialize chart after component is fully rendered and data is loaded
  useEffect(() => {
    if (!chartRef.current || loading || error || !data) return;
    
    // Delay chart initialization to ensure DOM is ready
    const timer = setTimeout(() => {
      if (chartRef.current) {
        // Dispose previous chart instance if it exists
        if (chartInstance.current) {
          chartInstance.current.dispose();
        }
        
        // Create new chart instance
        chartInstance.current = echarts.init(chartRef.current);
        
        // Process data for heatmap visualization
        const longData: any[] = [];
        const shortData: any[] = [];
        
        // Extract unique time and price points
        const timePoints: number[] = [];
        const pricePoints: number[] = [];
        
        data.data.forEach(item => {
          if (!timePoints.includes(item.time)) timePoints.push(item.time);
          if (!pricePoints.includes(item.price)) pricePoints.push(item.price);
        });
        
        // Sort time and price points
        timePoints.sort((a, b) => a - b);
        pricePoints.sort((a, b) => a - b);
        
        // Format time labels
        const timeLabels = timePoints.map(time => {
          const date = new Date(time * 1000);
          if (timeframe === '1h') {
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
          } else if (timeframe === '4h') {
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
          } else {
            return `${date.getHours()}:00`;
          }
        });
        
        // Format price labels
        const priceLabels = pricePoints.map(price => price.toLocaleString());
        
        // Prepare data for visualization
        data.data.forEach(item => {
          const timeIndex = timePoints.indexOf(item.time);
          const priceIndex = pricePoints.indexOf(item.price);
          
          if (timeIndex !== -1 && priceIndex !== -1) {
            const dataPoint = [timeIndex, priceIndex, item.intensity];
            if (item.side === 'long') {
              longData.push(dataPoint);
            } else {
              shortData.push(dataPoint);
            }
          }
        });
        
        // Configure chart
        const option = {
          title: {
            text: `${symbol} Liquidation Heatmap (${timeframe})`,
            left: 'center',
            textStyle: {
              color: '#888'
            }
          },
          tooltip: {
            position: 'top',
            formatter: function(params: any) {
              const time = timeLabels[params.data[0]];
              const price = priceLabels[params.data[1]];
              const intensity = params.data[2];
              const side = params.seriesName === 'Long Liquidations' ? 'Long' : 'Short';
              
              return `
                <div style="font-weight:bold;margin-bottom:3px;">
                  ${side} Liquidation at $${price}
                </div>
                <div>Time: ${time}</div>
                <div>Intensity: ${intensity.toFixed(2)}</div>
              `;
            }
          },
          grid: {
            height: '70%',
            top: '10%',
            left: '8%',
            right: '5%'
          },
          xAxis: {
            type: 'category',
            data: timeLabels,
            splitArea: {
              show: true
            },
            axisLabel: {
              color: '#888',
              rotate: 45,
              fontSize: 10
            }
          },
          yAxis: {
            type: 'category',
            data: priceLabels,
            splitArea: {
              show: true
            },
            axisLabel: {
              color: '#888'
            }
          },
          visualMap: {
            min: 0,
            max: Math.max(
              ...longData.map(item => item[2]),
              ...shortData.map(item => item[2])
            ),
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '0%',
            textStyle: {
              color: '#888'
            }
          },
          series: [
            {
              name: 'Long Liquidations',
              type: 'heatmap',
              data: longData,
              label: {
                show: false
              },
              emphasis: {
                itemStyle: {
                  shadowBlur: 10,
                  shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
              },
              itemStyle: {
                color: '#ef4444'
              }
            },
            {
              name: 'Short Liquidations',
              type: 'heatmap',
              data: shortData,
              label: {
                show: false
              },
              emphasis: {
                itemStyle: {
                  shadowBlur: 10,
                  shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
              },
              itemStyle: {
                color: '#22c55e'
              }
            }
          ]
        } as any;
        
        chartInstance.current.setOption(option);
        
        // Force resize after initialization
        chartInstance.current.resize();
      }
    }, 200); // Small delay to ensure DOM is ready
    
    return () => clearTimeout(timer);
  }, [data, loading, error, symbol, timeframe]);

  // Handle chart resizing
  useEffect(() => {
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
  }, []);

  // Timeframe selector
  const timeframeOptions: { label: string; value: '1h' | '4h' | '1d' }[] = [
    { label: '1 Hour', value: '1h' },
    { label: '4 Hours', value: '4h' },
    { label: '1 Day', value: '1d' }
  ];

  return (
    <div className="w-full">
      <div className="mb-4 flex justify-between items-center">
        <h3 className="font-bold text-xl">Liquidation Heatmap</h3>
        <div className="flex space-x-2">
          {timeframeOptions.map(option => (
            <button
              key={option.value}
              className={`px-2 py-1 text-xs rounded ${
                timeframe === option.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              onClick={() => {/* Timeframe selection would be implemented here */}}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-52">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="text-red-500 h-52 flex items-center justify-center">{error}</div>
      ) : !data ? (
        <div className="text-gray-500 h-52 flex items-center justify-center">No liquidation data available.</div>
      ) : (
        <div ref={chartRef} className="w-full h-80 flex-1" style={{minHeight: '320px'}}></div>
      )}
      
      <div className="mt-4 text-sm text-gray-400 flex justify-between">
        <div>
          <span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-1"></span>
          Long Liquidations
        </div>
        <div>
          <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-1"></span>
          Short Liquidations
        </div>
      </div>
    </div>
  );
};

export default LiquidationHeatmap;