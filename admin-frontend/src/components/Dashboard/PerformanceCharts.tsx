import React, { useEffect, useState } from 'react';
import { useQKEStore } from '../../store';

const PerformanceCharts: React.FC = () => {
  const { statistics, events } = useQKEStore();
  const [chartData, setChartData] = useState<Array<{ name: string; value: number }>>([]);

  useEffect(() => {
    // 从统计数据和事件中提取性能趋势数据
    const data = [
      { name: '量子成本', value: statistics.quantum_cost || 0 },
      { name: '经典成本', value: statistics.classical_cost || 0 },
      { name: '延迟(ms)', value: statistics.latency || 0 },
      { name: '密钥率', value: statistics.key_rate || 0 },
      { name: '安全率', value: statistics.securityRate || 100 }
    ];
    setChartData(data);
  }, [statistics]);

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">性能趋势图表</h3>
        <div className="text-center py-8">
          <p className="text-gray-500">暂无性能数据</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">性能趋势图表</h3>
        <div className="space-y-3">
          {chartData.map((item, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: getColorForMetric(item.name)
                  }}></div>
                <span className="text-sm font-medium text-gray-700">{item.name}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-mono text-gray-600">
                  {getFormattedValue(item.name, item.value)}
                </span>
              </div>
              <div className="w-1/2 bg-gray-200 rounded-full h-2.5">
                <div className="bg-blue-500 h-2.5 rounded-full"
                  style={{ width: getPercentageForMetric(item.name, item.value) }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 辅助函数：根据指标名称返回颜色
function getColorForMetric(name: string): string {
  const colors: Record<string, string> = {
    '量子成本': '#3b82f6', // blue
    '经典成本': '#10b981', // green
    '延迟(ms)': '#f59e0b', // amber
    '密钥率': '#8b5cf6', // violet
    '安全率': '#ef4444' // red
  };
  return colors[name] || '#6b7280'; // gray
}

// 辅助函数：格式化数值显示
function getFormattedValue(name: string, value: number): string {
  if (name === '延迟(ms)') return `${value.toFixed(1)}`;
  if (name === '密钥率') return `${value.toFixed(0)}`;
  if (name === '安全率') return `${value.toFixed(1)}%`;
  return value.toFixed(0);
}

// 辅助函数：计算百分比用于进度条显示
function getPercentageForMetric(name: string, value: number): string {
  const maxValues: Record<string, number> = {
    '量子成本': 1000,
    '经典成本': 1000,
    '延迟(ms)': 1000,
    '密钥率': 10000,
    '安全率': 100
  };

  const max = maxValues[name] || 100;
  const percentage = Math.min((value / max) * 100, 100);
  return `${percentage}%`;
}

export default PerformanceCharts;