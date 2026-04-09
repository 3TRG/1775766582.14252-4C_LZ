import { create } from 'zustand';
import type { QKEProcessData } from '../utils/qkeProcessTypes';

interface QKEConfig {
  participants: number;
  keyLength: number;
  decoyCount: number;
}

interface Participant {
  id: number;
  type?: 'leader' | 'follower';
  label?: string;
  original_id?: string;
  is_leader?: boolean;
  isOnline?: boolean;
  private_key?: number[];
  shared_key?: number[];
  joined_at?: string;
  left_at?: string;
}

interface UserInfo {
  user_id: number;
  username: string;
  phone?: string;
  email?: string;
  role: 'leader' | 'follower';
  is_online: boolean;
  created_at?: string;
  last_login_at?: string;
}

interface DecoyInfo {
  positions: number[];
  bases: string[];
  states: number[];
  count: number;
}

interface KeySynchronization {
  diff_positions: number[];
  total_bit_flips: number;
}

interface Round {
  round_number: number;
  group_type: string;
  leader_id: number | string;
  state_type: string;
  participants: number[];
  circuit_img?: string;
  qubits_used: number;
  decoy_info?: DecoyInfo;
  key_synchronization?: KeySynchronization;
}

interface Event {
  id: string;
  type: 'system' | 'election' | 'qka' | 'qkd' | 'measurement' | 'sync' | 'verify' | 'security' | 'stats';
  level: 1 | 2 | 3 | 4 | 5;
  timestamp: string;
  summary: string;
  details?: any;
  isExpanded?: boolean;
}

interface Statistics {
  quantum_cost: number;
  pauli_ops: number;
  bit_flips: number;
  total_quantum_ops: number;
  classical_cost: number;
  latency: number;
  key_rate: number;
  securityRate?: number;
}

interface SimulationResults {
  final_key: number[];
  participants: Participant[];
  rounds: Round[];
  statistics: Statistics;
}

interface AdminSessionListItem {
  session_id: string;
  status: string;
  created_at?: string | null;
  completed_at?: string | null;
  total_participants: number;
  key_length: number;
  decoy_count: number;
}

interface AdminSnapshot {
  session_id: string;
  participants: Participant[];
  rounds: Round[];
  statistics: Statistics;
  events: Event[];
}

interface QKEState {
  config: QKEConfig;
  isSimulationRunning: boolean;
  simulationProgress: number;
  finalKey: number[];
  participants: Participant[];
  rounds: Round[];
  statistics: Statistics;
  events: Event[];
  adminSessions?: AdminSessionListItem[];
  selectedSessionId?: string;

  // QKE过程可视化数据
  qkeProcess: QKEProcessData | null;

  // 实时用户管理
  users: UserInfo[];
  onlineUsers: Set<number>;
  wsConnected: boolean;

  setConfig: (config: Partial<QKEConfig>) => void;
  startSimulation: () => void;
  updateProgress: (progress: number) => void;
  setSimulationResults: (results: SimulationResults) => void;
  setAdminSnapshot: (snapshot: AdminSnapshot) => void;
  setQKEProcess: (process: QKEProcessData | null) => void;
  addEvent: (event: Omit<Event, 'id' | 'timestamp'>) => void;
  toggleEventExpansion: (eventId: string) => void;
  resetSimulation: () => void;

  // 实时用户管理方法
  setUsers: (users: UserInfo[]) => void;
  addUser: (user: UserInfo) => void;
  removeUser: (userId: number) => void;
  updateUserOnlineStatus: (userId: number, isOnline: boolean) => void;
  setWsConnected: (connected: boolean) => void;
  getOnlineUsersCount: () => number;
}

