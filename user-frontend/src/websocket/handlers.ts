import { wsClient } from './client'
import { useChatStore } from '@/store/chatStore'
import { useContactsStore } from '@/store/contactsStore'
import type { Message } from '@/types'

// Setup WebSocket message handlers
export function setupWebSocketHandlers() {
  // Handle new messages
  wsClient.on<Message>('message', (data) => {
    const { addMessage, activeConversationId } = useChatStore.getState()
    addMessage(data.conversation_id, data)

    // Mark as read if in active conversation
    if (data.conversation_id === activeConversationId) {
      wsClient.emit('read_receipt', {
        conversation_id: data.conversation_id,
        message_id: data.id,
      })
    }
  })

  // Handle user status changes
  wsClient.on<{ user_id: number; status: 'online' | 'offline' }>('status', (data) => {
    const { updateContactStatus } = useContactsStore.getState()
    updateContactStatus(data.user_id, data.status)
  })

  // Handle typing indicators
  wsClient.on<{ conversation_id: string; user_id: number; is_typing: boolean }>('typing', (data) => {
    const { setTypingStatus } = useChatStore.getState()
    setTypingStatus(data.conversation_id, data.user_id, data.is_typing)
  })

  // Handle read receipts
  wsClient.on<{ conversation_id: string; message_id: string; user_id: number }>('read_receipt', (data) => {
    const { markMessageAsRead } = useChatStore.getState()
    markMessageAsRead(data.conversation_id, data.message_id)
  })

  // Handle notifications
  wsClient.on<{ type: string; title: string; content: string }>('notification', (data) => {
    // Show browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(data.title, { body: data.content })
    }
  })
}

// Send typing indicator
export function sendTypingIndicator(conversationId: string, isTyping: boolean) {
  wsClient.emit('typing', {
    conversation_id: conversationId,
    is_typing: isTyping,
  })
}
