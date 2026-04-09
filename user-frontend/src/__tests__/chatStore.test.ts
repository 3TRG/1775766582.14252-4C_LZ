/**
 * ChatStore 单元测试
 * 覆盖: src/store/chatStore.ts — 聊天状态管理
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useChatStore } from '@/store/chatStore'
import type { Conversation, Message } from '@/types'

const mockConversation: Conversation = {
  id: 'conv-1',
  type: 'private',
  target_user_id: 2,
  unread_count: 0,
  created_at: '2026-01-01T00:00:00',
  updated_at: '2026-01-01T00:00:00',
}

const mockMessage: Message = {
  id: 'msg-1',
  conversation_id: 'conv-1',
  from_user_id: 1,
  to_user_id: 2,
  group_id: null,
  content: 'Hello!',
  message_type: 'text',
  created_at: '2026-01-01T00:00:00',
  is_read: false,
  is_favorite: false,
}

describe('ChatStore', () => {
  beforeEach(() => {
    // 重置 store 状态
    useChatStore.setState({
      conversations: [],
      messages: {},
      activeConversationId: null,
      typingUsers: {},
      isLoading: false,
    })
  })

  // ==================== Conversations 操作 ====================

  describe('Conversation 管理', () => {
    it('setConversations 设置会话列表', () => {
      const store = useChatStore.getState()
      store.setConversations([mockConversation])

      expect(useChatStore.getState().conversations).toHaveLength(1)
      expect(useChatStore.getState().conversations[0].id).toBe('conv-1')
    })

    it('addConversation 在头部添加新会话', () => {
      const store = useChatStore.getState()
      store.setConversations([mockConversation])

      const newConv: Conversation = {
        ...mockConversation,
        id: 'conv-2',
      }
      store.addConversation(newConv)

      const convs = useChatStore.getState().conversations
      expect(convs).toHaveLength(2)
      expect(convs[0].id).toBe('conv-2') // 新会话在头部
    })

    it('updateConversation 更新指定会话', () => {
      const store = useChatStore.getState()
      store.setConversations([mockConversation])

      store.updateConversation('conv-1', { unread_count: 5 })

      const conv = useChatStore.getState().conversations[0]
      expect(conv.unread_count).toBe(5)
    })

    it('updateConversation 不影响其他会话', () => {
      const store = useChatStore.getState()
      store.setConversations([
        mockConversation,
        { ...mockConversation, id: 'conv-2', unread_count: 3 },
      ])

      store.updateConversation('conv-1', { unread_count: 10 })

      const convs = useChatStore.getState().conversations
      expect(convs[0].unread_count).toBe(10)
      expect(convs[1].unread_count).toBe(3)
    })

    it('removeConversation 删除指定会话', () => {
      const store = useChatStore.getState()
      store.setConversations([mockConversation])

      store.removeConversation('conv-1')

      expect(useChatStore.getState().conversations).toHaveLength(0)
    })

    it('removeConversation 不存在的会话无影响', () => {
      const store = useChatStore.getState()
      store.setConversations([mockConversation])

      store.removeConversation('nonexistent')

      expect(useChatStore.getState().conversations).toHaveLength(1)
    })
  })

  // ==================== Messages 操作 ====================

  describe('Message 管理', () => {
    it('setMessages 设置指定会话的消息列表', () => {
      const store = useChatStore.getState()
      store.setMessages('conv-1', [mockMessage])

      expect(useChatStore.getState().messages['conv-1']).toHaveLength(1)
    })

    it('addMessage 在指定会话中添加消息', () => {
      const store = useChatStore.getState()
      store.setMessages('conv-1', [mockMessage])

      const newMsg: Message = { ...mockMessage, id: 'msg-2', content: 'World!' }
      store.addMessage('conv-1', newMsg)

      expect(useChatStore.getState().messages['conv-1']).toHaveLength(2)
      expect(useChatStore.getState().messages['conv-1'][1].content).toBe('World!')
    })

    it('addMessage 不添加重复 ID 的消息', () => {
      const store = useChatStore.getState()
      store.setMessages('conv-1', [mockMessage])

      store.addMessage('conv-1', mockMessage) // 相同 ID

      expect(useChatStore.getState().messages['conv-1']).toHaveLength(1)
    })

    it('addMessage 在空会话中添加消息', () => {
      const store = useChatStore.getState()
      store.addMessage('conv-1', mockMessage)

      expect(useChatStore.getState().messages['conv-1']).toHaveLength(1)
    })

    it('updateMessage 更新指定消息', () => {
      const store = useChatStore.getState()
      store.setMessages('conv-1', [mockMessage])

      store.updateMessage('conv-1', 'msg-1', { content: 'Updated!' })

      expect(useChatStore.getState().messages['conv-1'][0].content).toBe('Updated!')
    })

    it('markMessageAsRead 标记消息已读', () => {
      const store = useChatStore.getState()
      store.setMessages('conv-1', [mockMessage])

      store.markMessageAsRead('conv-1', 'msg-1')

      expect(useChatStore.getState().messages['conv-1'][0].is_read).toBe(true)
    })

    it('不同会话的消息互不影响', () => {
      const store = useChatStore.getState()
      store.setMessages('conv-1', [mockMessage])
      store.setMessages('conv-2', [{ ...mockMessage, conversation_id: 'conv-2' }])

      store.updateMessage('conv-1', 'msg-1', { content: 'Only conv-1' })

      expect(useChatStore.getState().messages['conv-1'][0].content).toBe('Only conv-1')
      expect(useChatStore.getState().messages['conv-2'][0].content).toBe('Hello!')
    })
  })

  // ==================== Active Conversation ====================

  describe('Active Conversation', () => {
    it('setActiveConversation 设置当前活跃会话', () => {
      const store = useChatStore.getState()
      store.setActiveConversation('conv-1')

      expect(useChatStore.getState().activeConversationId).toBe('conv-1')
    })

    it('setActiveConversation null 清除活跃会话', () => {
      const store = useChatStore.getState()
      store.setActiveConversation('conv-1')
      store.setActiveConversation(null)

      expect(useChatStore.getState().activeConversationId).toBeNull()
    })

    it('getActiveConversation 返回当前活跃会话', () => {
      const store = useChatStore.getState()
      store.setConversations([mockConversation])
      store.setActiveConversation('conv-1')

      const active = store.getActiveConversation()
      expect(active?.id).toBe('conv-1')
    })

    it('getActiveConversation 无活跃会话时返回 undefined', () => {
      const store = useChatStore.getState()
      store.setConversations([mockConversation])

      expect(store.getActiveConversation()).toBeUndefined()
    })
  })

  // ==================== Typing Status ====================

  describe('Typing 状态', () => {
    it('setTypingStatus 添加新用户打字状态', () => {
      const store = useChatStore.getState()
      store.setTypingStatus('conv-1', 1, true)

      const typing = useChatStore.getState().typingUsers['conv-1']
      expect(typing).toHaveLength(1)
      expect(typing[0].user_id).toBe(1)
      expect(typing[0].is_typing).toBe(true)
    })

    it('setTypingStatus 更新已有用户状态', () => {
      const store = useChatStore.getState()
      store.setTypingStatus('conv-1', 1, true)
      store.setTypingStatus('conv-1', 1, false)

      const typing = useChatStore.getState().typingUsers['conv-1']
      expect(typing).toHaveLength(1)
      expect(typing[0].is_typing).toBe(false)
    })

    it('多个用户打字状态', () => {
      const store = useChatStore.getState()
      store.setTypingStatus('conv-1', 1, true)
      store.setTypingStatus('conv-1', 2, true)

      const typing = useChatStore.getState().typingUsers['conv-1']
      expect(typing).toHaveLength(2)
    })
  })

  // ==================== Unread Count ====================

  describe('Unread Count', () => {
    it('getUnreadCount 计算总未读数', () => {
      const store = useChatStore.getState()
      store.setConversations([
        { ...mockConversation, id: 'conv-1', unread_count: 3 },
        { ...mockConversation, id: 'conv-2', unread_count: 5 },
      ])

      expect(store.getUnreadCount()).toBe(8)
    })

    it('无会话时未读数为 0', () => {
      const store = useChatStore.getState()
      expect(store.getUnreadCount()).toBe(0)
    })
  })

  // ==================== Loading ====================

  describe('Loading 状态', () => {
    it('setLoading 设置加载状态', () => {
      const store = useChatStore.getState()
      store.setLoading(true)
      expect(useChatStore.getState().isLoading).toBe(true)

      store.setLoading(false)
      expect(useChatStore.getState().isLoading).toBe(false)
    })
  })
})
