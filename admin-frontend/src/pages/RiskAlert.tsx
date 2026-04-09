import React, { useState, useEffect } from 'react';
import { useQKEStore } from '../store';
import * as api from '../services/api';

interface Alert {
  id: number;
  alert_type: 'security' | 'performance' | 'anomaly' | 'system';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  source: string;
  status: 'active' | 'acknowledged' | 'resolved';
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  metadata?: Record<string, any>;
}

const RiskAlertPage: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadAlerts();
    // 设置定时刷新
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const response = await api.getAlerts();
      setAlerts(response.data || []);
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (alertId: number) => {
    try {
      await api.acknowledgeAlert(alertId);
      loadAlerts();
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  const handleResolve = async (alertId: number) => {
    try {
      await api.resolveAlert(alertId);
      loadAlerts();
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const filteredAlerts = alerts.filter(alert => {
    const severityMatch = filterSeverity === 'all' || alert.severity === filterSeverity;
    const statusMatch = filterStatus === 'all' || alert.status === filterStatus;
    return severityMatch && statusMatch;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🔵';
      default: return '⚪';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'security': return '🔒';
      case 'performance': return '⚡';
      case 'anomaly': return '📊';
      case 'system': return '⚙️';
      default: return '📌';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-red-50 text-red-700';
      case 'acknowledged': return 'bg-yellow-50 text-yellow-700';
      case 'resolved': return 'bg-green-50 text-green-700';
      default: return 'bg-gray-50 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">风险告警</h1>
            <p className="text-gray-600 mt-1">监控系统安全风险和异常事件</p>
          </div>
          <div className="flex gap-4">
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部严重级别</option>
              <option value="critical">严重</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部状态</option>
              <option value="active">活动</option>
              <option value="acknowledged">已确认</option>
              <option value="resolved">已解决</option>
            </select>
            <button
              onClick={loadAlerts}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              刷新
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-red-500">
            <p className="text-gray-500 text-sm">活动告警</p>
            <p className="text-2xl font-bold text-red-600">
              {alerts.filter(a => a.status === 'active').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-yellow-500">
            <p className="text-gray-500 text-sm">待处理（严重/高）</p>
            <p className="text-2xl font-bold text-yellow-600">
              {alerts.filter(a => a.status === 'active' && (a.severity === 'critical' || a.severity === 'high')).length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
            <p className="text-gray-500 text-sm">已确认</p>
            <p className="text-2xl font-bold text-blue-600">
              {alerts.filter(a => a.status === 'acknowledged').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border-l-4 border-green-500">
            <p className="text-gray-500 text-sm">今日已解决</p>
            <p className="text-2xl font-bold text-green-600">
              {alerts.filter(a => {
                if (a.status !== 'resolved' || !a.resolved_at) return false;
                const resolvedDate = new Date(a.resolved_at).toDateString();
                return resolvedDate === new Date().toDateString();
              }).length}
            </p>
          </div>
        </div>

        {/* Alerts List */}
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
              加载中...
            </div>
          ) : filteredAlerts.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
              暂无告警数据
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`bg-white rounded-lg shadow border-l-4 ${getSeverityColor(alert.severity)} p-4`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <span className="text-2xl">{getSeverityIcon(alert.severity)}</span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{getTypeIcon(alert.alert_type)}</span>
                        <h3 className="text-lg font-semibold text-gray-800">{alert.title}</h3>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(alert.status)}`}>
                          {alert.status === 'active' ? '活动' : alert.status === 'acknowledged' ? '已确认' : '已解决'}
                        </span>
                      </div>
                      <p className="text-gray-600 mt-1">{alert.description}</p>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                        <span>来源: {alert.source}</span>
                        <span>•</span>
                        <span>{new Date(alert.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {alert.status === 'active' && (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                      >
                        确认
                      </button>
                    )}
                    {(alert.status === 'active' || alert.status === 'acknowledged') && (
                      <button
                        onClick={() => handleResolve(alert.id)}
                        className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        解决
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedAlert(alert)}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      详情
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Modal */}
        {selectedAlert && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl">{getSeverityIcon(selectedAlert.severity)}</span>
                  <h2 className="text-xl font-bold">告警详情</h2>
                </div>
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-gray-500 text-sm">标题</span>
                  <p className="font-medium">{selectedAlert.title}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">描述</span>
                  <p className="text-gray-700">{selectedAlert.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-500 text-sm">类型</span>
                    <p className="font-medium flex items-center">
                      {getTypeIcon(selectedAlert.alert_type)} {selectedAlert.alert_type}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-sm">严重级别</span>
                    <p className="font-medium">{selectedAlert.severity}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-sm">来源</span>
                    <p className="font-medium">{selectedAlert.source}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 text-sm">状态</span>
                    <p className="font-medium">{selectedAlert.status}</p>
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-sm">创建时间</span>
                  <p className="font-medium">{new Date(selectedAlert.created_at).toLocaleString()}</p>
                </div>
                {selectedAlert.metadata && (
                  <div>
                    <span className="text-gray-500 text-sm">元数据</span>
                    <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto">
                      {JSON.stringify(selectedAlert.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
              <div className="mt-6 flex justify-end space-x-2">
                {selectedAlert.status === 'active' && (
                  <button
                    onClick={() => {
                      handleAcknowledge(selectedAlert.id);
                      setSelectedAlert(null);
                    }}
                    className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                  >
                    确认告警
                  </button>
                )}
                <button
                  onClick={() => setSelectedAlert(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RiskAlertPage;