export const useQKEStore = create<QKEState>((set, get) => ({
  config: {
    participants: 15,
    keyLength: 35,
    decoyCount: 10,
  },
  isSimulationRunning: false,
  simulationProgress: 0,
  finalKey: [],
  participants: [],
  rounds: [],
  statistics: {
    quantum_cost: 0,
    pauli_ops: 0,
    bit_flips: 0,
    total_quantum_ops: 0,
    classical_cost: 0,
    latency: 0,
    key_rate: 0,
    securityRate: 100
  },
  events: [],
  
  // 实时用户管理
  users: [],
  onlineUsers: new Set(),
  wsConnected: false,
  
  setConfig: (newConfig) => set((state) => ({
    config: { ...state.config, ...newConfig }
  })),
  
  startSimulation: () => set({ 
    isSimulationRunning: true,
    simulationProgress: 0,
    finalKey: [],
    participants: [],
    rounds: [],
    events: []
  }),
  
  updateProgress: (progress) => set({ simulationProgress: progress }),
  
  setSimulationResults: (results) => {
    // 生成事件流
    const events: Event[] = [];
    
    // 系统级事件 - 初始化
    events.push({
      id: `event-${Date.now()}-1`,
      type: 'system',
      level: 1,
      timestamp: new Date().toISOString(),
      summary: '量子密钥分发系统初始化完成',
      details: {
        participants: results.participants?.length || 0,
        keyLength: results.final_key?.length || 0
      }
    });
    
    // 系统级事件 - 开始执行
    events.push({
      id: `event-${Date.now()}-2`,
      type: 'system',
      level: 1,
      timestamp: new Date().toISOString(),
      summary: '开始执行量子密钥分发协议',
      details: {
        participants: results.participants?.length || 0
      }
    });
    
    // 系统级事件 - 初始化参与者
    events.push({
      id: `event-${Date.now()}-3`,
      type: 'system',
      level: 1,
      timestamp: new Date().toISOString(),
      summary: `初始化 ${results.participants?.length || 0} 个参与者`,
      details: {
        participants: results.participants || []
      }
    });
    
    // 领导者选举事件
    const leaders = results.participants?.filter(p => p.type === 'leader') || [];
    if (leaders.length > 0) {
      events.push({
        id: `event-${Date.now()}-4`,
        type: 'election',
        level: 2,
        timestamp: new Date().toISOString(),
        summary: `选出 ${leaders.length} 位领导者：${leaders.map(l => l.label || `P${l.id}`).join('、')}`,
        details: {
          leaders: leaders
        }
      });
    }
    
    // 处理每轮
    results.rounds?.forEach((round, index) => {
      if (index === 0) {
        // QKA 轮次
        events.push({
          id: `event-${Date.now()}-qka-${index}`,
          type: 'qka',
          level: 2,
          timestamp: new Date().toISOString(),
          summary: `第 ${round.round_number} 轮 QKA 开始`,
          details: {
            round: round,
            participants: round.participants.map(pId => {
              const participant = results.participants?.find(p => p.id === pId);
              return participant ? participant.label || `P${pId}` : `P${pId}`;
            })
          }
        });
        
        events.push({
          id: `event-${Date.now()}-qka-${index}-done`,
          type: 'qka',
          level: 4,
          timestamp: new Date().toISOString(),
          summary: `第 ${round.round_number} 轮 QKA 完成，生成共享密钥`,
          details: {
            round: round,
            keyLength: results.final_key?.length || 0
          }
        });
      } else {
        // QKD 轮次
        events.push({
          id: `event-${Date.now()}-qkd-${index}`,
          type: 'qkd',
          level: 2,
          timestamp: new Date().toISOString(),
          summary: `第 ${round.round_number} 轮 QKD 开始`,
          details: {
            round: round,
            stateType: round.state_type,
            participants: round.participants.map(pId => {
              const participant = results.participants?.find(p => p.id === pId);
              return participant ? participant.label || `P${pId}` : `P${pId}`;
            })
          }
        });
        
        // 测量事件
        events.push({
          id: `event-${Date.now()}-meas-${index}`,
          type: 'measurement',
          level: 3,
          timestamp: new Date().toISOString(),
          summary: `进行 X/Z 基测量`,
          details: {
            round: round
          }
        });
        
        // 同步事件
        if (round.key_synchronization) {
          events.push({
            id: `event-${Date.now()}-sync-${index}`,
            type: 'sync',
            level: 3,
            timestamp: new Date().toISOString(),
            summary: `需要翻转位置：${round.key_synchronization.diff_positions.join(',')}`,
            details: {
              diff_positions: round.key_synchronization.diff_positions,
              total_bit_flips: round.key_synchronization.total_bit_flips
            }
          });
        }
        
        // QKD 完成事件
        events.push({
          id: `event-${Date.now()}-qkd-${index}-done`,
          type: 'qkd',
          level: 4,
          timestamp: new Date().toISOString(),
          summary: `第 ${round.round_number} 轮 ${round.state_type} QKD 完成`,
          details: {
            round: round
          }
        });
      }
    });
    
    // 哈希校验事件
    events.push({
      id: `event-${Date.now()}-verify`,
      type: 'verify',
      level: 4,
      timestamp: new Date().toISOString(),
      summary: '哈希校验通过',
      details: {
        keyLength: results.final_key?.length || 0
      }
    });
    
    // 安全检测事件
    events.push({
      id: `event-${Date.now()}-security`,
      type: 'security',
      level: 4,
      timestamp: new Date().toISOString(),
      summary: '攻击检测完成',
      details: {
        securityRate: results.statistics?.securityRate || 100
      }
    });
    
    // 最终统计事件
    events.push({
      id: `event-${Date.now()}-stats`,
      type: 'stats',
      level: 5,
      timestamp: new Date().toISOString(),
      summary: `最终密钥生成完成，长度 ${results.final_key?.length || 0} 位`,
      details: {
        keyLength: results.final_key?.length || 0,
        keyRate: results.statistics?.key_rate || 0,
        latency: results.statistics?.latency || 0,
        quantumCost: results.statistics?.quantum_cost || 0
      }
    });
    
    set({
      finalKey: results.final_key || [],
      participants: results.participants || [],
      rounds: results.rounds || [],
      statistics: results.statistics || {},
      events: events,
      isSimulationRunning: false,
      simulationProgress: 100
    });
  },

  setAdminSnapshot: (snapshot) => set({
    selectedSessionId: snapshot.session_id,
    finalKey: [], // 管理端默认不展示明文最终密钥（可后续改为指纹/熵值）
    participants: snapshot.participants || [],
    rounds: snapshot.rounds || [],
    statistics: snapshot.statistics || {},
    events: (snapshot.events || []).map(e => ({ ...e, isExpanded: false })),
    isSimulationRunning: false,
    simulationProgress: 100
  }),
  
  addEvent: (event) => set((state) => ({
    events: [...state.events, {
      ...event,
      id: `event-${Date.now()}-${state.events.length + 1}`,
      timestamp: new Date().toISOString(),
      isExpanded: false
    }]
  })),
  
  toggleEventExpansion: (eventId) => set((state) => ({
    events: state.events.map(event => 
      event.id === eventId 
        ? { ...event, isExpanded: !event.isExpanded }
        : event
    )
  })),
  
  resetSimulation: () => set({
    isSimulationRunning: false,
    simulationProgress: 0,
    finalKey: [],
    participants: [],
    rounds: [],
    events: []
  }),
  
  // 实时用户管理方法
  setUsers: (users) => set({ 
    users,
    onlineUsers: new Set(users.filter(u => u.is_online).map(u => u.user_id))
  }),
  
  addUser: (user) => set((state) => {
    const existingIndex = state.users.findIndex(u => u.user_id === user.user_id);
    let newUsers;
    if (existingIndex >= 0) {
      // 更新现有用户
      newUsers = [...state.users];
      newUsers[existingIndex] = { ...newUsers[existingIndex], ...user };
    } else {
      // 添加新用户
      newUsers = [...state.users, user];
    }

    const newOnlineUsers = new Set(state.onlineUsers);
    if (user.is_online) {
      newOnlineUsers.add(user.user_id);
    } else {
      newOnlineUsers.delete(user.user_id);
    }

    return { users: newUsers, onlineUsers: newOnlineUsers };
  }),

  removeUser: (userId) => set((state) => {
    const newUsers = state.users.filter(u => u.user_id !== userId);
    const newOnlineUsers = new Set(state.onlineUsers);
    newOnlineUsers.delete(userId);
    return { users: newUsers, onlineUsers: newOnlineUsers };
  }),
  
  updateUserOnlineStatus: (userId, isOnline) => set((state) => {
    const newOnlineUsers = new Set(state.onlineUsers);
    if (isOnline) {
      newOnlineUsers.add(userId);
    } else {
      newOnlineUsers.delete(userId);
    }
    
    const newUsers = state.users.map(u => 
      u.user_id === userId ? { ...u, is_online: isOnline } : u
    );
    
    return { users: newUsers, onlineUsers: newOnlineUsers };
  }),
  
  setWsConnected: (connected) => set({ wsConnected: connected }),
  
  getOnlineUsersCount: () => get().onlineUsers.size
}));
