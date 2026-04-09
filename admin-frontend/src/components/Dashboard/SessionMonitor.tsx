import React, { useEffect, useState } from 'react';
import { useQKEStore } from '../../store';

interface SessionData {
  session_id: string;
  status: string;
  created_at: string | null;
  completed_at: string | null;
  total_participants: number;
  key_length: number;
  decoy_count: number;
}

const SessionMonitor: React.FC = () => {
  const { adminSessions } = useQKEStore();
  const [sessions, setSessions] = useState<SessionData[]>([]);

  useEffect(() => {
    // 从管理端会话数据中提取会话信息
    // 这里假设adminSessions包含会话列表数据
    if (adminSessions && adminSessions.length > 0) {
      setSessions(adminSessions);
    } else {
      // 如果没有管理端数据，显示一些示例数据或保持空状态
      setSessions([]);
    }
  }, [adminSessions]);

  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">会话监控</h3>
        <div className="text-center py-8">
          <p className="text-gray-500">暂无活跃会话</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">会话监控</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  会话ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  创建时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  参与者
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  密钥长度
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sessions.map((session) => (
                <tr key={session.session_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {session.session_id.substring(0, 12)}...
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                      ${session.status === 'completed' ? 'bg-green-100 text-green-800' :
                        session.status === 'running' ? 'bg-blue-100 text-blue-800' :
                        session.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'}`}>
                      {session.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {session.created_at ? new Date(session.created_at).toLocaleTimeString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {session.total_participants} 人
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {session.key_length} 位
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SessionMonitor;