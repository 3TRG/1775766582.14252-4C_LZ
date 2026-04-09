import React, { useState, useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import * as api from '../services/api';

interface PerformanceMetrics {
  timestamp: string;
  qke_sessions_count: number;
  active_users_count: number;
  messages_per_minute: number;
  avg_latency_ms: number;
  key_generation_rate: number;
  cpu_usage: number;
  memory_usage: number;
  network_in_mbps: number;
  network_out_mbps: number;
}

const PerformancePage: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');

  const latencyChartRef = useRef<HTMLDivElement>(null);
  const throughputChartRef = useRef<HTMLDivElement>(null);
  const resourceChartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 60000);
    return () => clearInterval(interval);
  }, [timeRange]);

  useEffect(() => {
    if (metrics.length > 0) {
      renderCharts();
    }
  }, [metrics]);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      const response = await api.getPerformanceMetrics(timeRange);
      setMetrics(response.data || []);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderCharts = () => {
    const timestamps = metrics.map(m => new Date(m.timestamp).toLocaleTimeString());

    // Latency Chart
    if (latencyChartRef.current) {
      const chart = echarts.init(latencyChartRef.current);
      chart.setOption({
        title: { text: '延迟趋势', left: 'center' },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: timestamps, axisLabel: { rotate: 45 } },
        yAxis: { type: 'value', name: 'ms' },
        series: [{
          name: '平均延迟',
          type: 'line',
          data: metrics.map(m => m.avg_latency_ms),
          smooth: true,
          areaStyle: { opacity: 0.3 }
        }]
      });
    }

    // Throughput Chart
    if (throughputChartRef.current) {
      const chart = echarts.init(throughputChartRef.current);
      chart.setOption({
        title: { text: '吞吐量趋势', left: 'center' },
        tooltip: { trigger: 'axis' },
        legend: { data: ['消息/分钟', '密钥生成率'], bottom: 0 },
        xAxis: { type: 'category', data: timestamps, axisLabel: { rotate: 45 } },
        yAxis: [
          { type: 'value', name: '消息/分钟' },
          { type: 'value', name: '密钥/秒', position: 'right' }
        ],
        series: [
          {
            name: '消息/分钟',
            type: 'bar',
            data: metrics.map(m => m.messages_per_minute)
          },
          {
            name: '密钥生成率',
            type: 'line',
            yAxisIndex: 1,
            data: metrics.map(m => m.key_generation_rate),
            smooth: true
          }
        ]
      });
    }

    // Resource Chart
    if (resourceChartRef.current) {
      const chart = echarts.init(resourceChartRef.current);
      chart.setOption({
        title: { text: '资源使用', left: 'center' },
        tooltip: { trigger: 'axis' },
        legend: { data: ['CPU', '内存', '网络入', '网络出'], bottom: 0 },
        xAxis: { type: 'category', data: timestamps, axisLabel: { rotate: 45 } },
        yAxis: { type: 'value', name: '%', max: 100 },
        series: [
          {
            name: 'CPU',
            type: 'line',
            data: metrics.map(m => m.cpu_usage),
            smooth: true
          },
          {
            name: '内存',
            type: 'line',
            data: metrics.map(m => m.memory_usage),
            smooth: true
          }
        ]
      });
    }
  };

  const latestMetrics = metrics[metrics.length - 1];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">性能分析</h1>
            <p className="text-gray-600 mt-1">系统性能指标和趋势分析</p>
          </div>
          <div className="flex gap-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="1h">最近1小时</option>
              <option value="6h">最近6小时</option>
              <option value="24h">最近24小时</option>
              <option value="7d">最近7天</option>
            </select>
            <button
              onClick={loadMetrics}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              刷新
            </button>
            <button
              onClick={() => api.exportPerformanceReport(timeRange)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              导出报告
            </button>
          </div>
        </div>

        {/* Current Metrics Cards */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm">QKE会话数</p>
            <p className="text-2xl font-bold text-gray-800">{latestMetrics?.qke_sessions_count || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm">活跃用户</p>
            <p className="text-2xl font-bold text-green-600">{latestMetrics?.active_users_count || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm">平均延迟</p>
            <p className="text-2xl font-bold text-blue-600">{latestMetrics?.avg_latency_ms?.toFixed(0) || 0} ms</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm">消息/分钟</p>
            <p className="text-2xl font-bold text-purple-600">{latestMetrics?.messages_per_minute || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm">密钥生成率</p>
            <p className="text-2xl font-bold text-orange-600">{latestMetrics?.key_generation_rate?.toFixed(1) || 0}/s</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div ref={latencyChartRef} style={{ height: '300px' }} />
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div ref={throughputChartRef} style={{ height: '300px' }} />
          </div>
        </div>
        <div className="mt-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div ref={resourceChartRef} style={{ height: '300px' }} />
          </div>
        </div>

        {/* Resource Usage */}
        {latestMetrics && (
          <div className="mt-6 grid grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">CPU 使用率</h3>
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <span className="text-xs font-semibold inline-block text-blue-600">
                    {latestMetrics.cpu_usage?.toFixed(1)}%
                  </span>
                </div>
                <div className="overflow-hidden h-2 text-xs flex rounded bg-blue-100">
                  <div
                    style={{ width: `${Math.min(latestMetrics.cpu_usage, 100)}%` }}
                    className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                      latestMetrics.cpu_usage > 80 ? 'bg-red-500' : latestMetrics.cpu_usage > 60 ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}
                  />
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="text-lg font-semibold mb-4">内存使用率</h3>
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <span className="text-xs font-semibold inline-block text-green-600">
                    {latestMetrics.memory_usage?.toFixed(1)}%
                  </span>
                </div>
                <div className="overflow-hidden h-2 text-xs flex rounded bg-green-100">
                  <div
                    style={{ width: `${Math.min(latestMetrics.memory_usage, 100)}%` }}
                    className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                      latestMetrics.memory_usage > 80 ? 'bg-red-500' : latestMetrics.memory_usage > 60 ? 'bg-yellow-500' : 'bg-green-500'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PerformancePage;
