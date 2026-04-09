import { WS_BASE_URL, WS_MESSAGE_TYPES } from '@/utils/constants'
import type { Message } from '@/types'

export interface WSMessage {
  type: keyof typeof WS_MESSAGE_TYPES
  data: unknown
  timestamp: string
}

export interface UserStatusData {
  user_id: number
  status: 'online' | 'offline'
  last_seen: string
}

export interface QKEEventData {
  session_id: string
  event_type: string
  participants: number[]
  key_fingerprint?: string
  entropy?: number
}

type MessageHandler<T = unknown> = (data: T) => void

class WebSocketClient {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private heartbeatInterval: number | null = null
  private eventHandlers = new Map<string, Set<MessageHandler>>()
  private connectionPromise: Promise<void> | null = null

  async connect(token: string): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    if (this.connectionPromise) {
      return this.connectionPromise
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      const wsUrl = `${WS_BASE_URL}/ws/user?token=${token}`

      try {
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected')
          this.reconnectAttempts = 0
          this.startHeartbeat()
          this.connectionPromise = null
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            console.error('[WebSocket] Failed to parse message:', error)
          }
        }

        this.ws.onclose = (event) => {
          console.log('[WebSocket] Disconnected:', event.code, event.reason)
          this.stopHeartbeat()
          this.connectionPromise = null
          this.handleReconnect(token)
        }

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error)
          this.connectionPromise = null
          reject(error)
        }
      } catch (error) {
        this.connectionPromise = null
        reject(error)
      }
    })

    return this.connectionPromise
  }

  disconnect(): void {
    this.stopHeartbeat()
    if (this.ws) {
      this.ws.close(1000, 'User disconnected')
      this.ws = null
    }
    this.eventHandlers.clear()
  }

  emit(type: string, data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }))
    } else {
      console.warn('[WebSocket] Cannot send message: connection not open')
    }
  }

  on<T = unknown>(event: string, handler: MessageHandler<T>): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler as MessageHandler)

    // Return unsubscribe function
    return () => {
      this.off(event, handler)
    }
  }

  off<T = unknown>(event: string, handler: MessageHandler<T>): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.delete(handler as MessageHandler)
    }
  }

  private handleMessage(message: WSMessage): void {
    const handlers = this.eventHandlers.get(message.type)
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(message.data)
        } catch (error) {
          console.error(`[WebSocket] Handler error for ${message.type}:`, error)
        }
      })
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
      }
    }, 30000) // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private handleReconnect(token: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`)

    setTimeout(() => {
      this.connect(token).catch((error) => {
        console.error('[WebSocket] Reconnect failed:', error)
      })
    }, delay)
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

export const wsClient = new WebSocketClient()
