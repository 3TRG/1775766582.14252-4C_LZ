/**
 * Vitest 全局测试配置
 * - 模拟 localStorage（jsdom 自带）
 * - 模拟 window.location
 */
import { vi } from 'vitest'

// 模拟 import.meta.env
vi.stubGlobal('import.meta', {
  env: {
    VITE_API_BASE_URL: '/api/v1',
    VITE_WS_BASE_URL: 'ws://localhost:8000',
  },
})
