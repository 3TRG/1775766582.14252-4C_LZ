export type MessageType = 'text' | 'file' | 'image' | 'audio' | 'video'

export interface Message {
  id: string
  conversation_id: string
  from_user_id: number
  to_user_id: number | null  // null for group messages
  group_id: number | null     // null for private messages
  content: string
  message_type: MessageType
  file_url?: string
  file_name?: string
  file_size?: number
  created_at: string
  is_read: boolean
  is_favorite: boolean
}

export interface SendMessageRequest {
  to_user_id?: number
  group_id?: number
  content: string
  message_type: MessageType
  file_url?: string
  file_name?: string
  file_size?: number
}

export interface MessageHistoryResponse {
  messages: Message[]
  total: number
  has_more: boolean
}
