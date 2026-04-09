import React, { useEffect, useState } from 'react';
import { useQKEStore } from '../../store';

interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: string;
  details?: any;
  read: boolean;
}

interface AlertFilter {
  showAll: boolean;
  showUnreadOnly: boolean;
  types: {
    info: boolean;
    warning: boolean;
    error: boolean;
    success: boolean;
  };
}

const AlertPanel: React.FC = () => {
  const { events } = useQKEStore();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<AlertFilter>({
    showAll: true,
    showUnreadOnly: false,
    types: {
      info: true,
      warning: true,
      error: true,
      success: true,
    }
  });

  useEffect(() => {
    // 将系统事件转换为警报
    const newAlerts: Alert[] = events
      .filter(event =>
        event.type === 'security' ||
        event.type === 'stats' ||
        (event.type === 'system' && event.level >= 4)
      )
      .map(event => ({
        id: event.id || `alert-${Date.now()}-${Math.random()}`,
        type: getAlertType(event),
        title: getAlertTitle(event),
        message: getAlertMessage(event),
        timestamp: event.timestamp || new Date().toISOString(),
        details: event.details,
        read: false
      }));

    setAlerts(prevAlerts => {
      // 合并新警报和现有警报，避免重复
      const newAlertIds = newAlerts.map(alert => alert.id);
      const existingAlerts = prevAlerts.filter(existing => !newAlertIds.includes(existing.id));
      return [...newAlerts, ...existingAlerts];
    });
  }, [events]);

  // 应用过滤器
  const filteredAlerts = alerts.filter(alert => {
    // 类型过滤
    if (!filter.types[alert.type]) return false;

    // 未读过滤
    if (filter.showUnreadOnly && alert.read) return false;

    return true;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()); // 按时间倒序

  const handleMarkAsRead = (id: string) => {
    setAlerts(prev => prev.map(alert =>
      alert.id === id ? { ...alert, read: true } : alert
    ));
  };

  const handleMarkAllAsRead = () => {
    setAlerts(prev => prev.map(alert => ({ ...alert, read: true })));
  };

  const handleDeleteAlert = (id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  const handleToggleFilter = (type: keyof AlertFilter['types']) => {
    setFilter(prev => ({
      ...prev,
      types: {
        ...prev.types,
        [type]: !prev.types[type]
      }
    }));
  };

  const handleToggleUnreadOnly = () => {
    setFilter(prev => ({
      ...prev,
      showUnreadOnly: !prev.showUnreadOnly
    }));
  };

  if (filteredAlerts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">系统警报</h3>
        <div className="text-center py-8">
          <p className="text-gray-500">暂无警报</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">系统警报</h3>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleMarkAllAsRead}
              className={`text-sm ${filteredAlerts.some(a => !a.read) ? 'text-blue-600 hover:text-blue-800' : 'text-gray-400 hover:text-gray-600'}`}
            >
              标记为已读
            </button>
            <button
              onClick={handleToggleUnreadOnly}
              className={`text-sm ${filter.showUnreadOnly ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              {filter.showUnreadOnly ? '显示全部' : '仅显示未读'}
            </button>
          </div>
        </div>

        {/* 过滤器 */}
        <div className="flex flex-wrap gap-2 mb-4">
          <label className="flex items-center text-sm text-gray-600">
            <input
              type="checkbox"
              checked={filter.types.info}
              onChange={() => handleToggleFilter('info')}
              className="form-checkbox h-4 w-4 text-blue-600"
            />
            信息
          </label>
          <label className="flex items-center text-sm text-gray-600">
            <input
              type="checkbox"
              checked={filter.types.warning}
              onChange={() => handleToggleFilter('warning')}
              className="form-checkbox h-4 w-4 text-yellow-600"
            />
            警告
          </label>
          <label className="flex items-center text-sm text-gray-600">
            <input
              type="checkbox"
              checked={filter.types.error}
              onChange={() => handleToggleFilter('error')}
              className="form-checkbox h-4 w-4 text-red-600"
            />
            错误
          </label>
          <label className="flex items-center text-sm text-gray-600">
            <input
              type="checkbox"
              checked={filter.types.success}
              onChange={() => handleToggleFilter('success')}
              className="form-checkbox h-4 w-4 text-green-600"
            />
            成功
          </label>
        </div>

        <div className="space-y-3">
          {filteredAlerts.slice(0, 10).map((alert) => (
            <div key={alert.id} className={`p-4 rounded-lg border border-t
              ${alert.type === 'info' ? 'border-blue-200' :
                alert.type === 'warning' ? 'border-yellow-200' :
                alert.type === 'error' ? 'border-red-200' :
                'border-green-200'}
              ${alert.read ? 'bg-gray-50' : 'bg-white'}
              hover:bg-gray-100
              transition-colors
              cursor-pointer`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className={`flex-shrink-0 h-3 w-3 rounded-full
                    ${alert.type === 'info' ? 'bg-blue-500' :
                      alert.type === 'warning' ? 'bg-yellow-500' :
                      alert.type === 'error' ? 'bg-red-500' :
                      'bg-green-500'}
                    ${!alert.read ? '' : 'opacity-50'}`}></div>
                  <div>
                    <h4 className={`font-medium ${alert.read ? 'text-gray-600' : 'text-gray-900'} ${!alert.read ? 'font-semibold' : ''}`}>
                      {alert.title}
                    </h4>
                    <p className="mt-1 text-sm text-gray-600">{alert.message}</p>
                    {alert.details && (
                      <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded">
                        {JSON.stringify(alert.details, null, 2)}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {!alert.read && (
                    <button
                      onClick={() => handleMarkAsRead(alert.id)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      标记为已读
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteAlert(alert.id)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    删除
                  </button>
                  <div className="text-xs text-gray-400">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {filteredAlerts.length > 10 && (
            <div className="text-center text-sm text-gray-500 py-3">
              还有 {filteredAlerts.length - 10} 条警报未显示
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 辅助函数：根据事件类型确定警报类型
function getAlertType(event: any): 'info' | 'warning' | 'error' | 'success' {
  if (event.type === 'security') {
    // 根据安全率判断是警告还是错误
    const securityRate = event.details?.securityRate || 100;
    if (securityRate < 70) return 'error';    // 严重安全风险
    if (securityRate < 85) return 'warning';  // 中等安全风险
    return 'success';                         // 良好安全状态
  }

  if (event.type === 'stats') {
    // 根据性能指标判断
    const latency = event.details?.latency || 0;
    const keyRate = event.details?.keyRate || 0;

    if (latency > 500 || keyRate < 10) return 'error';    // 性能严重下降
    if (latency > 200 || keyRate < 50) return 'warning';  // 性能警告
    return 'info';                                        // 性能正常
  }

  // 系统事件根据级别判断
  if (event.level >= 5) return 'error';
  if (event.level >= 4) return 'warning';
  return 'info';
}

// 辅助函数：生成警报标题
function getAlertTitle(event: any): string {
  switch (event.type) {
    case 'security':
      const securityRate = event.details?.securityRate || 100;
      if (securityRate < 70) return '严重安全风险警告';
      if (securityRate < 85) return '安全注意提醒';
      return '安全状态良好';
    case 'stats':
      const latency = event.details?.latency || 0;
      const keyRate = event.details?.keyRate || 0;
      if (latency > 200) return '性能警告：延迟过高';
      if (keyRate < 50) return '性能警告：密钥生成率过低';
      return '性能统计更新';
    default:
      return event.summary || '系统事件';
  }
}

// 辅助函数：生成警报消息
function getAlertMessage(event: any): string {
  switch (event.type) {
    case 'security':
      const securityRate = event.details?.securityRate || 100;
      return `安全检测完成，当前安全率为 ${securityRate}%`;
    case 'stats':
      const keyLength = event.details?.keyLength || 0;
      const keyRate = event.details?.keyRate || 0;
      const latency = event.details?.latency || 0;
      return `生成密钥长度 ${keyLength} 位，延迟 ${latency}ms，密钥生成率 ${keyRate} 位/秒`;
    default:
      return event.details ? JSON.stringify(event.details) : '无详细信息';
  }
}

export default AlertPanel;