import React from 'react';
import { useQKEStore } from '../../store';

interface UserListProps {
  className?: string;
}

const UserList: React.FC<UserListProps> = ({ className = '' }) => {
  const { users } = useQKEStore();

  const getStatusBadge = (isOnline: boolean) => {
    return isOnline ? (
      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
        在线
      </span>
    ) : (
      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
        离线
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    const isLeader = role === 'leader';
    return (
      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
        isLeader ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
      }`}>
        {isLeader ? '领导者' : '跟随者'}
      </span>
    );
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      return new Date(isoString).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">所有用户</h3>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <span className="inline-flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
              实时
            </span>
            <span>在线: {users.filter(u => u.is_online).length}</span>
          </div>
        </div>
      </div>

      {users.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-gray-500">暂无用户数据，等待用户注册...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  用户ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  用户名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  角色
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  手机号
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  注册时间
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.user_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {user.user_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium mr-3">
                        {(user.username || 'U').slice(0, 1).toUpperCase()}
                      </div>
                      {user.username || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {getRoleBadge(user.role)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {getStatusBadge(user.is_online)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.phone || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatTime(user.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default UserList;
