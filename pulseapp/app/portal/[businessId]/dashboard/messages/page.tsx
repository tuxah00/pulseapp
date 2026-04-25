'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Send, Loader2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PortalMessage {
  id: string
  direction: 'inbound' | 'outbound'
  channel: string
  content: string
  staff_name: string | null
  created_at: string
  is_read: boolean
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function formatDateGroup(iso: string): string {
  try {
    const d = new Date(iso)
    const today = new Date()
    const yest = new Date()
    yest.setDate(today.getDate() - 1)
    const ymd = (x: Date) => x.toISOString().slice(0, 10)
    if (ymd(d) === ymd(today)) return 'Bugün'
    if (ymd(d) === ymd(yest)) return 'Dün'
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

export default function PortalMessagesPage() {
  const [messages, setMessages] = useState<PortalMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/messages')
      if (!res.ok) return
      const data = await res.json()
      setMessages(data.messages || [])
    } catch {
      /* sessiz */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 10_000)
    return () => clearInterval(interval)
  }, [fetchMessages])

  // Yeni mesaj geldiğinde aşağı kaydır
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault()
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/portal/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Mesaj gönderilemedi')
        return
      }
      setText('')
      // Yeni mesajı listeye ekle (optimistic)
      if (data.message) {
        setMessages((prev) => [...prev, data.message])
      } else {
        await fetchMessages()
      }
    } catch {
      setError('Bağlantı hatası')
    } finally {
      setSending(false)
    }
  }

  // Tarih bazlı grupla
  const grouped: Array<{ key: string; label: string; items: PortalMessage[] }> = []
  for (const m of messages) {
    const key = m.created_at.slice(0, 10)
    const last = grouped[grouped.length - 1]
    if (last && last.key === key) {
      last.items.push(m)
    } else {
      grouped.push({ key, label: formatDateGroup(m.created_at), items: [m] })
    }
  }

  return (
    <div className="max-w-2xl mx-auto h-[calc(100vh-180px)] lg:h-[calc(100vh-130px)] flex flex-col">
      <header className="mb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mesajlar</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Salonla iletişime geçin
        </p>
      </header>

      <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        {/* Mesaj akışı */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="h-12 w-12 rounded-full bg-pulse-50 dark:bg-pulse-900/30 flex items-center justify-center mb-3">
                <MessageSquare className="h-6 w-6 text-pulse-900/70 dark:text-pulse-300" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                Henüz mesajınız yok. İlk mesajı yazarak salonla iletişime geçebilirsiniz.
              </p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.key} className="space-y-2">
                <div className="flex items-center justify-center">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 px-2.5 py-0.5 rounded-full bg-gray-50 dark:bg-gray-800">
                    {group.label}
                  </span>
                </div>
                {group.items.map((m) => {
                  const isMine = m.direction === 'inbound'
                  return (
                    <div
                      key={m.id}
                      className={cn('flex', isMine ? 'justify-end' : 'justify-start')}
                    >
                      <div
                        className={cn(
                          'max-w-[78%] px-3.5 py-2 rounded-2xl text-sm',
                          isMine
                            ? 'bg-pulse-900 text-white rounded-br-md'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md'
                        )}
                      >
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                        <div
                          className={cn(
                            'text-[10px] mt-1 flex items-center gap-1.5',
                            isMine ? 'text-white/70' : 'text-gray-500 dark:text-gray-400'
                          )}
                        >
                          {!isMine && m.staff_name && <span>{m.staff_name}</span>}
                          <span className="tabular-nums">{formatTime(m.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Compose */}
        <form
          onSubmit={handleSend}
          className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 px-3 py-2.5 flex items-end gap-2 bg-white dark:bg-gray-900"
        >
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Mesajınızı yazın..."
            className="flex-1 resize-none px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pulse-900/20 focus:border-pulse-900 max-h-32"
          />
          <button
            type="submit"
            disabled={!text.trim() || sending}
            className="p-2.5 rounded-xl bg-pulse-900 text-white hover:bg-pulse-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Gönder"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>
        {error && (
          <div className="px-4 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-t border-red-100 dark:border-red-800">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
