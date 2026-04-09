import React, { useEffect, useState } from 'react';
import { useQKEStore } from '../../store';
import LiveMetrics from './LiveMetrics';
import SessionMonitor from './SessionMonitor';
import PerformanceCharts from './PerformanceCharts';
import AlertPanel from './AlertPanel';
import EventTimeline from './EventTimeline';
import QKEVisualization from './QKEVisualization';
import UserList from './UserList';

const Dashboard: React.FC = () => {
  const { users, wsConnected } = useQKEStore();
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    const count = users.filter(user => user.is_online).length;
    setOnlineCount(count);
  }, [users]);

  if (!wsConnected) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-yellow-800 font-bold mb-2">WebSocket 未连接</h3>
          <p className="text-yellow-600">正在尝试连接到管理端实时数据流...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">在线用户</h3>
          <p className="text-4xl font-bold text-blue-600">{onlineCount}</p>
          <p className="text-sm text-gray-500">当前在线</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">总用户数</h3>
          <p className="text-4xl font-bold text-green-600">{users.length}</p>
          <p className="text-sm text-gray-500">已注册用户</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">活跃会话</h3>
          <p className="text-4xl font-bold text-purple-600" id="active-sessions">-</p>
          <p className="text-sm text-gray-500">进行中的QKE会话</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">密钥生成率</h3>
          <p className="text-4xl font-bold text-orange-600" id="key-rate">-</p>
          <p className="text-sm text-gray-500">位/秒</p>
        </div>
      </div>

      {/* 用户列表 */}
      <div className="mt-6">
        <UserList />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <LiveMetrics />
        </div>
        <div className="bg-white rounded-lg shadow">
          <SessionMonitor />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
        <div className="bg-white rounded-lg shadow">
          <PerformanceCharts />
        </div>
        <div className="bg-white rounded-lg shadow">
          <AlertPanel />
        </div>
      </div>

      <div className="mt-6">
        <div className="bg-white rounded-lg shadow">
          <EventTimeline />
        </div>
      </div>

      <div className="mt-6">
        <div className="bg-white rounded-lg shadow">
          <QKEVisualization />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;