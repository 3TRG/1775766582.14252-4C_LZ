import { Message } from './message'

export type ConversationType = 'private' | 'group'
export type QKEStatus = 'idle' | 'negotiating' | 'active' | 'failed' | 'rotating'

export interface Conversation {
  id: string
  type: ConversationType
  name?: string  // for group conversations
  avatar?: string
  target_user_id?: number  // for private conversations
  group_id?: number        // for group conversations
  last_message?: Message
  unread_count: number
  created_at: string
  updated_at: string

  // QKE 加密状态字段
  qke_status?: QKEStatus
  current_key_epoch?: number
  key_fingerprint?: string
}

export interface ConversationDetail extends Conversation {
  messages: Message[]
  participants: ConversationParticipant[]
}

export interface ConversationParticipant {
  user_id: number
  username: string
  avatar?: string
  role?: 'owner' | 'admin' | 'member'
  joined_at: string
}
