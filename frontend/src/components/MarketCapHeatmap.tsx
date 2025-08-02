import React, { useRef, useEffect, useState } from 'react';
import * as echarts from 'echarts';
import type { MarketCapHeatmapData } from '../types';

interface MarketCapHeatmapProps {
  data: MarketCapHeatmapData;
}

const MarketCapHeatmap: React.FC<MarketCapHeatmapProps> = ({ data }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(0);

  useEffect(() => {
    if (!chartRef.current || !data || !data.tokens || data.tokens.length === 0) {
      return;
    }

    setLoading(false);

    // Format data for treemap
    const processedData = data.sectors.map(sector => {
      const sectorTokens = data.tokens.filter(token => token.sector === sector);
      
      return {
        name: sector,
        value: sectorTokens.reduce((sum, token) => sum + token.marketCap, 0),
        children: sectorTokens.map(token => ({
          name: token.symbol,
          value: token.marketCap,
          change: token.change24h,
          price: token.price,
          fullName: token.name
        }))
      };
    }).filter(sector => sector.children.length > 0);

    const timer = setTimeout(() => {
      if (chartRef.current) {
        // Dispose previous chart instance if it exists
        if (chartInstance.current) {
          chartInstance.current.dispose();
        }
        
        // Create new chart instance
        chartInstance.current = echarts.init(chartRef.current);
        
        const option = {
          title: {
            text: 'Crypto Market Cap',
            left: 'center',
            textStyle: {
              color: '#eee'
            }
          },
          tooltip: {
            formatter: (info: any) => {
              const value = info.value;
              const change = info.data.change;
              const price = info.data.price;
              const name = info.data.fullName || info.name;
              
              if (!info.data.price) {
                // This is a sector
                return `<div>
                  <div style="font-weight: bold; margin-bottom: 3px;">${name} Sector</div>
                  <div>Market Cap: $${(value / 1e9).toFixed(2)}B</div>
                </div>`;
              }
              
              // Format for tokens
              return `<div>
                <div style="font-weight: bold; margin-bottom: 3px;">${name} (${info.name})</div>
                <div>Price: $${price < 1 ? price.toFixed(4) : price.toLocaleString()}</div>
                <div>Market Cap: $${(value / 1e9).toFixed(2)}B</div>
                <div style="color: ${change >= 0 ? '#4ade80' : '#f87171'}">
                  24h Change: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%
                </div>
              </div>`;
            }
          },
          series: [{
            name: 'Market Cap',
            type: 'treemap',
            data: processedData,
            width: '100%',
            height: '100%',
            roam: false,
            nodeClick: 'link',
            breadcrumb: {
              show: false
            },
            label: {
              show: true,
              formatter: '{b}\n${c0}B',
              fontSize: 12,
              color: '#fff'
            },
            upperLabel: {
              show: true,
              height: 30,
              color: '#fff',
              backgroundColor: 'rgba(0,0,0,0.4)',
              formatter: function (params: any) {
                // Show symbol and change
                const change = params.data.change;
                if (change === undefined) return params.name;
                
                return [
                  `{name|${params.name}}`,
                  `{change|${change >= 0 ? '+' : ''}${change.toFixed(2)}%}`
                ].join('\n');
              },
              rich: {
                name: {
                  color: '#fff',
                  fontSize: 12
                },
                change: {
                  fontSize: 10,
                  color: function (params: any) {
                    // Determine color based on 24h change
                    if (params.value >= 0) {
                      return '#4ade80';
                    } else {
                      return '#f87171';
                    }
                  }
                }
              }
            },
            levels: [
              {
                itemStyle: {
                  borderColor: '#333',
                  borderWidth: 2,
                  gapWidth: 2
                }
              },
              {
                colorSaturation: [0.3, 0.7],
                itemStyle: {
                  borderColorSaturation: 0.6,
                  gapWidth: 1,
                  borderWidth: 1
                }
              }
            ],
            visualMap: {
              show: true,
              min: -10,
              max: 10,
              dimension: 2, // The third dimension is the value change
              inRange: {
                color: ['#f87171', '#e4e4e7', '#4ade80']
              },
              textStyle: {
                color: '#fff'
              },
              left: 'center',
              bottom: '5%'
            },
            // Format data for treemap
            visualDimension: 2, // Use 24h change for coloring
            itemStyle: {
              borderColor: '#222',
              borderWidth: 1
            }
          }]
        };
        
        chartInstance.current.setOption(option);
        chartInstance.current.resize();
      }
    }, 200);
    
    return () => clearTimeout(timer);
  }, [data]);

  // Handle window resize
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

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="font-bold text-xl">Market Cap Heatmap</h3>
        <p className="text-sm text-gray-400">Size: Market Cap • Color: 24h Change</p>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-[600px]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div 
          ref={chartRef} 
          className="w-full" 
          style={{ height: '600px' }}
        ></div>
      )}
    </div>
  );
};

export default MarketCapHeatmap;