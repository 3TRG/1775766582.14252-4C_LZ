import { apiClient } from './client'
import type {
  Conversation,
  ConversationDetail,
  Message,
  SendMessageRequest,
  MessageHistoryResponse,
} from '@/types'

export const chatApi = {
  // Conversations
  getConversations: async (): Promise<Conversation[]> => {
    const response = await apiClient.get<{ items: Conversation[] }>('/chat/conversations/mine')
    return response.data.items ?? []
  },

  getConversationDetail: async (conversationId: string): Promise<ConversationDetail> => {
    const response = await apiClient.get<ConversationDetail>(`/chat/conversations/${conversationId}`)
    return response.data
  },

  // Messages
  sendMessage: async (data: SendMessageRequest): Promise<Message> => {
    const response = await apiClient.post<Message>('/chat/messages/p2p', data)
    return response.data
  },

  getMessageHistory: async (
    withUserId: number,
    page = 1,
    pageSize = 50
  ): Promise<MessageHistoryResponse> => {
    const response = await apiClient.get<MessageHistoryResponse>('/chat/messages/p2p/history', {
      params: { with_user_id: withUserId, limit: pageSize },
    })
    return response.data
  },

  sendFile: async (
    toUserId: number,
    file: File
  ): Promise<Message> => {
    const formData = new FormData()
    formData.append('to_user_id', String(toUserId))
    formData.append('file', file)
    const response = await apiClient.post<Message>('/chat/messages/p2p/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },

  markAsRead: async (conversationId: string): Promise<void> => {
    await apiClient.put(`/chat/conversations/${conversationId}/read`)
  },

  // Favorites
  getFavoriteMessages: async (): Promise<Message[]> => {
    const response = await apiClient.get<Message[]>('/chat/favorites')
    return response.data
  },

  toggleFavorite: async (messageId: string): Promise<void> => {
    await apiClient.post(`/chat/messages/${messageId}/favorite`)
  },
}
