import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { authApi } from '@/api'
import { getErrorMessage } from '@/api/client'
import type { LoginRequest, RegisterRequest } from '@/types'

export function useAuth() {
  const navigate = useNavigate()
  const { token, user, isAuthenticated, isLoading, setAuth, logout, setLoading } = useAuthStore()

  const login = useCallback(
    async (data: LoginRequest) => {
      try {
        setLoading(true)
        const response = await authApi.login(data)
        setAuth(response.access_token, response.user)
        navigate('/chat')
        return { success: true }
      } catch (error) {
        return { success: false, error: getErrorMessage(error) }
      } finally {
        setLoading(false)
      }
    },
    [setAuth, setLoading, navigate]
  )

  const register = useCallback(
    async (data: RegisterRequest) => {
      try {
        setLoading(true)
        await authApi.register(data)
        // After registration, redirect to login
        navigate('/login', { state: { message: '注册成功，请登录' } })
        return { success: true }
      } catch (error) {
        return { success: false, error: getErrorMessage(error) }
      } finally {
        setLoading(false)
      }
    },
    [setLoading, navigate]
  )

  const forgotPassword = useCallback(
    async (phone: string) => {
      try {
        setLoading(true)
        await authApi.forgotPassword({ phone })
        return { success: true }
      } catch (error) {
        return { success: false, error: getErrorMessage(error) }
      } finally {
        setLoading(false)
      }
    },
    [setLoading]
  )

  const handleLogout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // 即使请求失败也继续登出
    }
    logout()
    navigate('/login')
  }, [logout, navigate])

  return {
    token,
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    forgotPassword,
    logout: handleLogout,
  }
}
