// API configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000'

// Storage keys
export const STORAGE_KEYS = {
  TOKEN: 'quantum_chat_token',
  USER: 'quantum_chat_user',
  THEME: 'quantum_chat_theme',
} as const

// Message types
export const MESSAGE_TYPES = {
  TEXT: 'text',
  FILE: 'file',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
} as const

// WebSocket message types
export const WS_MESSAGE_TYPES = {
  MESSAGE: 'message',
  STATUS: 'status',
  QKE_EVENT: 'qke_event',
  NOTIFICATION: 'notification',
  TYPING: 'typing',
  READ_RECEIPT: 'read_receipt',
} as const

// User status
export const USER_STATUS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
} as const

// Meeting status
export const MEETING_STATUS = {
  SCHEDULED: 'scheduled',
  ONGOING: 'ongoing',
  ENDED: 'ended',
} as const

// File upload limits
export const FILE_LIMITS = {
  MAX_SIZE: 50 * 1024 * 1024, // 50MB
  ALLOWED_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],
} as const
