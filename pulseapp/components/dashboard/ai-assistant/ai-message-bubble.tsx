'use client'

import { Bot, User } from 'lucide-react'
import type { ChatMessage } from '@/lib/hooks/use-ai-assistant'

interface Props {
  message: ChatMessage
}

export default function AIMessageBubble({ message }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-pulse-900 text-white'
            : 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      {/* Bubble */}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'bg-pulse-900 text-white rounded-tr-md'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-tl-md'
        }`}
      >
        {message.isStreaming && !message.content ? (
          <div className="flex gap-1 py-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words">
            {formatContent(message.content)}
          </div>
        )}
      </div>
    </div>
  )
}

function formatContent(text: string): React.ReactNode {
  if (!text) return null

  // Simple markdown-like formatting
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}
