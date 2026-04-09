import { useEffect, useCallback } from 'react'
import { wsClient, setupWebSocketHandlers } from '@/websocket'
import { useAuthStore } from '@/store/authStore'

export function useWebSocket() {
  const { token, isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!token || !isAuthenticated) return

    // Connect WebSocket
    wsClient.connect(token).catch(console.error)

    // Setup message handlers
    const cleanup = setupWebSocketHandlers()

    return () => {
      cleanup()
      wsClient.disconnect()
    }
  }, [token, isAuthenticated])

  const sendMessage = useCallback((type: string, data: unknown) => {
    wsClient.emit(type, data)
  }, [])

  const isConnected = wsClient.isConnected

  return {
    isConnected,
    sendMessage,
  }
}
