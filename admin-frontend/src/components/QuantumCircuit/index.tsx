import React, { useState } from 'react';

interface CircuitRound {
  round_number: number;
  state_type: string;
  qubits_used: number;
  circuit_img?: string;
  measurement_basis?: string[];
}

interface QuantumCircuitProps {
  rounds?: CircuitRound[];
}

const QuantumCircuit: React.FC<QuantumCircuitProps> = ({ rounds: propRounds }) => {
  const [activeRound, setActiveRound] = useState<number>(0);

  // 使用传入的轮次数据或默认模拟数据
  const rounds: CircuitRound[] = propRounds && propRounds.length > 0 ? propRounds : [
    {
      round_number: 1,
      state_type: 'GHZ-4',
      qubits_used: 4,
      circuit_img: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=quantum%20circuit%20ghz%20state%204%20qubits&size=1024x768'
    },
    {
      round_number: 2,
      state_type: 'GHZ-3',
      qubits_used: 3,
      circuit_img: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=quantum%20circuit%20ghz%20state%203%20qubits&size=1024x768'
    },
    {
      round_number: 3,
      state_type: 'Bell',
      qubits_used: 2,
      circuit_img: 'https://neeko-copilot.bytedance.net/api/text2image?prompt=quantum%20circuit%20bell%20state&size=1024x768'
    }
  ];

  return (
    <div className="circuit-display bg-[rgba(0,0,0,0.3)] rounded-lg min-h-[450px] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="circuit-wrapper w-full max-w-md">
        {rounds[activeRound].circuit_img ? (
          <img 
            src={rounds[activeRound].circuit_img} 
            alt={`Quantum Circuit - ${rounds[activeRound].state_type}`} 
            className="circuit-image w-full max-h-80 object-contain bg-white p-3 rounded-lg shadow-lg"
          />
        ) : (
          <div className="w-full max-h-80 bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.12)] rounded-lg p-6 text-center text-gray-300">
            <div className="text-sm">本轮未生成电路图（可后端按需生成）</div>
            <div className="text-xs text-gray-500 mt-2">Round {rounds[activeRound].round_number} · {rounds[activeRound].state_type}</div>
          </div>
        )}
        <div className="circuit-info flex flex-wrap gap-3 mt-4 justify-center">
          <span className="circuit-badge bg-quantum-blue text-white px-4 py-1.5 rounded-full text-sm font-semibold">
            {rounds[activeRound].state_type}
          </span>
          <span className="circuit-qubits bg-[rgba(0,212,255,0.1)] text-quantum-blue px-4 py-1.5 rounded-full text-sm font-mono">
            {rounds[activeRound].qubits_used} Qubits
          </span>
        </div>
      </div>

      {/* 轮次选择器 */}
      {rounds.length > 1 && (
        <div className="round-selector mt-6 w-full max-w-md p-4 bg-[rgba(255,255,255,0.05)] rounded-xl border border-quantum-border">
          <h4 className="text-quantum-blue text-sm mb-3">选择轮次查看电路图：</h4>
          <div className="round-buttons flex flex-wrap gap-2">
            {rounds.map((round, idx) => (
              <button 
                key={round.round_number}
                className={`round-btn px-3 py-2 rounded-lg text-sm transition-colors ${idx === activeRound ? 'bg-quantum-blue text-white' : 'bg-[rgba(255,255,255,0.1)] text-gray-300 hover:bg-[rgba(0,212,255,0.2)] hover:text-quantum-blue'}`}
                onClick={() => setActiveRound(idx)}
                data-round={idx}
              >
                Round {round.round_number}: {round.state_type}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuantumCircuit;