import { useEffect, useRef } from 'react'
import type { Message } from '@/types'

interface MessageContextMenuProps {
  message: Message
  position: { x: number; y: number }
  onClose: () => void
  onToggleFavorite: (messageId: string) => void
  onDelete: (messageId: string) => void
}

export default function MessageContextMenu({
  message,
  position,
  onClose,
  onToggleFavorite,
  onDelete,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).catch(() => {})
    onClose()
  }

  const handleFavorite = () => {
    onToggleFavorite(message.id)
    onClose()
  }

  const handleDelete = () => {
    onDelete(message.id)
    onClose()
  }

  // Adjust position to keep menu in viewport
  const style = {
    left: Math.min(position.x, window.innerWidth - 180),
    top: Math.min(position.y, window.innerHeight - 200),
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[140px] py-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg animate-scaleIn"
      style={style}
    >
      <button
        onClick={handleCopy}
        className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
        </svg>
        复制文本
      </button>
      <button
        onClick={handleFavorite}
        className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill={message.is_favorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
        {message.is_favorite ? '取消收藏' : '收藏'}
      </button>
      <div className="my-1 border-t border-slate-700" />
      <button
        onClick={handleDelete}
        className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-slate-700/50 flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        删除
      </button>
    </div>
  )
}
