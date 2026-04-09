import React, { useEffect, useState } from 'react';
import { useQKEStore } from '../../store';

const LiveMetrics: React.FC = () => {
  const { statistics } = useQKEStore();
  const [quantumCost, setQuantumCost] = useState(0);
  const [keyRate, setKeyRate] = useState(0);
  const [latency, setLatency] = useState(0);

  useEffect(() => {
    setQuantumCost(statistics.quantum_cost || 0);
    setKeyRate(statistics.key_rate || 0);
    setLatency(statistics.latency || 0);
  }, [statistics]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">实时性能指标</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-sm text-gray-500">量子成本</p>
            <p className="text-2xl font-bold text-blue-600" id="live-quantum-cost">{quantumCost}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">密钥生成率</p>
            <p className="text-2xl font-bold text-green-600" id="live-key-rate">{keyRate}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">延迟</p>
            <p className="text-2xl font-bold text-purple-600" id="live-latency">{latency}ms</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">经典成本</p>
            <p className="text-2xl font-bold text-orange-600" id="live-classical-cost">
              {statistics.classical_cost || 0}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">量子操作详情</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">Pauli操作:</span>
            <span className="text-sm font-mono" id="live-pauli-ops">
              {statistics.pauli_ops || 0}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">位翻转:</span>
            <span className="text-sm font-mono" id="live-bit-flips">
              {statistics.bit_flips || 0}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600">总量子操作:</span>
            <span className="text-sm font-mono" id="live-total-quantum-ops">
              {statistics.total_quantum_ops || 0}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveMetrics;