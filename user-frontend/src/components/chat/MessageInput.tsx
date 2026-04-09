import { useState, useRef, KeyboardEvent, DragEvent } from 'react'
import { Button } from '@/components/common'

interface MessageInputProps {
  onSend: (content: string) => void
  onFileSelect: (file: File) => void
  onTypingStart?: () => void
  onTypingEnd?: () => void
  disabled?: boolean
}

export default function MessageInput({ onSend, onFileSelect, onTypingStart, onTypingEnd, disabled }: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<number | null>(null)

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim())
      setMessage('')
      handleTypingEnd()
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInputChange = (value: string) => {
    setMessage(value)

    // Handle typing indicator
    if (!isTyping && value.length > 0) {
      setIsTyping(true)
      onTypingStart?.()
    }

    // Reset typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      handleTypingEnd()
    }, 2000)
  }

  const handleTypingEnd = () => {
    if (isTyping) {
      setIsTyping(false)
      onTypingEnd?.()
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }
  }

  const handleFileClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onFileSelect(file)
      e.target.value = ''
    }
  }

  // Drag and drop handlers
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      onFileSelect(file)
    }
  }

  return (
    <div
      className={`relative p-4 border-t border-slate-700/50 ${isDragOver ? 'bg-indigo-600/10' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-indigo-600/10 border-2 border-dashed border-indigo-500 rounded-lg z-10">
          <div className="text-center">
            <svg className="w-8 h-8 text-indigo-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-indigo-300">松开以发送文件</p>
          </div>
        </div>
      )}

      <div className="flex items-end space-x-2">
        {/* File upload button */}
        <button
          onClick={handleFileClick}
          className="p-2 text-slate-400 hover:text-slate-200 transition-colors"
          title="发送文件"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Message input */}
        <div className="flex-1">
          <textarea
            value={message}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
            disabled={disabled}
            rows={1}
            className="w-full px-4 py-2 bg-slate-800/50 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* Send button */}
        <Button onClick={handleSend} disabled={disabled || !message.trim()}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </Button>
      </div>
    </div>
  )
}
