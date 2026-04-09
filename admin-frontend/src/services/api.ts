/**
 * 管理前端 HTTP API 服务层
 *
 * 替代 App.tsx 中的内联 fetch 调用，统一错误处理和 baseURL 配置。
 * 所有数据从后端真实接口获取，不使用 mock 数据。
 */

import type {
  User,
  QKESession,
  QKESessionDetail,
  QKESessionMember,
  QKERound,
  QKEEvent
} from '../types';

const BASE = (() => {
  // 开发环境可用 VITE_API_BASE 覆盖，默认同域相对路径
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;
  return '';
})();

export async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} 失败: ${res.status}`);
  return res.json() as Promise<T>;
}

/**
 * 获取所有 QKE 会话列表
 * 对应后端 API: GET /api/v1/admin/qke/sessions
 */
export async function listAdminSessions(): Promise<QKESession[]> {
  return get<QKESession[]>('/api/v1/admin/qke/sessions');
}

/**
 * 获取单个 QKE 会话详情
 * 对应后端 API: GET /api/v1/admin/qke/sessions/{id}
 */
export async function getAdminSessionDetail(sessionId: string): Promise<QKESessionDetail> {
  return get<QKESessionDetail>(`/api/v1/admin/qke/sessions/${sessionId}`);
}

/**
 * 获取系统用户列表
 * 对应后端 API: GET /api/v1/admin/users
 */
export async function getAllUsers(): Promise<User[]> {
  try {
    const res = await fetch(`${BASE}/api/v1/admin/users`);
    if (!res.ok) {
      console.warn('[API] 获取用户列表失败:', res.status, res.statusText);
      return [];
    }
    const data = await res.json() as { users?: User[] };
    return data.users ?? [];
  } catch (e) {
    console.warn('[API] 获取用户列表异常:', e);
    return [];
  }
}

/**
 * 获取指定 QKE 会话的事件列表
 * 对应后端 API: GET /api/v1/admin/qke/sessions/{id}/events
 */
export async function getAdminEvents(sessionId: string): Promise<QKEEvent[]> {
  const res = await fetch(`${BASE}/api/v1/admin/qke/sessions/${sessionId}/events?limit=500`);
  if (!res.ok) return [];
  return res.json() as Promise<QKEEvent[]>;
}

/**
 * 获取指定 QKE 会话的参与者列表
 * 对应后端 API: GET /api/v1/admin/qke/sessions/{id}/participants
 */
export async function getSessionParticipants(sessionId: string): Promise<QKESessionMember[]> {
  const res = await fetch(`${BASE}/api/v1/admin/qke/sessions/${sessionId}/participants`);
  if (!res.ok) return [];
  const data = await res.json() as { participants?: QKESessionMember[] };
  return data.participants ?? [];
}

/**
 * 获取指定 QKE 会话的轮次列表
 * 对应后端 API: GET /api/v1/admin/qke/sessions/{id}/rounds
 */
export async function getSessionRounds(sessionId: string): Promise<QKERound[]> {
  const res = await fetch(`${BASE}/api/v1/admin/qke/sessions/${sessionId}/rounds`);
  if (!res.ok) return [];
  const data = await res.json() as { rounds?: QKERound[] };
  return data.rounds ?? [];
}

// 重新导出类型供其他模块使用
export type { User, QKESession, QKESessionDetail, QKESessionMember, QKERound, QKEEvent };

// ==================== 密钥管理 API ====================

export interface KeyEpoch {
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

export async function getKeyEpochs(): Promise<{ data: KeyEpoch[] }> {
  try {
    const res = await fetch(`${BASE}/api/v1/admin/keys/epochs`);
    if (!res.ok) return { data: [] };
    return res.json();
  } catch {
    return { data: [] };
  }
}

// ==================== 告警管理 API ====================

export interface Alert {
  id: number;
  alert_type: 'security' | 'performance' | 'anomaly' | 'system';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  source: string;
  status: 'active' | 'acknowledged' | 'resolved';
  created_at: string;
  acknowledged_at?: string;
  resolved_at?: string;
  metadata?: Record<string, any>;
}

export async function getAlerts(): Promise<{ data: Alert[] }> {
  try {
    const res = await fetch(`${BASE}/api/v1/admin/alerts`);
    if (!res.ok) return { data: [] };
    return res.json();
  } catch {
    return { data: [] };
  }
}

export async function acknowledgeAlert(alertId: number): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/admin/alerts/${alertId}/acknowledge`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error(`Failed to acknowledge alert ${alertId}`);
}

export async function resolveAlert(alertId: number): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/admin/alerts/${alertId}/resolve`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error(`Failed to resolve alert ${alertId}`);
}

// ==================== 性能分析 API ====================

export interface PerformanceMetric {
  timestamp: string;
  qke_sessions_count: number;
  active_users_count: number;
  messages_per_minute: number;
  avg_latency_ms: number;
  key_generation_rate: number;
  cpu_usage: number;
  memory_usage: number;
  network_in_mbps: number;
  network_out_mbps: number;
}

export async function getPerformanceMetrics(timeRange: string): Promise<{ data: PerformanceMetric[] }> {
  try {
    const res = await fetch(`${BASE}/api/v1/admin/performance?range=${timeRange}`);
    if (!res.ok) return { data: [] };
    return res.json();
  } catch {
    return { data: [] };
  }
}

export async function exportPerformanceReport(timeRange: string): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/admin/performance/export?range=${timeRange}`);
  if (!res.ok) throw new Error('Failed to export report');
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `performance-report-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
}

// ==================== 系统配置 API ====================

export interface SystemConfig {
  qke: {
    default_backend: string;
    default_key_length: number;
    default_decoy_count: number;
    session_timeout_minutes: number;
    max_participants: number;
  };
  security: {
    token_expire_hours: number;
    key_rotation_enabled: boolean;
    key_rotation_interval_hours: number;
  };
  server: {
    host: string;
    port: number;
    debug: boolean;
    workers: number;
  };
  logging: {
    level: string;
    file_path: string;
  };
}

export interface LogEntry {
  id: number;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  source: string;
}

export async function getSystemConfig(): Promise<{ data: SystemConfig }> {
  const res = await fetch(`${BASE}/api/v1/admin/config`);
  if (!res.ok) throw new Error('Failed to get system config');
  return res.json();
}

export async function updateSystemConfig(config: SystemConfig): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/admin/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  if (!res.ok) throw new Error('Failed to update system config');
}

export async function getSystemLogs(): Promise<{ data: LogEntry[] }> {
  try {
    const res = await fetch(`${BASE}/api/v1/admin/logs?limit=100`);
    if (!res.ok) return { data: [] };
    return res.json();
  } catch {
    return { data: [] };
  }
}

// ==================== 用户管理 API ====================

export async function deleteUser(userId: number): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/admin/users/${userId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `删除用户失败: ${res.status}`);
  }
}
