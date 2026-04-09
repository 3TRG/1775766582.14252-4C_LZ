import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { setToken, getToken, removeToken, setStoredUser, getStoredUser, clearAuth } from '@/utils/storage'

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean

  // Actions
  setAuth: (token: string, user: User) => void
  setUser: (user: User) => void
  logout: () => void
  setLoading: (loading: boolean) => void
  initAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,

      setAuth: (token, user) => {
        setToken(token)
        setStoredUser(user)
        set({
          token,
          user,
          isAuthenticated: true,
          isLoading: false,
        })
      },

      setUser: (user) => {
        setStoredUser(user)
        set({ user })
      },

      logout: () => {
        clearAuth()
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          isLoading: false,
        })
      },

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      initAuth: () => {
        const token = getToken()
        const user = getStoredUser<User>()
        if (token && user) {
          set({
            token,
            user,
            isAuthenticated: true,
            isLoading: false,
          })
        } else {
          set({
            token: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
          })
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
