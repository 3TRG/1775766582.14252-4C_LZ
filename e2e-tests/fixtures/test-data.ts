/**
 * E2E 测试共享数据：用户凭据、API 基地址等
 */

const TS = Date.now();

/** 生成符合后端密码要求的密码（>=8位，大写+小写+数字+特殊字符） */
const VALID_PASSWORD = 'Test@123456';

/** 手机号必须匹配 ^1[3-9]\d{9}$ */
function makePhone(seed: number): string {
  return `138${String(seed).slice(-8).padStart(8, '0')}`;
}

export const USER_A = {
  username: `e2e_a_${TS}`,
  phone: makePhone(TS),
  password: VALID_PASSWORD,
};

export const USER_B = {
  username: `e2e_b_${TS}`,
  phone: makePhone(TS + 1),
  password: VALID_PASSWORD,
};

export const BACKEND_BASE = 'http://localhost:8000';
export const USER_FRONTEND_BASE = 'http://localhost:3001';
export const ADMIN_FRONTEND_BASE = 'http://localhost:3000';

/** API 路径常量 */
export const API = {
  REGISTER: '/api/v1/auth/register',
  LOGIN: '/api/v1/auth/login',
  ME: '/api/v1/auth/me',
  FRIENDS: '/api/v1/chat/friends',
  CONVERSATIONS: '/api/v1/chat/conversations',
  MY_CONVERSATIONS: '/api/v1/chat/conversations/mine',
  P2P_MESSAGE: '/api/v1/chat/messages/p2p',
  P2P_FILE: '/api/v1/chat/messages/p2p/file',
  P2P_HISTORY: '/api/v1/chat/messages/p2p/history',
  ADMIN_USERS: '/api/v1/admin/users',
  ADMIN_SESSIONS: '/api/v1/admin/qke/sessions',
  ADMIN_SESSION_DETAIL: (id: number | string) => `/api/v1/admin/qke/sessions/${id}`,
  ADMIN_SESSION_EVENTS: (id: number | string) => `/api/v1/admin/qke/sessions/${id}/events`,
  ADMIN_DASHBOARD_SUMMARY: '/api/v1/admin/dashboard/summary',
  ADMIN_DASHBOARD_USERS: '/api/v1/admin/dashboard/users',
  ADMIN_STATISTICS_KPIS: '/api/v1/admin/statistics/kpis',
  ADMIN_KEYS_EPOCHS: '/api/v1/admin/keys/epochs',
  ADMIN_ALERTS: '/api/v1/admin/alerts',
} as const;
