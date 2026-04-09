/**
 * AuthStore 单元测试
 * 覆盖: src/store/authStore.ts — 认证状态管理
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'
import { clearAuth, setToken, getToken, setStoredUser, getStoredUser } from '@/utils/storage'

const mockUser: User = {
  user_id: 1,
  username: 'testuser',
  account: '13800001111',
  role: 'leader',
  status: 'online',
  created_at: '2026-01-01T00:00:00',
}

describe('AuthStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    const store = useAuthStore.getState()
    store.logout()
    localStorage.clear()
  })

  // ==================== 初始状态 ====================

  describe('初始状态', () => {
    it('初始状态下未认证', () => {
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.token).toBeNull()
      expect(state.user).toBeNull()
    })
  })

  // ==================== setAuth ====================

  describe('setAuth', () => {
    it('设置认证信息后状态变为已认证', () => {
      const store = useAuthStore.getState()
      store.setAuth('test-jwt-token', mockUser)

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.token).toBe('test-jwt-token')
      expect(state.user).toEqual(mockUser)
      expect(state.isLoading).toBe(false)
    })

    it('setAuth 同时持久化到 localStorage', () => {
      const store = useAuthStore.getState()
      store.setAuth('persisted-token', mockUser)

      expect(getToken()).toBe('persisted-token')
      const stored = getStoredUser<User>()
      expect(stored?.user_id).toBe(1)
    })
  })

  // ==================== setUser ====================

  describe('setUser', () => {
    it('更新用户信息', () => {
      const store = useAuthStore.getState()
      store.setAuth('token', mockUser)

      const updatedUser = { ...mockUser, username: 'updated_name' }
      store.setUser(updatedUser)

      const state = useAuthStore.getState()
      expect(state.user?.username).toBe('updated_name')
    })

    it('setUser 持久化到 localStorage', () => {
      const store = useAuthStore.getState()
      store.setAuth('token', mockUser)

      const updatedUser = { ...mockUser, username: 'new_name' }
      store.setUser(updatedUser)

      const stored = getStoredUser<User>()
      expect(stored?.username).toBe('new_name')
    })
  })

  // ==================== logout ====================

  describe('logout', () => {
    it('logout 清除所有认证状态', () => {
      const store = useAuthStore.getState()
      store.setAuth('token', mockUser)

      store.logout()

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.token).toBeNull()
      expect(state.user).toBeNull()
      expect(state.isLoading).toBe(false)
    })

    it('logout 清除 localStorage', () => {
      const store = useAuthStore.getState()
      store.setAuth('token', mockUser)

      store.logout()

      expect(getToken()).toBeNull()
      expect(getStoredUser()).toBeNull()
    })
  })

  // ==================== setLoading ====================

  describe('setLoading', () => {
    it('设置加载状态', () => {
      const store = useAuthStore.getState()
      store.setLoading(true)
      expect(useAuthStore.getState().isLoading).toBe(true)

      store.setLoading(false)
      expect(useAuthStore.getState().isLoading).toBe(false)
    })
  })

  // ==================== initAuth ====================

  describe('initAuth', () => {
    it('localStorage 有数据时恢复认证状态', () => {
      // 先设置 localStorage
      setToken('restored-token')
      setStoredUser(mockUser)

      // 清空 store 状态模拟刷新
      useAuthStore.setState({
        token: null,
        user: null,
        isAuthenticated: false,
        isLoading: true,
      })

      const store = useAuthStore.getState()
      store.initAuth()

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.token).toBe('restored-token')
      expect(state.user?.user_id).toBe(1)
      expect(state.isLoading).toBe(false)
    })

    it('localStorage 无数据时保持未认证', () => {
      localStorage.clear()

      const store = useAuthStore.getState()
      store.initAuth()

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.token).toBeNull()
      expect(state.user).toBeNull()
      expect(state.isLoading).toBe(false)
    })

    it('只有 token 无 user 时保持未认证', () => {
      localStorage.clear()
      setToken('only-token')

      const store = useAuthStore.getState()
      store.initAuth()

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
    })

    it('只有 user 无 token 时保持未认证', () => {
      localStorage.clear()
      setStoredUser(mockUser)

      const store = useAuthStore.getState()
      store.initAuth()

      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
    })
  })
})
