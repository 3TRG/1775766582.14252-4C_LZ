import { useChatStore } from '@/store'
import { Avatar } from '@/components/common'
import QKEStatusBadge from './QKEStatusBadge'
import { formatTime, truncateText } from '@/utils/format'
import type { Conversation } from '@/types'

interface SessionListProps {
  onSelect: (conversation: Conversation) => void
}

export default function SessionList({ onSelect }: SessionListProps) {
  const { conversations, activeConversationId, isLoading } = useChatStore()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p className="text-sm">暂无会话</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      {conversations.map((conversation) => (
        <div
          key={conversation.id}
          onClick={() => onSelect(conversation)}
          className={`flex items-center p-3 cursor-pointer transition-colors ${
            activeConversationId === conversation.id
              ? 'bg-indigo-600/20'
              : 'hover:bg-slate-800'
          }`}
        >
          <Avatar
            name={conversation.name}
            size="md"
          />
          <div className="ml-3 flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-medium text-slate-100 truncate">
                  {conversation.name || '未知会话'}
                </span>
                <QKEStatusBadge status={conversation.qke_status} />
              </div>
              {conversation.last_message && (
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {formatTime(conversation.last_message.created_at)}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-sm text-slate-400 truncate">
                {conversation.last_message
                  ? truncateText(conversation.last_message.content, 30)
                  : '暂无消息'}
              </p>
              {conversation.unread_count > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
