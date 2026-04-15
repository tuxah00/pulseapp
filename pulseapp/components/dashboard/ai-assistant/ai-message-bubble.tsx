'use client'

import { Bot, Check, User, X, Loader2, AlertTriangle } from 'lucide-react'
import type { ChatMessage } from '@/lib/hooks/use-ai-assistant'
import AITableBlock from './ai-table-block'
import AIStatCards from './ai-stat-cards'
import AIChartBlock from './ai-chart-block'

interface Props {
  message: ChatMessage
  onConfirm?: (actionId: string, decision: 'confirm' | 'cancel') => void
}

export default function AIMessageBubble({ message, onConfirm }: Props) {
  const isUser = message.role === 'user'
  const confirmations = message.confirmations || []
  const blocks = message.blocks || []

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

      {/* Bubble + Confirmations */}
      <div
        className={`flex flex-col gap-2 ${isUser ? 'items-end max-w-[85%]' : 'items-stretch w-full max-w-[95%]'}`}
      >
        {(message.content || message.isStreaming) && (
          <div
            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
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
        )}

        {/* Rich UI blocks (Faz 9) */}
        {!isUser && blocks.map((block, i) => {
          if (block.type === 'table') return <AITableBlock key={i} block={block} />
          if (block.type === 'stat_cards') return <AIStatCards key={i} block={block} />
          if (block.type === 'chart') return <AIChartBlock key={i} block={block} />
          return null
        })}

        {/* Confirmation cards */}
        {confirmations.map(conf => (
          <ConfirmationCard key={conf.action_id} conf={conf} onDecide={onConfirm} />
        ))}
      </div>
    </div>
  )
}

function ConfirmationCard({
  conf,
  onDecide,
}: {
  conf: NonNullable<ChatMessage['confirmations']>[number]
  onDecide?: (actionId: string, decision: 'confirm' | 'cancel') => void
}) {
  const isPending = conf.status === 'pending'
  const isConfirmed = conf.status === 'confirmed'
  const isCancelled = conf.status === 'cancelled'
  const isError = conf.status === 'error'

  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm w-full ${
        isError
          ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
          : isConfirmed
          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
          : isCancelled
          ? 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 opacity-70'
          : 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
      }`}
    >
      <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-100 mb-2.5">
        {conf.preview}
      </div>

      {isPending && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onDecide?.(conf.action_id, 'confirm')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-pulse-900 text-white text-xs font-medium hover:bg-pulse-900/90 transition"
          >
            <Check className="w-3.5 h-3.5" /> Onayla
          </button>
          <button
            type="button"
            onClick={() => onDecide?.(conf.action_id, 'cancel')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            <X className="w-3.5 h-3.5" /> İptal
          </button>
        </div>
      )}

      {isConfirmed && (
        <div className="flex items-center gap-1.5 text-green-700 dark:text-green-300 text-xs font-medium">
          {conf.resultMessage ? <Check className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {conf.resultMessage || 'İşleniyor...'}
        </div>
      )}

      {isCancelled && (
        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400 text-xs">
          <X className="w-3.5 h-3.5" /> İptal edildi
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-1.5 text-red-700 dark:text-red-300 text-xs font-medium">
          <AlertTriangle className="w-3.5 h-3.5" /> {conf.resultMessage || 'Hata oluştu'}
        </div>
      )}
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
