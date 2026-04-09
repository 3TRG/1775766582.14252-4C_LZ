import { useEffect, useState } from 'react'
import { chatApi } from '@/api'
import { Avatar } from '@/components/common'
import { formatTime } from '@/utils/format'
import type { Message } from '@/types'

export default function Favorites() {
  const [favorites, setFavorites] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    loadFavorites()
  }, [])

  const loadFavorites = async () => {
    try {
      setIsLoading(true)
      const data = await chatApi.getFavoriteMessages()
      setFavorites(data)
    } catch (error) {
      console.error('Failed to load favorites:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveFavorite = async (messageId: string) => {
    try {
      await chatApi.toggleFavorite(messageId)
      setFavorites(favorites.filter((m) => m.id !== messageId))
    } catch (error) {
      console.error('Failed to remove favorite:', error)
    }
  }

  return (
    <div className="h-full p-6 overflow-y-auto">
      <h2 className="text-xl font-semibold text-slate-100 mb-6">收藏</h2>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
        </div>
      ) : favorites.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <svg className="w-16 h-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <p>暂无收藏</p>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map((message) => (
            <div
              key={message.id}
              className="quantum-card p-4 flex items-start"
            >
              <Avatar name={`用户${message.from_user_id}`} size="sm" className="mr-3" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-400">用户 {message.from_user_id}</span>
                  <span className="text-xs text-slate-500">{formatTime(message.created_at)}</span>
                </div>
                <p className="text-slate-100">{message.content}</p>
              </div>
              <button
                onClick={() => handleRemoveFavorite(message.id)}
                className="ml-3 p-1 text-yellow-400 hover:text-yellow-300"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
