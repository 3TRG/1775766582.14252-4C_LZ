import { STORAGE_KEYS } from './constants'

export function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.TOKEN)
}

export function setToken(token: string): void {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token)
}

export function removeToken(): void {
  localStorage.removeItem(STORAGE_KEYS.TOKEN)
}

export function getStoredUser<T>(): T | null {
  const userStr = localStorage.getItem(STORAGE_KEYS.USER)
  if (!userStr) return null
  try {
    return JSON.parse(userStr)
  } catch {
    return null
  }
}

export function setStoredUser<T>(user: T): void {
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
}

export function removeStoredUser(): void {
  localStorage.removeItem(STORAGE_KEYS.USER)
}

export function clearAuth(): void {
  removeToken()
  removeStoredUser()
}
