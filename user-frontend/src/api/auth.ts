import { apiClient } from './client'
import type {
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  ForgotPasswordRequest,
  User,
} from '@/types'

export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>('/auth/login', {
      account: data.account,
      password: data.password,
    })
    return response.data
  },

  register: async (data: RegisterRequest): Promise<User> => {
    const response = await apiClient.post<User>('/auth/register', data)
    return response.data
  },

  forgotPassword: async (data: ForgotPasswordRequest): Promise<void> => {
    await apiClient.post('/auth/forgot-password', data)
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get<User>('/auth/me')
    return response.data
  },

  updateProfile: async (data: { username?: string; email?: string }): Promise<User> => {
    const response = await apiClient.put<User>('/auth/profile', data)
    return response.data
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout')
  },
}
