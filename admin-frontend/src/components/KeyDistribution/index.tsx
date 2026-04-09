import React, { useState } from 'react';

interface Participant {
  id: number;
  is_leader: boolean;
  is_malicious: boolean;
  is_hbc: boolean;
}

interface KeyDistributionProps {
  participants?: Participant[];
}

const KeyDistribution: React.FC<KeyDistributionProps> = ({ participants: propParticipants }) => {
  const [participants, setParticipants] = useState<Participant[]>([]);

  // 使用传入的参与者数据或默认模拟数据
  React.useEffect(() => {
    if (propParticipants && propParticipants.length > 0) {
      setParticipants(propParticipants);
    } else {
      // 模拟参与者数据
      const mockParticipants: Participant[] = [];
      const totalParticipants = 15;
      const numLeaders = 4;

      for (let i = 1; i <= totalParticipants; i++) {
        mockParticipants.push({
          id: i,
          is_leader: i <= numLeaders,
          is_malicious: i === numLeaders + 1,
          is_hbc: i === numLeaders + 2
        });
      }

      setParticipants(mockParticipants);
    }
  }, [propParticipants]);

  return (
    <div className="participants-grid grid grid-cols-3 sm:grid-cols-4 gap-2">
      {participants.map((participant, index) => {
        let className = 'participant-node aspect-square flex flex-col items-center justify-center rounded-lg transition-all duration-300';
        
        if (participant.is_leader) {
          className += ' bg-[rgba(0,212,255,0.1)] border-2 border-quantum-blue';
        } else if (participant.is_malicious) {
          className += ' bg-[rgba(230,57,70,0.1)] border-2 border-quantum-red';
        } else if (participant.is_hbc) {
          className += ' bg-[rgba(255,183,3,0.1)] border-2 border-quantum-yellow';
        } else {
          className += ' bg-[rgba(255,255,255,0.05)] border-2 border-transparent';
        }

        return (
          <div 
            key={participant.id} 
            className={className}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="node-id font-bold text-sm">P{participant.id}</div>
            <div className="node-status text-xs opacity-80 mt-1">
              {participant.is_leader ? '领导者' : 
               participant.is_malicious ? '恶意' : 
               participant.is_hbc ? '好奇' : '诚实'}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KeyDistribution;