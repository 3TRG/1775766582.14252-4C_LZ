import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface StatisticsPanelProps {
  type: 'resource' | 'round' | 'entropy';
  statistics?: any;
  rounds?: any[];
  finalKey?: number[];
}

const StatisticsPanel: React.FC<StatisticsPanelProps> = ({ type, statistics, rounds, finalKey }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = echarts.init(chartRef.current);

    let option: echarts.EChartsOption;

    switch (type) {
      case 'resource':
        // 生成资源消耗数据
        
        option = {
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          title: {
            text: '资源消耗分析',
            textStyle: {
              color: '#00d4ff',
              fontSize: 14
            }
          },
          tooltip: {
            trigger: 'axis',
            axisPointer: {
              type: 'shadow'
            }
          },
          legend: {
            data: ['量子资源', '经典资源 (模拟数据)'],
            textStyle: {
              color: '#ccd6f6'
            }
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
          },
          xAxis: {
            type: 'category',
            data: rounds?.map(round => `轮次 ${round.round_number}`) || ['QKA轮次', 'QKD轮次1', 'QKD轮次2', 'QKD轮次3'],
            axisLabel: {
              color: '#8892b0'
            }
          },
          yAxis: {
            type: 'value',
            axisLabel: {
              color: '#8892b0'
            }
          },
          series: [
            {
              name: '量子资源',
              type: 'bar',
              data: rounds?.map(round => round.qubits_used) || [4, 4, 3, 2],
              itemStyle: {
                color: '#00d4ff'
              }
            },
            {
              name: '经典资源 (模拟数据)',
              type: 'bar',
              data: rounds?.map(() => Math.floor(Math.random() * 10) + 5) || [10, 15, 12, 8],
              itemStyle: {
                color: '#9d4edd'
              }
            }
          ]
        };
        break;

      case 'round':
        // 生成轮次性能数据
        
        option = {
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          title: {
            text: '轮次性能对比',
            textStyle: {
              color: '#00d4ff',
              fontSize: 14
            }
          },
          tooltip: {
            trigger: 'axis'
          },
          legend: {
            data: ['密钥生成率 (模拟数据)', '延迟 (模拟数据)'],
            textStyle: {
              color: '#ccd6f6'
            }
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
          },
          xAxis: {
            type: 'category',
            boundaryGap: false,
            data: rounds?.map(round => `轮次 ${round.round_number}`) || ['QKA轮次', 'QKD轮次1', 'QKD轮次2', 'QKD轮次3'],
            axisLabel: {
              color: '#8892b0'
            }
          },
          yAxis: [
            {
              type: 'value',
              name: '密钥生成率 (bits/s)',
              axisLabel: {
                color: '#8892b0'
              }
            },
            {
              type: 'value',
              name: '延迟 (s)',
              axisLabel: {
                color: '#8892b0'
              }
            }
          ],
          series: [
            {
              name: '密钥生成率 (模拟数据)',
              type: 'line',
              data: rounds?.map(() => Math.floor(Math.random() * 100) + 100) || [120, 190, 150, 180],
              itemStyle: {
                color: '#06ffa5'
              }
            },
            {
              name: '延迟 (模拟数据)',
              type: 'line',
              yAxisIndex: 1,
              data: rounds?.map(() => (Math.random() * 0.2) + 0.1) || [0.2, 0.3, 0.25, 0.35],
              itemStyle: {
                color: '#ffb703'
              }
            }
          ]
        };
        break;

      case 'entropy':
        // 生成密钥熵值数据
        const keyLength = finalKey?.length || 35;
        const entropyData = finalKey 
          ? finalKey.map((_, i) => (i / keyLength) * 0.8 + Math.random() * 0.2)
          : Array.from({ length: keyLength }, () => Math.random()).sort();
        
        option = {
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          title: {
            text: '密钥熵值分析',
            textStyle: {
              color: '#00d4ff',
              fontSize: 14
            }
          },
          tooltip: {
            trigger: 'axis'
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
          },
          xAxis: {
            type: 'category',
            data: Array.from({ length: keyLength }, (_, i) => i + 1),
            axisLabel: {
              color: '#8892b0',
              interval: Math.max(1, Math.floor(keyLength / 10))
            }
          },
          yAxis: {
            type: 'value',
            min: 0,
            max: 1,
            axisLabel: {
              color: '#8892b0'
            }
          },
          series: [
            {
              data: entropyData,
              type: 'line',
              smooth: true,
              itemStyle: {
                color: '#00d4ff'
              },
              areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgba(0, 212, 255, 0.5)' },
                  { offset: 1, color: 'rgba(0, 212, 255, 0.1)' }
                ])
              }
            }
          ]
        };
        break;
    }

    chart.setOption(option);

    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [type, statistics, rounds, finalKey]);

  return (
    <div ref={chartRef} className="chart w-full h-64"></div>
  );
};

export default StatisticsPanel;