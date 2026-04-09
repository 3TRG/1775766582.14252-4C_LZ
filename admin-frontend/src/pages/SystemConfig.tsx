import React, { useState, useEffect } from 'react';
import * as api from '../services/api';

interface SystemConfig {
  qke: {
    default_backend: string;
    default_key_length: number;
    default_decoy_count: number;
    session_timeout_minutes: number;
    max_participants: number;
  };
  security: {
    token_expire_hours: number;
    key_rotation_enabled: boolean;
    key_rotation_interval_hours: number;
  };
  server: {
    host: string;
    port: number;
    debug: boolean;
    workers: number;
  };
  logging: {
    level: string;
    file_path: string;
  };
}

interface LogEntry {
  id: number;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  source: string;
}

const SystemConfigPage: React.FC = () => {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'config' | 'logs' | 'users'>('config');
  const [logFilter, setLogFilter] = useState<string>('all');
  const [editingConfig, setEditingConfig] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [configRes, logsRes] = await Promise.all([
        api.getSystemConfig(),
        api.getSystemLogs()
      ]);
      setConfig(configRes.data);
      setLogs(logsRes.data || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    try {
      await api.updateSystemConfig(config);
      setEditingConfig(false);
      alert('配置已保存');
    } catch (error) {
      console.error('Failed to save config:', error);
      alert('保存失败');
    }
  };

  const filteredLogs = logs.filter(log =>
    logFilter === 'all' || log.level === logFilter
  );

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'bg-red-100 text-red-800';
      case 'WARN': return 'bg-yellow-100 text-yellow-800';
      case 'INFO': return 'bg-blue-100 text-blue-800';
      case 'DEBUG': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">系统管理</h1>
            <p className="text-gray-600 mt-1">系统配置、日志查询和用户管理</p>
          </div>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            刷新
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('config')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'config'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              系统配置
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'logs'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              系统日志
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              用户管理
            </button>
          </nav>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
            加载中...
          </div>
        ) : activeTab === 'config' ? (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold">系统配置</h2>
              <div className="flex gap-2">
                {editingConfig ? (
                  <>
                    <button
                      onClick={() => setEditingConfig(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveConfig}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      保存
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setEditingConfig(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    编辑配置
                  </button>
                )}
              </div>
            </div>

            {config && (
              <div className="space-y-6">
                {/* QKE Configuration */}
                <div>
                  <h3 className="text-md font-semibold text-gray-700 mb-3">QKE 配置</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-500">默认后端</label>
                      {editingConfig ? (
                        <input
                          type="text"
                          value={config.qke.default_backend}
                          onChange={(e) => setConfig({
                            ...config,
                            qke: { ...config.qke, default_backend: e.target.value }
                          })}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      ) : (
                        <p className="mt-1 font-medium">{config.qke.default_backend}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500">默认密钥长度</label>
                      {editingConfig ? (
                        <input
                          type="number"
                          value={config.qke.default_key_length}
                          onChange={(e) => setConfig({
                            ...config,
                            qke: { ...config.qke, default_key_length: parseInt(e.target.value) }
                          })}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      ) : (
                        <p className="mt-1 font-medium">{config.qke.default_key_length} bits</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500">诱饵态数量</label>
                      {editingConfig ? (
                        <input
                          type="number"
                          value={config.qke.default_decoy_count}
                          onChange={(e) => setConfig({
                            ...config,
                            qke: { ...config.qke, default_decoy_count: parseInt(e.target.value) }
                          })}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      ) : (
                        <p className="mt-1 font-medium">{config.qke.default_decoy_count}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500">会话超时（分钟）</label>
                      {editingConfig ? (
                        <input
                          type="number"
                          value={config.qke.session_timeout_minutes}
                          onChange={(e) => setConfig({
                            ...config,
                            qke: { ...config.qke, session_timeout_minutes: parseInt(e.target.value) }
                          })}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      ) : (
                        <p className="mt-1 font-medium">{config.qke.session_timeout_minutes} 分钟</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Security Configuration */}
                <div>
                  <h3 className="text-md font-semibold text-gray-700 mb-3">安全配置</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-500">Token 过期时间</label>
                      {editingConfig ? (
                        <input
                          type="number"
                          value={config.security.token_expire_hours}
                          onChange={(e) => setConfig({
                            ...config,
                            security: { ...config.security, token_expire_hours: parseInt(e.target.value) }
                          })}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg"
                        />
                      ) : (
                        <p className="mt-1 font-medium">{config.security.token_expire_hours} 小时</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500">密钥轮换</label>
                      {editingConfig ? (
                        <select
                          value={config.security.key_rotation_enabled ? 'true' : 'false'}
                          onChange={(e) => setConfig({
                            ...config,
                            security: { ...config.security, key_rotation_enabled: e.target.value === 'true' }
                          })}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg"
                        >
                          <option value="true">启用</option>
                          <option value="false">禁用</option>
                        </select>
                      ) : (
                        <p className="mt-1 font-medium">{config.security.key_rotation_enabled ? '已启用' : '已禁用'}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'logs' ? (
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold">系统日志</h2>
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="all">全部级别</option>
                <option value="ERROR">ERROR</option>
                <option value="WARN">WARN</option>
                <option value="INFO">INFO</option>
                <option value="DEBUG">DEBUG</option>
              </select>
            </div>
            <div className="p-4 max-h-[600px] overflow-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">级别</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">来源</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">消息</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getLogLevelColor(log.level)}`}>
                          {log.level}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {log.source}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700 font-mono text-xs">
                        {log.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">用户管理</h2>
            <p className="text-gray-500">用户管理功能正在开发中...</p>
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                计划功能：
              </p>
              <ul className="mt-2 text-sm text-gray-600 list-disc list-inside">
                <li>用户列表和搜索</li>
                <li>用户权限管理</li>
                <li>在线状态监控</li>
                <li>会话管理</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemConfigPage;
