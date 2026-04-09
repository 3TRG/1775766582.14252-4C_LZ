import { create } from 'zustand'
import type { Conversation, Message } from '@/types'

interface TypingUser {
  user_id: number
  is_typing: boolean
  username?: string
}

export interface QKENegotiationState {
  currentStep: number
  totalSteps: number
  stepLabel: string
  sessionId?: string
}

interface ChatState {
  conversations: Conversation[]
  messages: Record<string, Message[]>
  activeConversationId: string | null
  typingUsers: Record<string, TypingUser[]>
  qkeNegotiation: Record<string, QKENegotiationState>
  isLoading: boolean

  // Actions
  setConversations: (conversations: Conversation[]) => void
  addConversation: (conversation: Conversation) => void
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void
  removeConversation: (conversationId: string) => void

  setMessages: (conversationId: string, messages: Message[]) => void
  addMessage: (conversationId: string, message: Message) => void
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void
  markMessageAsRead: (conversationId: string, messageId: string) => void

  setActiveConversation: (id: string | null) => void
  setTypingStatus: (conversationId: string, userId: number, isTyping: boolean, username?: string) => void
  updateQKENegotiation: (conversationId: string, state: QKENegotiationState) => void
  clearQKENegotiation: (conversationId: string) => void
  setLoading: (loading: boolean) => void

  // Computed
  getActiveConversation: () => Conversation | undefined
  getUnreadCount: () => number
  getTypingUsernames: (conversationId: string) => string[]
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: {},
  activeConversationId: null,
  typingUsers: {},
  qkeNegotiation: {},
  isLoading: false,

  setConversations: (conversations) => set({ conversations }),

  addConversation: (conversation) =>
    set((state) => ({
      conversations: [conversation, ...state.conversations],
    })),

  updateConversation: (conversationId, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, ...updates } : c
      ),
    })),

  removeConversation: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== conversationId),
    })),

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: messages,
      },
    })),

  addMessage: (conversationId, message) =>
    set((state) => {
      const existingMessages = state.messages[conversationId] || []
      // Avoid duplicates
      if (existingMessages.some((m) => m.id === message.id)) {
        return state
      }
      return {
        messages: {
          ...state.messages,
          [conversationId]: [...existingMessages, message],
        },
      }
    }),

  updateMessage: (conversationId, messageId, updates) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: state.messages[conversationId]?.map((m) =>
          m.id === messageId ? { ...m, ...updates } : m
        ),
      },
    })),

  markMessageAsRead: (conversationId, messageId) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: state.messages[conversationId]?.map((m) =>
          m.id === messageId ? { ...m, is_read: true } : m
        ),
      },
    })),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setTypingStatus: (conversationId, userId, isTyping, username) =>
    set((state) => {
      const currentTyping = state.typingUsers[conversationId] || []
      const filtered = currentTyping.filter((t) => t.user_id !== userId)

      if (!isTyping) {
        return {
          typingUsers: { ...state.typingUsers, [conversationId]: filtered },
        }
      }

      return {
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: [...filtered, { user_id: userId, is_typing: true, username }],
        },
      }
    }),

  updateQKENegotiation: (conversationId, negotiationState) =>
    set((state) => ({
      qkeNegotiation: {
        ...state.qkeNegotiation,
        [conversationId]: negotiationState,
      },
    })),

  clearQKENegotiation: (conversationId) =>
    set((state) => {
      const { [conversationId]: _, ...rest } = state.qkeNegotiation
      return { qkeNegotiation: rest }
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  getActiveConversation: () => {
    const state = get()
    return state.conversations.find((c) => c.id === state.activeConversationId)
  },

  getUnreadCount: () => {
    const state = get()
    return state.conversations.reduce((sum, c) => sum + c.unread_count, 0)
  },

  getTypingUsernames: (conversationId: string) => {
    const state = get()
    const typing = state.typingUsers[conversationId] || []
    return typing
      .filter((t) => t.is_typing && t.username)
      .map((t) => t.username!)
  },
}))
