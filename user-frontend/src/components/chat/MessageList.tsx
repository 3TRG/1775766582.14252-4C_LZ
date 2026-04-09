import { useRef, useEffect, useState, useCallback, MouseEvent as ReactMouseEvent } from 'react'
import { useAuthStore, useChatStore } from '@/store'
import { Avatar } from '@/components/common'
import TypingIndicator from './TypingIndicator'
import MessageContextMenu from './MessageContextMenu'
import { formatTime, formatFileSize } from '@/utils/format'
import type { Conversation, Message } from '@/types'

interface MessageListProps {
  messages: Message[]
  conversation: Conversation | undefined
  targetUser?: { user_id: number; username: string; avatar?: string }
  onToggleFavorite?: (messageId: string) => void
}

export default function MessageList({ messages, conversation, targetUser, onToggleFavorite }: MessageListProps) {
  const { user } = useAuthStore()
  const { typingUsers, updateMessage } = useChatStore()
  const listRef = useRef<HTMLDivElement>(null)
  const [contextMenu, setContextMenu] = useState<{
    message: Message
    position: { x: number; y: number }
  } | null>(null)

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages.length])

  const renderMessageContent = (message: Message) => {
    switch (message.message_type) {
      case 'image':
        return (
          <img
            src={message.file_url}
            alt="图片"
            className="max-w-xs rounded-lg"
          />
        )
      case 'file':
        return (
          <a
            href={message.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <svg className="w-8 h-8 text-indigo-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <p className="text-sm text-slate-100">{message.file_name}</p>
              <p className="text-xs text-slate-400">
                {message.file_size && formatFileSize(message.file_size)}
              </p>
            </div>
          </a>
        )
      default:
        return <p className="text-slate-100 whitespace-pre-wrap">{message.content}</p>
    }
  }

  const renderReadReceipt = (message: Message) => {
    if (message.from_user_id !== user?.user_id) return null

    if (message.is_read) {
      return (
        <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12l2 2 4-4" />
        </svg>
      )
    }

    return (
      <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    )
  }

  const handleContextMenu = useCallback((e: ReactMouseEvent, message: Message) => {
    e.preventDefault()
    setContextMenu({
      message,
      position: { x: e.clientX, y: e.clientY },
    })
  }, [])

  const handleToggleFavorite = useCallback((messageId: string) => {
    if (onToggleFavorite) {
      onToggleFavorite(messageId)
    } else if (conversation?.id) {
      const msg = messages.find((m) => m.id === messageId)
      if (msg) {
        updateMessage(conversation.id, messageId, { is_favorite: !msg.is_favorite })
      }
    }
  }, [onToggleFavorite, conversation?.id, messages, updateMessage])

  const handleDelete = useCallback((_messageId: string) => {
    // TODO: Call delete API when backend endpoint is available
  }, [])

  // Get typing usernames for this conversation
  const convId = conversation?.id || ''
  const typing = typingUsers[convId] || []
  const typingUsernames = typing
    .filter((t) => t.is_typing && t.user_id !== user?.user_id)
    .map((t) => t.username || `用户${t.user_id}`)

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
        <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p>开始聊天吧</p>
      </div>
    )
  }

  const isQKEActive = conversation?.qke_status === 'active'

  return (
    <>
      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Encryption notice */}
        {isQKEActive && (
          <div className="flex items-center justify-center gap-1.5 py-1 px-3 mx-auto w-fit rounded-full bg-green-500/10 border border-green-500/20">
            <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-[11px] text-green-400">消息已加密 · AES-256-GCM</span>
          </div>
        )}

        {messages.map((message) => {
          const isOwn = message.from_user_id === user?.user_id
          const sender = isOwn ? user : targetUser

          return (
            <div
              key={message.id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'} animate-messageIn`}
            >
              {!isOwn && (
                <Avatar name={sender?.username} src={sender?.avatar} size="sm" className="mr-2" />
              )}
              <div className={`max-w-md ${isOwn ? 'order-first' : ''}`}>
                <div
                  className={`px-4 py-2 rounded-lg relative group ${
                    isOwn
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-700 text-slate-100'
                  }`}
                  onContextMenu={(e) => handleContextMenu(e, message)}
                >
                  {renderMessageContent(message)}
                  {/* Encryption indicator */}
                  {isQKEActive && (
                    <svg className="w-3 h-3 absolute top-1.5 right-1.5 opacity-30 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  )}
                  {/* Favorite indicator */}
                  {message.is_favorite && (
                    <svg className="w-3.5 h-3.5 absolute -top-1 -right-1 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  )}
                </div>
                <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                  <p className="text-xs text-slate-500">
                    {formatTime(message.created_at)}
                  </p>
                  {renderReadReceipt(message)}
                </div>
              </div>
            </div>
          )
        })}

        {/* Typing indicator */}
        <TypingIndicator usernames={typingUsernames} />
      </div>

      {/* Context menu */}
      {contextMenu && (
        <MessageContextMenu
          message={contextMenu.message}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onToggleFavorite={handleToggleFavorite}
          onDelete={handleDelete}
        />
      )}
    </>
  )
}
