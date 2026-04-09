/**
 * Admin Frontend TypeScript Type Definitions
 * 为所有 API 响应和组件 props 提供类型安全
 */

// ==================== 用户相关类型 ====================

export interface User {
  user_id: number;
  username: string;
  phone: string;
  email: string;
  role: 'leader' | 'follower';
  is_online: boolean;
  created_at: string;
}

// ==================== QKE 会话相关类型 ====================

export interface QKESession {
  session_id: string;
  status: 'created' | 'running' | 'completed' | 'failed';
  created_at: string | null;
  completed_at: string | null;
  total_participants: number;
  key_length: number;
  decoy_count: number;
  conversation_id?: number;
  trigger_type?: string;
  scene_type?: string;
  protocol_name?: string;
  participant_count?: number;
  leader_count?: number;
  entropy?: number;
  qber?: number;
  key_rate?: number;
  latency_ms?: number;
}

export interface QKESessionDetail {
  session: QKESession;
  members: QKESessionMember[];
  rounds: QKERound[];
  events: QKEEvent[];
}

// ==================== 参与者相关类型 ====================

export interface QKESessionMember {
  id: number;
  user_id: number;
  qke_session_id: number;
  logical_role: 'leader' | 'follower';
  threat_role: 'normal' | 'malicious' | 'hbc';
  participant_order?: number;
  private_key_digest?: string;
  shared_key_digest?: string;
  is_leader: boolean;
  status: string;
  joined_at: string;
  completed_at?: string;
}

// ==================== 轮次相关类型 ====================

export interface QKERound {
  id: number;
  qke_session_id: number;
  round_number: number;
  group_type: string;
  state_type: string;
  leader_user_id?: number;
  participants: number[];
  qubits_used: number;
  decoy_positions?: number[];
  decoy_bases?: string[];
  decoy_states?: string[];
  decoy_error_rate?: number;
  diff_positions: number[];
  total_bit_flips: number;
  round_latency_ms: number;
  round_status: string;
  started_at: string;
  finished_at?: string;
  key_synchronization?: {
    diff_positions: number[];
    total_bit_flips: number;
  };
}

// ==================== 事件相关类型 ====================

export type EventSeverity = 'info' | 'warn' | 'error' | 'success';
export type EventType = 'session_created' | 'protocol_start' | 'protocol_completed' | 'protocol_failed' | 'key_derived' | 'round_start' | 'round_complete' | 'error' | 'system';

export interface QKEEvent {
  id: number;
  qke_session_id: number;
  conversation_id?: number;
  round_number?: number;
  event_type: EventType;
  event_stage: string;
  severity: EventSeverity;
  title: string;
  detail_json?: string;
  event_time: string;
  actor_user_id?: number;
  payload?: Record<string, unknown>;
}

export interface TimelineEvent {
  id: string;
  type: EventType;
  level: EventSeverity;
  title: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

// ==================== 统计相关类型 ====================

export interface QKEStatistics {
  total_sessions: number;
  active_sessions: number;
  completed_sessions: number;
  failed_sessions: number;
  total_keys_generated: number;
  average_entropy: number;
  average_qber: number;
  average_latency_ms: number;
}

export interface ResourceUsage {
  round_number: number;
  qubits_used: number;
  classical_cost: number;
  quantum_cost: number;
}

// ==================== 告警相关类型 ====================

export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
  is_read?: boolean;
}

// ==================== WebSocket 消息类型 ====================

export interface WSMessage {
  type: string;
  data: unknown;
}

export interface QKEEventMessage {
  type: 'qke_event';
  data: {
    session_id: number;
    conversation_id?: number;
    event_type: EventType;
    event_stage: string;
    title: string;
    description: string;
    severity: EventSeverity;
    payload?: Record<string, unknown>;
    timestamp: string;
  };
}

// ==================== 组件 Props 类型 ====================

export interface EventTimelineProps {
  events: TimelineEvent[];
  maxItems?: number;
}

export interface AlertPanelProps {
  events: QKEEvent[];
  maxItems?: number;
}

export interface StatisticsPanelProps {
  statistics: QKEStatistics;
  rounds: QKERound[];
}

export interface LiveMetricsProps {
  sessions: QKESession[];
  events: QKEEvent[];
}

// ==================== 仪表盘快照类型 ====================

export interface AdminSnapshot {
  sessions: QKESession[];
  users: User[];
  selectedSessionId: string | null;
  sessionDetail: QKESessionDetail | null;
  events: QKEEvent[];
  rounds: QKERound[];
  participants: QKESessionMember[];
  statistics: QKEStatistics;
  lastUpdated: string;
}
