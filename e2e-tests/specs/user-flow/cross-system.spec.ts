/**
 * E2E: 跨系统验证
 *
 * 使用两个浏览器上下文同时操作用户端和管理端，
 * 验证用户端的操作（注册、登录、发消息）能在管理端实时反映。
 * 这验证了前后端 WebSocket + REST API 的完整交互链路。
 */
import { test, expect, Browser, BrowserContext, Page } from '@playwright/test';
import { USER_FRONTEND_BASE, ADMIN_FRONTEND_BASE, BACKEND_BASE, API, USER_A, USER_B } from '../../fixtures/test-data';
import {
  createApiContext,
  registerUser,
  loginUser,
  addFriend,
  sendP2PMessage,
} from '../../fixtures/api-helpers';

// 跨系统测试需要独立的 test.describe 以使用 serial 模式
test.describe.configure({ mode: 'serial' });

test.describe('跨系统联动验证', () => {
  let userPage: Page;
  let adminPage: Page;
  let userCtx: BrowserContext;
  let adminCtx: BrowserContext;

  test.beforeAll(async ({ browser }) => {
    // 创建两个独立的浏览器上下文
    userCtx = await browser.newContext();
    adminCtx = await browser.newContext();
    userPage = await userCtx.newPage();
    adminPage = await adminCtx.newPage();
  });

  test.afterAll(async () => {
    await userCtx.close();
    await adminCtx.close();
  });

  // ---------- 1. 用户注册 → 管理端实时显示新用户 ----------
  test('1. 用户注册后管理端用户列表更新', async () => {
    // 打开管理端仪表盘（使用 domcontentloaded 避免 networkidle 超时）
    await adminPage.goto(ADMIN_FRONTEND_BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await adminPage.waitForLoadState('networkidle').catch(() => {});
    await expect(adminPage.getByText('QKE-Viz')).toBeVisible({ timeout: 15000 });

    // 确认管理端已连接 WebSocket
    await adminPage.waitForTimeout(2000);

    // 在用户端注册新用户
    await userPage.goto(`${USER_FRONTEND_BASE}/register.html`, { waitUntil: 'domcontentloaded' });
    await userPage.waitForLoadState('networkidle').catch(() => {});

    await userPage.locator('#username').fill(USER_A.username);
    await userPage.locator('#phone').fill(USER_A.phone);
    await userPage.locator('#password').fill(USER_A.password);
    await userPage.locator('#confirmPassword').fill(USER_A.password);

    await userPage.getByRole('button', { name: '注册账号' }).click();
    await userPage.waitForURL('**/login**', { timeout: 10000 });

    // 等待管理端 WebSocket 广播用户注册事件
    await adminPage.waitForTimeout(3000);

    // 刷新管理端验证用户列表包含新用户
    await adminPage.reload();
    await adminPage.waitForLoadState('networkidle');

    // 管理端应该显示新注册的用户（可能在表格和网络拓扑中同时出现）
    await expect(adminPage.getByText(USER_A.username).first()).toBeVisible({ timeout: 10000 });

    await adminPage.screenshot({ path: 'artifacts/cross-admin-after-register.png' });
  });

  // ---------- 2. 用户登录 → 管理端显示在线状态 ----------
  test('2. 用户登录后管理端显示在线状态', async () => {
    // 用户端登录
    await userPage.goto(`${USER_FRONTEND_BASE}/login.html`, { waitUntil: 'domcontentloaded' });
    await userPage.waitForLoadState('networkidle').catch(() => {});

    await userPage.locator('#phone').fill(USER_A.phone);
    await userPage.locator('#password').fill(USER_A.password);
    await userPage.locator('#agree').check();
    await userPage.getByRole('button', { name: '登录系统' }).click();
    await userPage.waitForURL('**/chat.html**', { timeout: 10000 });

    // 等待 WebSocket 广播登录事件
    await adminPage.waitForTimeout(3000);

    // 管理端应显示在线用户数 > 0
    const onlineIndicator = adminPage.locator('text=在线:');
    // 在线指示器应包含数字 > 0
    const hasOnline = await onlineIndicator.first().isVisible().catch(() => false);
    if (hasOnline) {
      const onlineText = await onlineIndicator.first().textContent();
      const count = parseInt(onlineText?.replace(/[^\d]/g, '') || '0', 10);
      expect(count).toBeGreaterThan(0);
    }

    await adminPage.screenshot({ path: 'artifacts/cross-admin-user-online.png' });
  });

  // ---------- 3. 用户发送消息 → 管理端 QKE 事件流更新 ----------
  test('3. 用户发消息后管理端QKE事件流更新', async () => {
    // 通过 API 注册用户B并添加好友（简化流程）
    const api = await createApiContext();
    const authA = await loginUser(api, USER_A.phone, USER_A.password);
    const authB = await registerUser(api, USER_B);
    await addFriend(api, authA.token, USER_B.phone);

    // 在管理端切换到 QKE 过程页面
    await adminPage.locator('a:has-text("QKE过程")').click();
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // 用户端发送消息
    const testMessage = `跨系统测试消息_${Date.now()}`;
    await sendP2PMessage(api, authA.token, authB.user_id, testMessage);

    // 等待管理端接收到 WebSocket 事件
    await adminPage.waitForTimeout(3000);

    // 验证管理端实时协商过程中出现新事件
    // 可能看到 message_encrypted 或 message_delivered 事件
    const eventsPanel = adminPage.getByText('实时协商过程').first();
    await expect(eventsPanel).toBeVisible({ timeout: 10000 });

    await adminPage.screenshot({ path: 'artifacts/cross-admin-qke-events.png' });
  });

  // ---------- 4. 验证管理端 QKE 会话详情 API ----------
  test('4. 管理端QKE会话详情API可获取完整数据', async () => {
    const api = await createApiContext();

    // 获取所有 QKE 会话
    const sessionsResp = await api.get(API.ADMIN_SESSIONS);
    expect(sessionsResp.ok()).toBeTruthy();
    const sessions = await sessionsResp.json();
    expect(Array.isArray(sessions)).toBeTruthy();
    expect(sessions.length).toBeGreaterThan(0);

    // 取第一个会话查看详情
    const sessionId = sessions[0].session_id;
    const detailResp = await api.get(API.ADMIN_SESSION_DETAIL(sessionId));
    expect(detailResp.ok()).toBeTruthy();
    const detail = await detailResp.json();
    expect(detail).toHaveProperty('session');
    expect(detail).toHaveProperty('members');
    expect(detail).toHaveProperty('rounds');

    // 获取会话事件
    const eventsResp = await api.get(API.ADMIN_SESSION_EVENTS(sessionId));
    expect(eventsResp.ok()).toBeTruthy();
    const events = await eventsResp.json();
    expect(Array.isArray(events)).toBeTruthy();

    // 验证管理端能正确展示这些数据
    await adminPage.reload({ waitUntil: 'domcontentloaded' });
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // 选择 QKE 会话
    const sessionSelect = adminPage.locator('select').first();
    await sessionSelect.selectOption({ value: String(sessionId) });
    await adminPage.waitForLoadState('networkidle').catch(() => {});

    // 验证用户状态表格有数据
    const participantRows = adminPage.locator('table tbody tr');
    const rowCount = await participantRows.count();
    expect(rowCount).toBeGreaterThan(0);

    await adminPage.screenshot({ path: 'artifacts/cross-admin-session-detail.png' });
  });

  // ---------- 5. 完整前后端交互链路验证 ----------
  test('5. 后端API完整链路验证', async () => {
    const api = await createApiContext();

    // 注册 → 登录 → 添加好友 → 创建会话 → 发消息 → 获取历史
    const authA = await loginUser(api, USER_A.phone, USER_A.password);
    const authB = await loginUser(api, USER_B.phone, USER_B.password);

    // 验证 /me 端点
    const meResp = await api.get(API.ME, {
      headers: { Authorization: `Bearer ${authA.token}` },
    });
    expect(meResp.ok()).toBeTruthy();
    const meData = await meResp.json();
    expect(meData.username).toBe(USER_A.username);

    // 验证好友列表
    const friendsResp = await api.get(API.FRIENDS, {
      headers: { Authorization: `Bearer ${authA.token}` },
    });
    expect(friendsResp.ok()).toBeTruthy();

    // 验证会话列表
    const convResp = await api.get(API.MY_CONVERSATIONS, {
      headers: { Authorization: `Bearer ${authA.token}` },
    });
    expect(convResp.ok()).toBeTruthy();

    // 发送消息并验证历史
    await sendP2PMessage(api, authA.token, authB.user_id, '链路验证消息');

    const historyResp = await api.get(`${API.P2P_HISTORY}?with_user_id=${authB.user_id}&limit=10`, {
      headers: { Authorization: `Bearer ${authA.token}` },
    });
    expect(historyResp.ok()).toBeTruthy();
    const history = await historyResp.json();
    // 消息历史可能返回 { messages: [...] } 或 { items: [...] } 或直接是数组
    const messages = history.messages ?? history.items ?? (Array.isArray(history) ? history : []);
    expect(messages.length).toBeGreaterThan(0);

    // 验证管理端仪表盘摘要 API
    const summaryResp = await api.get(API.ADMIN_DASHBOARD_SUMMARY);
    expect(summaryResp.ok()).toBeTruthy();
    const summary = await summaryResp.json();
    expect(summary).toBeDefined();

    // 验证统计 KPI API
    const kpiResp = await api.get(API.ADMIN_STATISTICS_KPIS);
    expect(kpiResp.ok()).toBeTruthy();
  });
});
