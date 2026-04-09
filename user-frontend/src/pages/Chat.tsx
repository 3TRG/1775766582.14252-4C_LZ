import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useChatStore } from '@/store'
import { chatApi, groupsApi } from '@/api'
import { SessionList, MessageList, MessageInput } from '@/components/chat'
import QKEStatusBadge from '@/components/chat/QKEStatusBadge'
import QuantumInfoPanel from '@/components/chat/QuantumInfoPanel'
import QKENegotiationOverlay from '@/components/chat/QKENegotiationOverlay'
import { Avatar } from '@/components/common'
import { sendTypingIndicator } from '@/websocket/handlers'
import type { Conversation } from '@/types'

export default function Chat() {
  const {
    conversations, activeConversationId, setConversations, setActiveConversation,
    messages, setMessages, addMessage, qkeNegotiation,
  } = useChatStore()
  const [showQuantumPanel, setShowQuantumPanel] = useState(false)
  const [searchParams] = useSearchParams()

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, [])

  // Handle direct navigation from Contacts/Groups
  useEffect(() => {
    const userId = searchParams.get('user_id')
    const groupId = searchParams.get('group_id')

    if (userId && conversations.length > 0) {
      const existingConv = conversations.find(
        (c) => c.type === 'private' && String(c.target_user_id) === userId
      )
      if (existingConv) {
        handleSelectConversation(existingConv)
      } else {
        // Send a message to auto-create conversation, then reload
        chatApi.sendMessage({
          to_user_id: Number(userId),
          content: '',
          message_type: 'text',
        }).catch(() => {}).then(() => loadConversations())
      }
    }

    if (groupId && conversations.length > 0) {
      const existingConv = conversations.find(
        (c) => c.type === 'group' && String(c.group_id) === groupId
      )
      if (existingConv) {
        handleSelectConversation(existingConv)
      }
    }
  }, [searchParams, conversations.length])

  const loadConversations = async () => {
    try {
      const data = await chatApi.getConversations()
      setConversations(data)
    } catch (_error) {
      // Failed to load conversations
    }
  }

  const handleSelectConversation = async (conversation: Conversation) => {
    setActiveConversation(conversation.id)

    // Load messages if not cached
    if (!messages[conversation.id]) {
      try {
        if (conversation.target_user_id) {
          const history = await chatApi.getMessageHistory(conversation.target_user_id)
          setMessages(conversation.id, history.messages)
        }
        // Group message history would need a separate endpoint
      } catch (_error) {
        // Failed to load messages
      }
    }

    // Mark as read
    if (conversation.unread_count > 0) {
      chatApi.markAsRead(conversation.id).catch(() => {})
    }
  }

  const handleSendMessage = async (content: string) => {
    if (!activeConversationId) return
    const activeConv = conversations.find(c => c.id === activeConversationId)
    if (!activeConv) return

    try {
      let message
      if (activeConv.type === 'group' && activeConv.group_id) {
        message = await groupsApi.sendGroupMessage({
          group_id: activeConv.group_id,
          content,
          message_type: 'text',
        })
      } else if (activeConv.target_user_id) {
        message = await chatApi.sendMessage({
          to_user_id: activeConv.target_user_id,
          content,
          message_type: 'text',
        })
      } else {
        return
      }
      addMessage(activeConversationId, message)
    } catch (_error) {
      // Failed to send message
    }
  }

  const handleFileSelect = async (file: File) => {
    if (!activeConversationId) return
    const activeConv = conversations.find(c => c.id === activeConversationId)
    if (!activeConv?.target_user_id) return

    try {
      const message = await chatApi.sendFile(activeConv.target_user_id, file)
      addMessage(activeConversationId, message)
    } catch (_error) {
      // Failed to send file
    }
  }

  const handleTypingStart = () => {
    if (activeConversationId) {
      sendTypingIndicator(activeConversationId, true)
    }
  }

  const handleTypingEnd = () => {
    if (activeConversationId) {
      sendTypingIndicator(activeConversationId, false)
    }
  }

  const handleToggleFavorite = async (messageId: string) => {
    try {
      await chatApi.toggleFavorite(messageId)
    } catch (_error) {
      // Favorite toggle failed
    }
  }

  const activeConversation = conversations.find(c => c.id === activeConversationId)
  const activeMessages = activeConversationId ? messages[activeConversationId] || [] : []
  const negotiation = activeConversationId ? qkeNegotiation[activeConversationId] : undefined
  const isNegotiating = activeConversation?.qke_status === 'negotiating' && negotiation

  return (
    <div className="h-full flex">
      {/* Session list */}
      <div className="w-80 bg-slate-800/30 border-r border-slate-700/50 flex flex-col">
        <div className="p-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100">消息</h2>
        </div>
        <div className="flex-1 overflow-hidden">
          <SessionList onSelect={handleSelectConversation} />
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col relative">
        {activeConversation ? (
          <>
            {/* Chat header */}
            <div className="h-16 px-6 flex items-center justify-between border-b border-slate-700/50">
              <div className="flex items-center">
                <Avatar name={activeConversation.name} size="md" />
                <div className="ml-3">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-slate-100">{activeConversation.name}</h3>
                    <QKEStatusBadge status={activeConversation.qke_status} showLabel />
                  </div>
                  <p className="text-sm text-slate-400">
                    {activeConversation.type === 'private' ? '私聊' : '群聊'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowQuantumPanel(!showQuantumPanel)}
                className={`p-2 rounded-lg transition-colors ${
                  showQuantumPanel
                    ? 'bg-indigo-600/20 text-indigo-400'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title="量子加密信息"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 flex relative overflow-hidden">
              <div className="flex-1 flex flex-col">
                <MessageList
                  messages={activeMessages}
                  conversation={activeConversation}
                  targetUser={activeConversation.target_user_id ? { user_id: activeConversation.target_user_id, username: activeConversation.name || '' } : undefined}
                  onToggleFavorite={handleToggleFavorite}
                />

                {/* Input */}
                <MessageInput
                  onSend={handleSendMessage}
                  onFileSelect={handleFileSelect}
                  onTypingStart={handleTypingStart}
                  onTypingEnd={handleTypingEnd}
                />
              </div>

              {/* Quantum info panel */}
              {showQuantumPanel && (
                <QuantumInfoPanel
                  conversation={activeConversation}
                  onClose={() => setShowQuantumPanel(false)}
                />
              )}
            </div>

            {/* QKE negotiation overlay */}
            {isNegotiating && (
              <QKENegotiationOverlay
                currentStep={negotiation.currentStep}
                totalSteps={negotiation.totalSteps}
                stepLabel={negotiation.stepLabel}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <svg className="w-20 h-20 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg">选择一个会话开始聊天</p>
          </div>
        )}
      </div>
    </div>
  )
}
