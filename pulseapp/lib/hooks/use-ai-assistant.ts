'use client'

import { useState, useCallback, useRef } from 'react'
import type { AIStreamEvent, AIConversation, AIBlock } from '@/types'

export interface PendingConfirmation {
  action_id: string
  action_type: string
  preview: string
  details?: any
  status: 'pending' | 'confirmed' | 'cancelled' | 'error'
  resultMessage?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolName?: string
  toolResult?: any
  isStreaming?: boolean
  createdAt: string
  confirmations?: PendingConfirmation[]
  blocks?: AIBlock[]
}

interface ToolExecution {
  name: string
  label: string
  status: 'running' | 'done'
  summary?: string
}

export function useAIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<AIConversation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTools, setActiveTools] = useState<ToolExecution[]>([])
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (
    text: string,
    isOnboarding = false,
    opts?: { tutorialTopic?: string; origin?: string }
  ) => {
    if (!text.trim() || isLoading) return
    setError(null)

    // Add user message to UI
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    // Start assistant placeholder
    const assistantId = `assistant-${Date.now()}`
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      createdAt: new Date().toISOString(),
    }])

    try {
      const controller = new AbortController()
      abortRef.current = controller

      const origin = opts?.origin ?? (typeof window !== 'undefined' ? window.location.pathname : undefined)
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: text,
          isOnboarding,
          origin,
          tutorialTopic: opts?.tutorialTopic,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Bir hata oluştu' }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('Stream okunamadı')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          let event: AIStreamEvent
          try {
            event = JSON.parse(jsonStr)
          } catch {
            continue
          }

          switch (event.type) {
            case 'text':
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: m.content + (event.content || '') }
                    : m
                )
              )
              break

            case 'tool_start':
              setActiveTools(prev => [
                ...prev,
                { name: event.name!, label: event.label!, status: 'running' },
              ])
              break

            case 'tool_end':
              setActiveTools(prev =>
                prev.map(t =>
                  t.name === event.name
                    ? { ...t, status: 'done', summary: event.summary }
                    : t
                )
              )
              // Clear done tools after a brief delay
              setTimeout(() => {
                setActiveTools(prev => prev.filter(t => t.status !== 'done'))
              }, 1500)
              break

            case 'block': {
              const block = (event as any).block as AIBlock | undefined
              if (block) {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantId
                      ? { ...m, blocks: [...(m.blocks || []), block] }
                      : m
                  )
                )
              }
              break
            }

            case 'confirmation_required': {
              const conf: PendingConfirmation = {
                action_id: (event as any).action_id,
                action_type: (event as any).action_type,
                preview: (event as any).preview,
                details: (event as any).details,
                status: 'pending',
              }
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId
                    ? { ...m, confirmations: [...(m.confirmations || []), conf] }
                    : m
                )
              )
              break
            }

            case 'done':
              if (event.conversationId) {
                setConversationId(event.conversationId)
              }
              // Finalize the streaming message
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId ? { ...m, isStreaming: false } : m
                )
              )
              break

            case 'error':
              setError(event.error || 'Bir hata oluştu')
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: event.error || 'Bir hata oluştu', isStreaming: false }
                    : m
                )
              )
              break

            case 'limit':
              setError(event.error || 'Mesaj limitine ulaşıldı')
              setMessages(prev => prev.filter(m => m.id !== assistantId))
              break
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return
      const msg = err.message || 'Bir hata oluştu'
      setError(msg)
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: `Hata: ${msg}`, isStreaming: false }
            : m
        )
      )
    } finally {
      setIsLoading(false)
      setActiveTools([])
      abortRef.current = null
    }
  }, [conversationId, isLoading])

  const newConversation = useCallback(() => {
    setConversationId(null)
    setMessages([])
    setActiveTools([])
    setError(null)
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ai/assistant/conversations/${id}`)
      if (!res.ok) throw new Error('Sohbet yüklenemedi')
      const data = await res.json()

      setConversationId(id)
      setMessages(
        (data.messages || [])
          .filter((m: any) => m.role !== 'tool')
          .map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content || '',
            createdAt: m.created_at,
          }))
      )
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/assistant/conversations')
      if (!res.ok) return
      const data = await res.json()
      setConversations(data.conversations || [])
    } catch {}
  }, [])

  const deleteConversation = useCallback(async (id: string) => {
    try {
      await fetch(`/api/ai/assistant/conversations/${id}`, { method: 'DELETE' })
      setConversations(prev => prev.filter(c => c.id !== id))
      if (conversationId === id) {
        newConversation()
      }
    } catch {}
  }, [conversationId, newConversation])

  const decideConfirmation = useCallback(async (actionId: string, decision: 'confirm' | 'cancel') => {
    // Optimistic: mark as processing
    setMessages(prev => prev.map(m => ({
      ...m,
      confirmations: m.confirmations?.map(c =>
        c.action_id === actionId ? { ...c, status: decision === 'confirm' ? 'confirmed' : 'cancelled' } : c
      ),
    })))

    try {
      const res = await fetch('/api/ai/assistant/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: actionId, decision }),
      })
      const json = await res.json()
      const ok = json.ok !== false
      const resultMessage = json.message || (ok ? 'Tamamlandı' : 'İşlem başarısız')

      setMessages(prev => prev.map(m => ({
        ...m,
        confirmations: m.confirmations?.map(c =>
          c.action_id === actionId
            ? {
                ...c,
                status: ok ? (decision === 'confirm' ? 'confirmed' : 'cancelled') : 'error',
                resultMessage,
              }
            : c
        ),
      })))
    } catch (err: any) {
      setMessages(prev => prev.map(m => ({
        ...m,
        confirmations: m.confirmations?.map(c =>
          c.action_id === actionId ? { ...c, status: 'error', resultMessage: err.message || 'Hata' } : c
        ),
      })))
    }
  }, [])

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
    setIsLoading(false)
  }, [])

  return {
    messages,
    conversationId,
    conversations,
    isLoading,
    activeTools,
    error,
    sendMessage,
    newConversation,
    loadConversation,
    loadConversations,
    deleteConversation,
    stopGeneration,
    decideConfirmation,
  }
}
