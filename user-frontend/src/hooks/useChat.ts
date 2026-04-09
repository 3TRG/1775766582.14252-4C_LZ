import { useCallback } from 'react'
import { useChatStore } from '@/store/chatStore'
import { chatApi } from '@/api'
import { getErrorMessage } from '@/api/client'
import type { SendMessageRequest } from '@/types'

export function useChat() {
  const {
    conversations,
    messages,
    activeConversationId,
    isLoading,
    setConversations,
    addMessage,
    setActiveConversation,
    setMessages,
    setLoading,
    getActiveConversation,
  } = useChatStore()

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true)
      const data = await chatApi.getConversations()
      setConversations(data)
    } catch (error) {
      console.error('Failed to load conversations:', getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [setConversations, setLoading])

  const loadMessages = useCallback(
    async (toUserId: number) => {
      try {
        setLoading(true)
        const data = await chatApi.getMessageHistory(toUserId)
        // Messages are keyed by conversation ID, but we'll use a composite key
        return data.messages
      } catch (error) {
        console.error('Failed to load messages:', getErrorMessage(error))
        return []
      } finally {
        setLoading(false)
      }
    },
    [setLoading]
  )

  const sendMessage = useCallback(
    async (data: SendMessageRequest) => {
      try {
        const message = await chatApi.sendMessage(data)
        // The message will also come through WebSocket, but we add it optimistically
        return { success: true, message }
      } catch (error) {
        return { success: false, error: getErrorMessage(error) }
      }
    },
    []
  )

  const sendFile = useCallback(async (toUserId: number, file: File) => {
    try {
      const message = await chatApi.sendFile(toUserId, file)
      return { success: true, message }
    } catch (error) {
      return { success: false, error: getErrorMessage(error) }
    }
  }, [])

  return {
    conversations,
    messages,
    activeConversationId,
    isLoading,
    activeConversation: getActiveConversation(),
    loadConversations,
    loadMessages,
    sendMessage,
    sendFile,
    setActiveConversation,
    addMessage,
    setMessages,
  }
}
