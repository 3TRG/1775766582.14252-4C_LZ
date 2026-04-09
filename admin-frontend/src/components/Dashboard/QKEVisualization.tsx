import React, { useEffect, useState } from 'react';
import { useQKEStore } from '../../store';
import QuantumCircuit from '../../../components/QuantumCircuit';

interface QKEProcessData {
  currentRound: number;
  totalRounds: number;
  protocolStage: string; // 'qka-leaders', 'qkd-rounds', 'completed', 'failed'
  participants: Array<{
    id: number;
    isLeader: boolean;
    status: string; // 'joined', 'running', 'completed', 'failed'
  }>;
  keyMetrics: {
    entropy: number;
    qber: number;
    keyRate: number;
  };
  rounds: Array<{
    roundNumber: number;
    stateType: string;
    qubitsUsed: number;
    circuitImg?: string;
    status: string; // 'pending', 'running', 'completed', 'failed'
    title?: string;
    description?: string;
  }>;
}

const QKEVisualization: React.FC = () => {
  const { qkeProcess, wsConnected } = useQKEStore();
  const [processData, setProcessData] = useState<QKEProcessData | null>(null);
  const [isVisualizing, setIsVisualizing] = useState(false);

  useEffect(() => {
    if (qkeProcess) {
      setProcessData(qkeProcess);
      setIsVisualizing(true);
    } else {
      setProcessData(null);
      setIsVisualizing(false);
    }
  }, [qkeProcess]);

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

  if (!isVisualizing || !processData) {
    return (
      <div className="p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-blue-800 font-bold mb-2">等待QKE会话开始...</h3>
          <p className="text-blue-600">
            请在用户端发起安全通话，管理端将实时显示QKE协商过程
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 协议状态概览 */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              QKE协商实时可视化
            </h3>
            <p className="text-sm text-gray-500">
              会话ID: {processData.currentRound > 0 ? `QKE-${processData.currentRound}` : '等待中...'}
            </p>
          </div>
          <div className="text-right">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              processData.protocolStage === 'completed'
                ? 'bg-green-100 text-green-800'
                : processData.protocolStage === 'failed'
                ? 'bg-red-100 text-red-800'
                : processData.protocolStage === 'qka-leaders' || processData.protocolStage === 'qkd-rounds'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {processData.protocolStage}
            </span>
          </div>
        </div>

        {/* 协议进度条 */}
        <div className="mt-4">
          <div className="flex items-center mb-2">
            <span className="text-sm font-medium text-gray-700">协商进度:</span>
            <span className="ml-2 text-sm font-mono text-gray-600">
              {processData.currentRound}/{processData.totalRounds}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`bg-blue-600 h-2.5 rounded-full transition-all duration-500`}
              style={{ width: `${(processData.currentRound / Math.max(1, processData.totalRounds)) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* 量子电路可视化 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          量子电路图实时同步
        </h3>
        <QuantumCircuit rounds={processData.rounds} />
      </div>

      {/* 参与者状态 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          参与者状态监控
        </h3>
        <div className="space-y-3">
          {processData.participants.map((p) => (
            <div
              key={p.id}
              className={`flex items-center p-3 rounded-lg ${
                p.isLeader
                  ? 'bg-blue-50 border-blue-200'
                  : p.status === 'completed'
                  ? 'bg-green-50 border-green-200'
                  : p.status === 'failed'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex-1">
                <div className="flex justify-between">
                  <span className="font-medium">
                    参与者 {p.id} {p.isLeader ? '(领导者)' : '(跟随者)'}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    p.status === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : p.status === 'failed'
                      ? 'bg-red-100 text-red-800'
                      : p.status === 'running'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {p.status}
                  </span>
                </div>
              </div>
              <div className="w-16 text-center text-xs font-mono">
                {p.isLeader ? '👑' : '👥'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 关键指标 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          安全指标监控
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-sm text-gray-500">信息熵 (Entropy)</p>
            <p className="text-2xl font-bold text-purple-600">
              {processData.keyMetrics.entropy.toFixed(4)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">误码率 (QBER)</p>
            <p className="text-2xl font-bold text-red-600">
              {(processData.keyMetrics.qber * 100).toFixed(2)}%
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">密钥生成率</p>
            <p className="text-2xl font-bold text-green-600">
              {processData.keyMetrics.keyRate.toFixed(0)} bps
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">安全等级</p>
            <p className="text-2xl font-bold">
              {processData.keyMetrics.qber < 0.11 ? (
                <span className="text-green-600">高安全</span>
              ) : processData.keyMetrics.qber < 0.2 ? (
                <span className="text-yellow-600">中等安全</span>
              ) : (
                <span className="text-red-600">低安全</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QKEVisualization;