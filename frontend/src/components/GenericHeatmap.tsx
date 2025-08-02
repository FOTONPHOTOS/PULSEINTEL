import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface HeatmapData {
  type: string;
  data: {
    x: string[];
    y: string[];
    values: number[][];
  };
}

interface GenericHeatmapProps {
  data: HeatmapData;
  title?: string;
  symbol: string;
}

const GenericHeatmap: React.FC<GenericHeatmapProps> = ({ data, title, symbol }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    
    // Create chart instance if it doesn't exist
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }
    
    // Configure chart based on heatmap type
    let option: any;
    
    if (data.type === 'liquidation') {
      // Liquidation heatmap specific configuration
      option = {
        title: {
          text: title || `${symbol} Liquidation Heatmap`,
          left: 'center',
          textStyle: {
            color: '#888'
          }
        },
        tooltip: {
          position: 'top',
          formatter: function(params: any) {
            return `Time: ${data.data.x[params.data[0]]}<br/>
                    Price: $${data.data.y[params.data[1]]}<br/>
                    Intensity: ${params.data[2]}`;
          }
        },
        grid: {
          height: '70%',
          top: '10%',
          left: '8%',
          right: '8%'
        },
        xAxis: {
          type: 'category',
          data: data.data.x,
          splitArea: {
            show: true
          },
          axisLabel: {
            color: '#888',
            rotate: 45,
            fontSize: 10,
          }
        },
        yAxis: {
          type: 'category',
          data: data.data.y,
          splitArea: {
            show: true
          },
          axisLabel: {
            color: '#888',
            formatter: function(value: string) {
              return `$${parseFloat(value).toLocaleString()}`;
            }
          }
        },
        visualMap: {
          min: 0,
          max: Math.max(...data.data.values.flat().filter(v => v !== undefined)),
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: '5%',
          inRange: {
            color: [
              '#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', 
              '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'
            ]
          },
          textStyle: {
            color: '#888'
          }
        },
        series: [{
          name: 'Liquidation Intensity',
          type: 'heatmap',
          data: data.data.values.map((row, y) => 
            row.map((value, x) => [x, y, value])
          ).flat().filter(item => item[2] !== undefined),
          label: {
            show: false
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }]
      };
    } else {
      // Default/generic heatmap configuration
      option = {
        title: {
          text: title || `${symbol} Heatmap`,
          left: 'center',
          textStyle: {
            color: '#888'
          }
        },
        tooltip: {
          position: 'top',
          formatter: function(params: any) {
            return `X: ${data.data.x[params.data[0]]}<br/>
                    Y: ${data.data.y[params.data[1]]}<br/>
                    Value: ${params.data[2]}`;
          }
        },
        grid: {
          height: '70%',
          top: '10%',
          left: '8%',
          right: '8%'
        },
        xAxis: {
          type: 'category',
          data: data.data.x,
          splitArea: {
            show: true
          },
          axisLabel: {
            color: '#888'
          }
        },
        yAxis: {
          type: 'category',
          data: data.data.y,
          splitArea: {
            show: true
          },
          axisLabel: {
            color: '#888'
          }
        },
        visualMap: {
          min: 0,
          max: Math.max(...data.data.values.flat().filter(v => v !== undefined)),
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: '5%',
          inRange: {
            color: [
              '#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', 
              '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'
            ]
          },
          textStyle: {
            color: '#888'
          }
        },
        series: [{
          name: 'Heatmap',
          type: 'heatmap',
          data: data.data.values.map((row, y) => 
            row.map((value, x) => [x, y, value])
          ).flat().filter(item => item[2] !== undefined),
          label: {
            show: false
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }]
      };
    }
    
    // Apply the chart configuration
    chartInstance.current.setOption(option as any);
    
    // Handle window resize
    const handleResize = () => {
      if (chartInstance.current) {
        chartInstance.current.resize();
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    };
  }, [data, title, symbol]);
  
  return (
    <div className="w-full">
      <div ref={chartRef} className="w-full h-80" style={{ minHeight: '320px' }} />
    </div>
  );
};

export default GenericHeatmap;