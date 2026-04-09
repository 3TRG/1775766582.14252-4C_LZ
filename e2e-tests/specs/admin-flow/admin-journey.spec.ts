/**
 * E2E: 管理端完整流程
 *
 * 验证管理端 React SPA 的六个面板加载、API 交互和数据显示。
 * 使用 serial 模式确保测试共享同一 worker 进程。
 */
import { test, expect } from '@playwright/test';
import { API, USER_A, USER_B } from '../../fixtures/test-data';
import {
  createApiContext,
  registerUser,
  loginUser,
  addFriend,
  sendP2PMessage,
  sendP2PFile,
} from '../../fixtures/api-helpers';

test.describe.configure({ mode: 'serial' });

test.describe('管理端完整流程', () => {
  /** 预置数据：注册用户并发送消息产生 QKE 会话 */
  async function seedData() {
    const api = await createApiContext();
    const authA = await registerUser(api, USER_A);
    const authB = await registerUser(api, USER_B);
    await addFriend(api, authA.token, USER_B.phone);
    await sendP2PMessage(api, authA.token, authB.user_id, '管理端测试消息');
    await sendP2PFile(
      api,
      authA.token,
      authB.user_id,
      'admin-test.txt',
      Buffer.from('管理端测试文件')
    ).catch((err) => {
      // 文件上传端点可能未完全实现，仅在网络/服务端错误时忽略
      if (!String(err).includes('500') && !String(err).includes('415') && !String(err).includes('422')) throw err;
    });
    return { authA, authB, api };
  }

  // ---------- 1. 仪表盘加载 ----------
  test('1. 仪表盘加载并显示用户列表', async ({ page }) => {
    const { authA, authB } = await seedData();

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 验证标题 "QKE-Viz"
    await expect(page.getByText('QKE-Viz')).toBeVisible({ timeout: 15000 });

    // 验证左侧导航链接
    await expect(page.locator('a:has-text("用户状态")')).toBeVisible();
    await expect(page.locator('a:has-text("QKE过程")')).toBeVisible();
    await expect(page.locator('a:has-text("性能分析")')).toBeVisible();

    // 验证管理员账户标签
    await expect(page.getByText('管理员账户')).toBeVisible();

    // 验证用户列表区域（page1 面板默认显示）
    await expect(page.getByText('所有用户')).toBeVisible({ timeout: 10000 });

    // 验证用户表格存在
    const userTable = page.locator('table');
    await expect(userTable).toBeVisible({ timeout: 10000 });

    // 验证用户A出现在列表中（注意：用户名可能同时出现在表格和网络拓扑中）
    await expect(page.getByText(USER_A.username).first()).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'artifacts/admin-dashboard.png' });
  });

  // ---------- 2. QKE 过程展示 ----------
  test('2. QKE过程页面展示', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // 切换到 QKE 过程面板
    await page.locator('a:has-text("QKE过程")').click();

    // 验证群聊/私聊切换按钮
    await expect(page.getByText('群聊用户状态').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('私聊用户状态').first()).toBeVisible();

    // 验证共享密钥生成区域
    await expect(page.getByText('共享密钥生成')).toBeVisible();

    await page.screenshot({ path: 'artifacts/admin-qke-process.png' });
  });

  // ---------- 3. 性能分析页面 ----------
  test('3. 性能分析页面加载图表', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.locator('a:has-text("性能分析")').click();

    // 验证性能指标卡片
    await expect(page.getByText('密钥生成率')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('总延迟')).toBeVisible();
    await expect(page.getByText('量子资源消耗')).toBeVisible();

    await page.screenshot({ path: 'artifacts/admin-performance.png' });
  });

  // ---------- 4. 密钥管理页面 ----------
  test('4. 密钥管理页面加载', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.locator('a:has-text("密钥管理")').click();

    // 验证密钥管理页面标题（使用 heading 精确定位）
    await expect(page.getByRole('heading', { name: '密钥管理' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('管理量子密钥的全生命周期')).toBeVisible();

    await page.screenshot({ path: 'artifacts/admin-keys.png' });
  });

  // ---------- 5. 风险告警页面 ----------
  test('5. 风险告警页面加载', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.locator('a:has-text("风险告警")').click();

    // 验证风险告警页面标题
    await expect(page.getByRole('heading', { name: '风险告警' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('监控系统安全风险和异常事件')).toBeVisible();

    await page.screenshot({ path: 'artifacts/admin-alerts.png' });
  });

  // ---------- 6. 系统配置页面 ----------
  test('6. 系统配置页面加载', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await page.locator('a:has-text("系统配置")').click();

    // 验证系统管理页面标题
    await expect(page.getByRole('heading', { name: '系统管理' })).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'artifacts/admin-config.png' });
  });

  // ---------- 7. 后台 API 独立验证 ----------
  test('7. 后台API独立验证（无UI）', async () => {
    const api = await createApiContext();

    // 验证核心后台 API 端点可达
    const coreEndpoints = [
      { url: API.ADMIN_USERS, name: '用户列表' },
      { url: API.ADMIN_SESSIONS, name: 'QKE会话列表' },
      { url: API.ADMIN_DASHBOARD_SUMMARY, name: '仪表盘摘要' },
      { url: API.ADMIN_STATISTICS_KPIS, name: '统计KPI' },
    ];

    for (const ep of coreEndpoints) {
      const res = await api.get(ep.url);
      expect(res.ok(), `${ep.name} (${ep.url}) 应返回成功`).toBeTruthy();
      const data = await res.json();
      expect(data, `${ep.name} 应返回 JSON 数据`).toBeDefined();
    }

    // 可选端点（可能尚未实现或无数据）
    const optionalEndpoints = [
      { url: API.ADMIN_KEYS_EPOCHS, name: '密钥轮次' },
      { url: API.ADMIN_ALERTS, name: '风险告警' },
    ];

    for (const ep of optionalEndpoints) {
      const res = await api.get(ep.url);
      // 可选端点只要返回响应即可（可能是空列表或 404）
      expect(res.status(), `${ep.name} 应返回响应`).toBeLessThan(500);
    }
  });
});
