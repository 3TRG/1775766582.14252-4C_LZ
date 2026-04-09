import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    actionTimeout: 12000,
    navigationTimeout: 30000,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'user-flow',
      testDir: './specs/user-flow',
      use: { baseURL: 'http://localhost:3001' },
    },
    {
      name: 'admin-flow',
      testDir: './specs/admin-flow',
      use: { baseURL: 'http://localhost:3000' },
    },
  ],
  outputDir: 'artifacts',
  // 服务健康检查：测试前确认后端可用
  // 注意：前端和后端需要手动启动，或者通过 ENVIRONMENT=test 环境变量启动
  // 后端: cd backend && ENVIRONMENT=test python main.py
  // 用户前端: cd user-frontend && npm run dev
  // 管理前端: cd admin-frontend && npm run dev
});
