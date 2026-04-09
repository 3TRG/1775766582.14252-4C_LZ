/**
 * E2E 测试 API 辅助工具：直接调用后端 API 完成 setup/teardown
 */
import { request, APIRequestContext } from '@playwright/test';
import { BACKEND_BASE, API, USER_A, USER_B } from './test-data';

export interface AuthResult {
  token: string;
  user_id: number;
  username: string;
}

/** 创建一个共享的 API 请求上下文 */
export async function createApiContext(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: BACKEND_BASE });
}

/** 注册用户，返回 token 和 user_id */
export async function registerUser(
  api: APIRequestContext,
  user: { username: string; phone: string; password: string }
): Promise<AuthResult> {
  const res = await api.post(API.REGISTER, {
    data: { username: user.username, account: user.phone, password: user.password },
  });
  if (res.status() !== 200 && res.status() !== 201) {
    const body = await res.text();
    throw new Error(`注册失败 (${res.status()}): ${body}`);
  }
  // 注册成功后需要登录获取 token
  return loginUser(api, user.phone, user.password);
}

/** 登录获取 JWT */
export async function loginUser(
  api: APIRequestContext,
  account: string,
  password: string
): Promise<AuthResult> {
  const res = await api.post(API.LOGIN, {
    data: { account, password },
  });
  if (res.status() !== 200) {
    const body = await res.text();
    throw new Error(`登录失败 (${res.status()}): ${body}`);
  }
  const data = await res.json();
  return {
    token: data.access_token,
    user_id: data.user?.user_id ?? data.user_id,
    username: data.user?.username ?? '',
  };
}

/** 用 token 添加好友 */
export async function addFriend(
  api: APIRequestContext,
  token: string,
  accountOrUserId: string
): Promise<void> {
  const res = await api.post(API.FRIENDS, {
    headers: { Authorization: `Bearer ${token}` },
    data: { account_or_user_id: accountOrUserId },
  });
  if (res.status() !== 200 && res.status() !== 201) {
    const body = await res.text();
    throw new Error(`添加好友失败 (${res.status()}): ${body}`);
  }
}

/** 用 token 发送 P2P 消息 */
export async function sendP2PMessage(
  api: APIRequestContext,
  token: string,
  toUserId: number,
  text: string
): Promise<any> {
  const res = await api.post(API.P2P_MESSAGE, {
    headers: { Authorization: `Bearer ${token}` },
    data: { to_user_id: toUserId, text },
  });
  if (res.status() !== 200 && res.status() !== 201) {
    const body = await res.text();
    throw new Error(`发送消息失败 (${res.status()}): ${body}`);
  }
  return res.json();
}

/** 用 token 发送 P2P 文件 */
export async function sendP2PFile(
  api: APIRequestContext,
  token: string,
  toUserId: number,
  fileName: string,
  content: Buffer
): Promise<any> {
  const res = await api.post(API.P2P_FILE, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      to_user_id: String(toUserId),
      file: { name: fileName, mimeType: 'text/plain', buffer: content },
    },
  });
  if (res.status() !== 200 && res.status() !== 201) {
    const body = await res.text();
    throw new Error(`发送文件失败 (${res.status()}): ${body}`);
  }
  return res.json();
}

/** 获取好友列表 */
export async function getFriends(
  api: APIRequestContext,
  token: string
): Promise<any[]> {
  const res = await api.get(API.FRIENDS, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) return [];
  const data = await res.json();
  return data.friends ?? data ?? [];
}

/** 获取用户会话列表 */
export async function getConversations(
  api: APIRequestContext,
  token: string
): Promise<any[]> {
  const res = await api.get(API.MY_CONVERSATIONS, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) return [];
  const data = await res.json();
  return data.conversations ?? data ?? [];
}

/** 完整的 E2E 预置步骤：注册 A+B，A 登录并添加 B 为好友 */
export async function setupUsersAndFriendship(): Promise<{
  authA: AuthResult;
  authB: AuthResult;
  api: APIRequestContext;
}> {
  const api = await createApiContext();
  const authA = await registerUser(api, USER_A);
  const authB = await registerUser(api, USER_B);
  await addFriend(api, authA.token, USER_B.phone);
  return { authA, authB, api };
}
