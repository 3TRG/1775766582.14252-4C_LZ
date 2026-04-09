import React, { useState, useEffect } from 'react';
import { useQKEStore } from '../store';
import * as api from '../services/api';

interface KeyEpoch {
  id: number;
  conversation_id: number;
  epoch_number: number;
  key_fingerprint: string;
  key_length: number;
  entropy: number;
  qber: number;
  status: 'active' | 'expired' | 'revoked';
  created_at: string;
  activated_at?: string;
  expired_at?: string;
  usage_count: number;
}

const KeyManagementPage: React.FC = () => {
  const [keyEpochs, setKeyEpochs] = useState<KeyEpoch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEpoch, setSelectedEpoch] = useState<KeyEpoch | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    loadKeyEpochs();
  }, []);

  const loadKeyEpochs = async () => {
    try {
      setLoading(true);
      const response = await api.getKeyEpochs();
      setKeyEpochs(response.data || []);
    } catch (error) {
      console.error('Failed to load key epochs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEpochs = keyEpochs.filter(epoch =>
    filterStatus === 'all' || epoch.status === filterStatus
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      case 'revoked': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return '激活';
      case 'expired': return '已过期';
      case 'revoked': return '已撤销';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">密钥管理</h1>
            <p className="text-gray-600 mt-1">管理量子密钥的全生命周期</p>
          </div>
          <div className="flex gap-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部状态</option>
              <option value="active">激活</option>
              <option value="expired">已过期</option>
              <option value="revoked">已撤销</option>
            </select>
            <button
              onClick={loadKeyEpochs}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              刷新
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm">总密钥数</p>
            <p className="text-2xl font-bold text-gray-800">{keyEpochs.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm">激活密钥</p>
            <p className="text-2xl font-bold text-green-600">
              {keyEpochs.filter(e => e.status === 'active').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm">已过期</p>
            <p className="text-2xl font-bold text-gray-600">
              {keyEpochs.filter(e => e.status === 'expired').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-gray-500 text-sm">已撤销</p>
            <p className="text-2xl font-bold text-red-600">
              {keyEpochs.filter(e => e.status === 'revoked').length}
            </p>
          </div>
        </div>

        {/* Key Epochs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">加载中...</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Epoch ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    会话ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    密钥指纹
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    长度
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    熵值
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    QBER
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    创建时间
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEpochs.map((epoch) => (
                  <tr key={epoch.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{epoch.epoch_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {epoch.conversation_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                      {epoch.key_fingerprint?.substring(0, 16)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {epoch.key_length} bits
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {epoch.entropy?.toFixed(4)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(epoch.qber * 100)?.toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(epoch.status)}`}>
                        {getStatusText(epoch.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(epoch.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => setSelectedEpoch(epoch)}
                        className="text-blue-600 hover:text-blue-800 mr-2"
                      >
                        详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail Modal */}
        {selectedEpoch && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">密钥详情</h2>
                <button
                  onClick={() => setSelectedEpoch(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">Epoch ID:</span>
                  <span className="font-medium">#{selectedEpoch.epoch_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">会话ID:</span>
                  <span className="font-medium">{selectedEpoch.conversation_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">密钥指纹:</span>
                  <span className="font-mono text-sm">{selectedEpoch.key_fingerprint}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">密钥长度:</span>
                  <span className="font-medium">{selectedEpoch.key_length} bits</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">熵值:</span>
                  <span className="font-medium">{selectedEpoch.entropy?.toFixed(4)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">QBER:</span>
                  <span className="font-medium">{(selectedEpoch.qber * 100)?.toFixed(2)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">使用次数:</span>
                  <span className="font-medium">{selectedEpoch.usage_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">创建时间:</span>
                  <span className="font-medium">{new Date(selectedEpoch.created_at).toLocaleString()}</span>
                </div>
                {selectedEpoch.activated_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">激活时间:</span>
                    <span className="font-medium">{new Date(selectedEpoch.activated_at).toLocaleString()}</span>
                  </div>
                )}
                {selectedEpoch.expired_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">过期时间:</span>
                    <span className="font-medium">{new Date(selectedEpoch.expired_at).toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedEpoch(null)}
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

export default KeyManagementPage;
