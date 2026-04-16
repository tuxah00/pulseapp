'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Bot, X, Minimize2, Send, Plus, ChevronDown, Trash2, StopCircle,
  MessageSquare, Settings, Sparkles, Mic,
} from 'lucide-react'
import { useAIAssistant } from '@/lib/hooks/use-ai-assistant'
import { useTutorial } from '@/lib/hooks/use-tutorial'
import { getSmartPrompts } from '@/lib/ai/quick-prompts'
import AIMessageBubble from './ai-message-bubble'
import AIToolIndicator from './ai-tool-indicator'
import AIAssistantButton from './ai-assistant-button'
import TutorialBubble from './tutorial-bubble'
import type { SectorType, PlanType, StaffPermissions } from '@/types'

interface Props {
  businessName: string
  sector: SectorType
  plan: PlanType
  permissions: StaffPermissions
}

export default function AIAssistantPanel({ businessName, sector, plan, permissions }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [input, setInput] = useState('')
  const [showConversations, setShowConversations] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const {
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
  } = useAIAssistant()

  const {
    currentTopic,
    shouldShowBubble,
    shouldRunSetup,
    markSeen,
    markSetupDone,
  } = useTutorial(sector)

  const [setupTriggered, setSetupTriggered] = useState(false)
  const [recorderState, setRecorderState] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Saate göre yeniden hesaplanır; panel yeniden açıldığında güncellenir.
  const smartPrompts = useMemo(() => getSmartPrompts({ sector }), [sector, isOpen])

  const toggleDictation = useCallback(async () => {
    if (recorderState === 'recording') {
      mediaRecorderRef.current?.stop()
      return
    }
    if (recorderState !== 'idle') return

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      return
    }

    const recorder = new MediaRecorder(stream)
    chunksRef.current = []

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }

    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      if (blob.size < 1000) { setRecorderState('idle'); return }

      setRecorderState('transcribing')
      const form = new FormData()
      form.append('audio', blob, 'audio.webm')
      try {
        const res = await fetch('/api/ai/transcribe', { method: 'POST', body: form })
        const data = await res.json()
        if (data.text?.trim()) {
          setInput(prev => prev ? `${prev} ${data.text.trim()}` : data.text.trim())
        } else if (data.error) {
          console.error('[Transcribe]', data.error)
        }
      } catch (err) {
        console.error('[Transcribe] fetch hatası:', err)
      } finally {
        setRecorderState('idle')
      }
    }

    recorder.start(250)
    mediaRecorderRef.current = recorder
    setRecorderState('recording')
  }, [recorderState])

  // Panel kapanınca aktif kaydı durdur
  useEffect(() => {
    if (!isOpen && recorderState === 'recording') {
      try { mediaRecorderRef.current?.stop() } catch {}
    }
  }, [isOpen, recorderState])

  // Yeni personel için kurulum sihirbazını otomatik başlat (dashboard'da, ilk kez)
  useEffect(() => {
    if (shouldRunSetup && !setupTriggered && !isOpen) {
      setSetupTriggered(true)
      setIsOpen(true)
      newConversation()
      sendMessage('PulseApp kurulumuna yardım et', true)
      markSetupDone()
    }
  }, [shouldRunSetup, setupTriggered, isOpen, newConversation, sendMessage, markSetupDone])

  const handleOpenTutorial = useCallback(() => {
    if (!currentTopic) return
    setIsOpen(true)
    setIsMinimized(false)
    newConversation()
    sendMessage(`"${currentTopic.title}" sayfasını tanıt`, false, { tutorialTopic: currentTopic.pageKey })
    markSeen(currentTopic.pageKey)
  }, [currentTopic, newConversation, sendMessage, markSeen])

  const handleDismissBubble = useCallback(() => {
    if (!currentTopic) return
    markSeen(currentTopic.pageKey)
  }, [currentTopic, markSeen])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, activeTools])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [isOpen, isMinimized])

  // Keyboard shortcut: Ctrl+Shift+A
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        setIsOpen(prev => !prev)
        setIsMinimized(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // Load conversations when panel opens
  useEffect(() => {
    if (isOpen) loadConversations()
  }, [isOpen, loadConversations])

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return
    const text = input.trim()
    setInput('')
    sendMessage(text)
  }, [input, isLoading, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleQuickPrompt = (prompt: string) => {
    sendMessage(prompt)
  }

  if (!isOpen) {
    return (
      <>
        <AIAssistantButton onClick={() => setIsOpen(true)} />
        <AnimatePresence>
          {shouldShowBubble && currentTopic && (
            <TutorialBubble
              topic={currentTopic}
              onOpen={handleOpenTutorial}
              onDismiss={handleDismissBubble}
            />
          )}
        </AnimatePresence>
      </>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          height: isMinimized ? 56 : undefined,
        }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-[55] w-full sm:w-[420px] flex flex-col bg-white dark:bg-gray-900 sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        style={{ height: isMinimized ? 56 : 'min(600px, calc(100vh - 80px))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            <span className="font-semibold text-sm">PulseApp Asistan</span>
          </div>
          <div className="flex items-center gap-1">
            <Link
              href="/dashboard/settings/ai"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              title="AI Tercihleri"
            >
              <Settings className="w-4 h-4" />
            </Link>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              title={isMinimized ? 'Genişlet' : 'Küçült'}
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              title="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex-shrink-0">
              <div className="relative">
                <button
                  onClick={() => setShowConversations(!showConversations)}
                  className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>{conversationId ? 'Sohbetler' : 'Yeni Sohbet'}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {/* Conversation dropdown */}
                {showConversations && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowConversations(false)} />
                    <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-20 max-h-60 overflow-y-auto">
                      {conversations.length === 0 ? (
                        <p className="px-3 py-4 text-xs text-gray-500 text-center">Henüz sohbet yok</p>
                      ) : (
                        conversations.map(conv => (
                          <div
                            key={conv.id}
                            className={`flex items-center justify-between px-3 py-2.5 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                              conv.id === conversationId ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''
                            }`}
                          >
                            <span
                              className="truncate flex-1 text-gray-700 dark:text-gray-300"
                              onClick={() => {
                                loadConversation(conv.id)
                                setShowConversations(false)
                              }}
                            >
                              {conv.title || 'Başlıksız'}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteConversation(conv.id)
                              }}
                              className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 ml-2 flex-shrink-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={() => {
                  newConversation()
                  setShowConversations(false)
                }}
                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Yeni</span>
              </button>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center mb-4">
                    <Sparkles className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    Merhaba! Ben PulseApp Asistanınızım
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
                    Randevularınız, müşterileriniz, hizmetleriniz ve daha fazlası hakkında bana soru sorabilirsiniz.
                  </p>
                  <div className="grid grid-cols-1 gap-2 w-full">
                    {smartPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleQuickPrompt(prompt)}
                        className="text-left text-xs px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <AIMessageBubble key={msg.id} message={msg} onConfirm={decideConfirmation} />
                  ))}
                </>
              )}

              <AIToolIndicator tools={activeTools} />
              <div ref={messagesEndRef} />
            </div>

            {/* Error message */}
            {error && (
              <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 flex-shrink-0">
                <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Input area */}
            <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-3 bg-white dark:bg-gray-900 flex-shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={recorderState === 'recording' ? 'Kaydediliyor...' : recorderState === 'transcribing' ? 'Çevriliyor...' : 'Mesajınızı yazın...'}
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500 max-h-[100px]"
                  style={{ minHeight: 40 }}
                  onInput={(e) => {
                    const el = e.currentTarget
                    el.style.height = '40px'
                    el.style.height = Math.min(el.scrollHeight, 100) + 'px'
                  }}
                  disabled={isLoading}
                />
                {!isLoading && (
                  <button
                    onClick={toggleDictation}
                    disabled={recorderState === 'transcribing'}
                    className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                      recorderState === 'recording'
                        ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                        : recorderState === 'transcribing'
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                    title={recorderState === 'recording' ? 'Kaydı durdur ve çevir' : recorderState === 'transcribing' ? 'Çevriliyor...' : 'Sesli yaz (dikte)'}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                )}
                {isLoading ? (
                  <button
                    onClick={stopGeneration}
                    className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
                    title="Durdur"
                  >
                    <StopCircle className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-md transition-all"
                    title="Gönder (Enter)"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1.5 text-center">
                AI yanıtları hata içerebilir. Önemli bilgileri doğrulayın.
              </p>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
