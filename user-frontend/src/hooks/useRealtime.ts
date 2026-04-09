import { useEffect } from 'react'
import { wsClient } from '@/websocket'
import { useAuthStore } from '@/store/authStore'
import { useChatStore } from '@/store/chatStore'
import { useContactsStore } from '@/store/contactsStore'
import type { Message } from '@/types'

interface QKEEventPayload {
  session_id: string
  conversation_id?: string
  event_type: string
  stage?: string
  step?: number
  total_steps?: number
  description?: string
  [key: string]: unknown
}

export function useRealtime() {
  const { token, isAuthenticated } = useAuthStore()
  const { addMessage, setTypingStatus, updateQKENegotiation, updateConversation } = useChatStore()
  const { updateContactStatus } = useContactsStore()

  useEffect(() => {
    if (!token || !isAuthenticated) return

    // Connect WebSocket
    wsClient.connect(token).catch(() => {})

    // Handle new messages
    const unsubMessage = wsClient.on<Message>('message', (data) => {
      addMessage(data.conversation_id, data)
    })

    // Handle user status changes
    const unsubStatus = wsClient.on<{ user_id: number; status: 'online' | 'offline' }>(
      'status',
      (data) => {
        updateContactStatus(data.user_id, data.status)
      }
    )

    // Handle typing indicators
    const unsubTyping = wsClient.on<{
      conversation_id: string
      user_id: number
      is_typing: boolean
      username?: string
    }>('typing', (data) => {
      setTypingStatus(data.conversation_id, data.user_id, data.is_typing, data.username)
    })

    // Handle QKE events
    const unsubQKE = wsClient.on<QKEEventPayload>('qke_event', (data) => {
      // Map QKE event types to negotiation steps
      const stageLabels: Record<string, string> = {
        session_created: '会话已创建',
        participant_detected: '参与者检测',
        protocol_selected: '协议选择',
        quantum_prepared: '量子态制备',
        measurement_done: '量子测量与筛选',
        qber_calculated: 'QBER 计算',
        key_reconciled: '密钥协商完成',
        epoch_activated: '密钥纪元已激活',
      }

      const steps = ['session_created', 'participant_detected', 'protocol_selected', 'quantum_prepared', 'measurement_done', 'qber_calculated', 'key_reconciled']
      const stepIndex = steps.indexOf(data.event_type)
      const convId = data.conversation_id || ''

      if (convId) {
        updateQKENegotiation(convId, {
          currentStep: stepIndex >= 0 ? stepIndex + 1 : 0,
          totalSteps: steps.length,
          stepLabel: stageLabels[data.event_type] || data.description || '处理中...',
          sessionId: data.session_id,
        })

        // Update conversation QKE status based on event
        if (data.event_type === 'epoch_activated') {
          updateConversation(convId, { qke_status: 'active' })
        } else if (data.event_type === 'session_created') {
          updateConversation(convId, { qke_status: 'negotiating' })
        }
      }
    })

    return () => {
      unsubMessage()
      unsubStatus()
      unsubTyping()
      unsubQKE()
      wsClient.disconnect()
    }
  }, [token, isAuthenticated, addMessage, updateContactStatus, setTypingStatus, updateQKENegotiation, updateConversation])
}
