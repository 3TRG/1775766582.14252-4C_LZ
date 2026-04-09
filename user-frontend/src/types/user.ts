export interface User {
  user_id: number
  username: string
  account: string
  phone?: string
  email?: string
  avatar?: string
  role: 'leader' | 'follower'
  status: 'online' | 'offline'
  created_at: string
}

export interface LoginRequest {
  account: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: User
}

export interface RegisterRequest {
  username: string
  account: string
  password: string
  email?: string
}

export interface ForgotPasswordRequest {
  phone: string
}
