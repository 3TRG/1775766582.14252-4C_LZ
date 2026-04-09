/**
 * Storage 工具函数单元测试
 * 覆盖: src/utils/storage.ts
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getToken,
  setToken,
  removeToken,
  getStoredUser,
  setStoredUser,
  removeStoredUser,
  clearAuth,
} from '@/utils/storage'

describe('Storage 工具函数', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  // ==================== Token 操作 ====================

  describe('Token 操作', () => {
    it('初始状态下 getToken 返回 null', () => {
      expect(getToken()).toBeNull()
    })

    it('setToken 后 getToken 能取回', () => {
      setToken('test-token-123')
      expect(getToken()).toBe('test-token-123')
    })

    it('removeToken 后 getToken 返回 null', () => {
      setToken('test-token')
      removeToken()
      expect(getToken()).toBeNull()
    })

    it('覆盖写入 token', () => {
      setToken('token-1')
      setToken('token-2')
      expect(getToken()).toBe('token-2')
    })
  })

  // ==================== User 操作 ====================

  describe('User 存储', () => {
    const testUser = {
      user_id: 1,
      username: 'testuser',
      account: '13800001111',
      role: 'leader' as const,
      status: 'online' as const,
      created_at: '2026-01-01T00:00:00',
    }

    it('初始状态下 getStoredUser 返回 null', () => {
      expect(getStoredUser()).toBeNull()
    })

    it('setStoredUser 后 getStoredUser 能取回', () => {
      setStoredUser(testUser)
      const stored = getStoredUser<typeof testUser>()
      expect(stored).toEqual(testUser)
    })

    it('removeStoredUser 后返回 null', () => {
      setStoredUser(testUser)
      removeStoredUser()
      expect(getStoredUser()).toBeNull()
    })

    it('存储损坏的 JSON 时返回 null', () => {
      localStorage.setItem('quantum_chat_user', '{invalid json}')
      expect(getStoredUser()).toBeNull()
    })

    it('存储空字符串时返回 null', () => {
      localStorage.setItem('quantum_chat_user', '')
      expect(getStoredUser()).toBeNull()
    })
  })

  // ==================== clearAuth ====================

  describe('clearAuth', () => {
    it('同时清除 token 和 user', () => {
      setToken('token-abc')
      setStoredUser({ user_id: 1, username: 'u' })
      clearAuth()
      expect(getToken()).toBeNull()
      expect(getStoredUser()).toBeNull()
    })

    it('在无数据时调用不报错', () => {
      expect(() => clearAuth()).not.toThrow()
    })
  })
})
