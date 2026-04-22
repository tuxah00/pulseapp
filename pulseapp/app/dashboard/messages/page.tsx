'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { useSidebar } from '@/lib/hooks/sidebar-context'
import { requirePermission } from '@/lib/hooks/use-require-permission'
import {
  MessageSquare, Search, Send, Loader2, Phone,
  Bot, User, ChevronLeft, Clock, ArrowDownCircle,
  Sparkles, Calendar, HelpCircle, AlertTriangle,
  MessageCircle, X, Filter, Smartphone, FileText,
} from 'lucide-react'
import { formatPhone, cn } from '@/lib/utils'
import EmptyState from '@/components/ui/empty-state'
import { format, isToday, isYesterday, parseISO } from 'date-fns'
import { tr } from 'date-fns/locale'
import type {
  Message, Customer, AiClassification, MessageDirection, MessageChannel,
} from '@/types'
import { TemplatePicker } from '@/components/whatsapp/template-picker'
import type { WhatsAppTemplateType } from '@/lib/whatsapp/templates'

interface Conversation {
  customer: Customer
  lastMessage: Message
  unreadCount: number
}

const AI_LABELS: Record<AiClassification, { label: string; color: string; icon: React.ReactNode }> = {
  appointment: { label: 'Randevu', color: 'badge-info', icon: <Calendar className="h-3 w-3" /> },
  question: { label: 'Soru', color: 'badge-info', icon: <HelpCircle className="h-3 w-3" /> },
  complaint: { label: 'Şikayet', color: 'badge-danger', icon: <AlertTriangle className="h-3 w-3" /> },
  cancellation: { label: 'İptal', color: 'badge-danger', icon: <X className="h-3 w-3" /> },
  greeting: { label: 'Selamlama', color: 'badge-success', icon: <MessageCircle className="h-3 w-3" /> },
  other: { label: 'Diğer', color: 'badge-neutral', icon: <MessageSquare className="h-3 w-3" /> },
}

function formatMessageTime(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return 'Dün ' + format(date, 'HH:mm')
  return format(date, 'd MMM HH:mm', { locale: tr })
}

function formatConversationDate(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return 'Dün'
  return format(date, 'd MMM', { locale: tr })
}

export default function MessagesPage() {
  const { businessId, businessName, loading: ctxLoading, permissions } = useBusinessContext()
  const { collapsed } = useSidebar()
  const supabase = createClient()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [filterClassification, setFilterClassification] = useState<AiClassification | 'all'>('all')
  const [filterChannel, setFilterChannel] = useState<MessageChannel | 'all'>('all')
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Konuşma listesini çek
  const fetchConversations = useCallback(async () => {
    if (!businessId) return
    setLoading(true)

    const { data: allMessages, error } = await supabase
      .from('messages')
      .select('*, customers(id, name, phone, segment)')
      .eq('business_id', businessId)
      .not('customer_id', 'is', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Mesaj çekme hatası:', error)
      setLoading(false)
      return
    }

    if (!allMessages || allMessages.length === 0) {
      setConversations([])
      setLoading(false)
      return
    }

    const convMap = new Map<string, Conversation>()

    for (const msg of allMessages) {
      const custId = msg.customer_id
      if (!custId || !msg.customers) continue

      if (!convMap.has(custId)) {
        convMap.set(custId, {
          customer: msg.customers as unknown as Customer,
          lastMessage: msg,
          unreadCount: 0,
        })
      }

      if (msg.direction === 'inbound' && !msg.twilio_status?.includes('read')) {
        const conv = convMap.get(custId)!
        conv.unreadCount++
      }
    }

    let convList = Array.from(convMap.values())

    if (filterClassification !== 'all') {
      convList = convList.filter(c => c.lastMessage.ai_classification === filterClassification)
    }

    if (filterChannel !== 'all') {
      convList = convList.filter(c => c.lastMessage.channel === filterChannel)
    }

    setConversations(convList)
    setLoading(false)
  }, [businessId, filterClassification, filterChannel, supabase])

  // Seçili müşterinin mesajlarını çek
  const fetchMessages = useCallback(async (customerId: string) => {
    if (!businessId) return
    setMessagesLoading(true)

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('business_id', businessId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true })

    if (data) setMessages(data)
    if (error) console.error('Mesaj detay çekme hatası:', error)
    setMessagesLoading(false)
  }, [businessId, supabase])

  useEffect(() => {
    if (!ctxLoading) fetchConversations()
  }, [fetchConversations, ctxLoading])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Realtime subscription
  useEffect(() => {
    if (!businessId) return

    const channel = supabase
      .channel('messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          if (selectedCustomer && newMsg.customer_id === selectedCustomer.id) {
            setMessages(prev => [...prev, newMsg])
          }
          fetchConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [businessId, selectedCustomer, fetchConversations, supabase])

  function selectConversation(conv: Conversation) {
    setSelectedCustomer(conv.customer)
    fetchMessages(conv.customer.id)
    setMobileShowChat(true)
  }

  function goBackToList() {
    setMobileShowChat(false)
    setSelectedCustomer(null)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim() || !selectedCustomer || !businessId) return

    setSending(true)
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          businessId,
          content: newMessage.trim(),
        }),
      })
      const data = await res.json()

      if (data.success) {
        setNewMessage('')
        setAiSuggestion(null)
        fetchMessages(selectedCustomer.id)
        fetchConversations()
      } else {
        console.error('Mesaj gönderme hatası:', data.error)
      }
    } catch (err) {
      console.error('Mesaj gönderme hatası:', err)
    }
    setSending(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  async function handleAiSuggest() {
    if (!selectedCustomer || !businessId || messages.length === 0) return
    setAiLoading(true)
    setAiSuggestion(null)

    const lastInbound = [...messages].reverse().find(m => m.direction === 'inbound')
    if (!lastInbound) {
      setAiLoading(false)
      return
    }

    try {
      const res = await fetch('/api/ai/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: lastInbound.content,
          businessId,
          classification: lastInbound.ai_classification,
          customerName: selectedCustomer.name,
        }),
      })
      const data = await res.json()
      if (data.reply) {
        setAiSuggestion(data.reply)
      }
    } catch (err) {
      console.error('AI öneri hatası:', err)
    }
    setAiLoading(false)
  }

  function useAiSuggestion() {
    if (aiSuggestion) {
      setNewMessage(aiSuggestion)
      setAiSuggestion(null)
      inputRef.current?.focus()
    }
  }

  async function handleSendTemplate(args: {
    templateType: WhatsAppTemplateType
    templateParams: Record<string, string>
    preview: string
  }) {
    if (!selectedCustomer || !businessId) return

    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: selectedCustomer.id,
        content: args.preview,
        messageType: 'template',
        channel: 'auto',
        templateName: args.templateType,
        templateParams: args.templateParams,
      }),
    })
    const data = await res.json()

    if (data.success) {
      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: { type: 'system', title: 'Şablon mesaj gönderildi', body: `Kanal: ${data.channel ?? 'web'}` },
      }))
      setTemplatePickerOpen(false)
      fetchMessages(selectedCustomer.id)
      fetchConversations()
    } else {
      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: { type: 'error', title: 'Mesaj gönderilemedi', body: data.error || 'Bilinmeyen hata' },
      }))
    }
  }

  // Arama filtresi
  const filteredConversations = debouncedSearch.trim()
    ? conversations.filter(c =>
        c.customer.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        c.customer.phone.includes(debouncedSearch)
      )
    : conversations

  // Mesajları güne göre grupla
  function groupMessagesByDate(msgs: Message[]): { date: string; messages: Message[] }[] {
    const groups: { date: string; messages: Message[] }[] = []
    let currentDate = ''

    for (const msg of msgs) {
      const msgDate = parseISO(msg.created_at)
      let dateLabel: string
      if (isToday(msgDate)) dateLabel = 'Bugün'
      else if (isYesterday(msgDate)) dateLabel = 'Dün'
      else dateLabel = format(msgDate, 'd MMMM yyyy', { locale: tr })

      if (dateLabel !== currentDate) {
        currentDate = dateLabel
        groups.push({ date: dateLabel, messages: [msg] })
      } else {
        groups[groups.length - 1].messages.push(msg)
      }
    }
    return groups
  }

  requirePermission(permissions, 'messages')

  if (ctxLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-900" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'fixed inset-0 top-14 z-30 bg-white dark:!bg-gray-950 transition-[left] duration-300 ease-out left-0',
        collapsed ? 'lg:left-[72px]' : 'lg:left-64'
      )}
    >
      <div className="flex h-full">

        {/* Sol Panel — Konuşma Listesi */}
        <div className={cn(
          'flex flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:!bg-gray-950 w-full lg:w-96 lg:flex-shrink-0',
          mobileShowChat ? 'hidden lg:flex' : 'flex'
        )}>
          {/* Başlık */}
          <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Mesajlar</h1>
              <span className="badge-brand">
                {conversations.length} konuşma
              </span>
            </div>

            {/* Arama */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10 py-2"
                placeholder="Müşteri ara..."
              />
            </div>

            {/* Kanal Filtresi */}
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {([
                { key: 'all', label: 'Tümü', icon: null },
                { key: 'sms', label: 'SMS', icon: <Phone className="h-3 w-3" /> },
                { key: 'whatsapp', label: 'WhatsApp', icon: <Smartphone className="h-3 w-3" /> },
                { key: 'web', label: 'Web', icon: <MessageSquare className="h-3 w-3" /> },
              ] as const).map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setFilterChannel(key as MessageChannel | 'all')}
                  className={cn(
                    'badge px-2.5 py-1 cursor-pointer whitespace-nowrap transition-colors flex items-center gap-1',
                    filterChannel === key
                      ? key === 'whatsapp' ? 'bg-green-600 text-white' : 'bg-gray-900 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  )}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>

            {/* AI Filtre */}
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setFilterClassification('all')}
                className={cn(
                  'badge px-2.5 py-1 cursor-pointer whitespace-nowrap transition-colors',
                  filterClassification === 'all'
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                )}
              >
                Tümü
              </button>
              {(Object.keys(AI_LABELS) as AiClassification[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setFilterClassification(key)}
                  className={cn(
                    'badge px-2.5 py-1 cursor-pointer whitespace-nowrap transition-colors flex items-center gap-1',
                    filterClassification === key
                      ? AI_LABELS[key].color + ' ring-2 ring-offset-1'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  )}
                >
                  {AI_LABELS[key].icon}
                  {AI_LABELS[key].label}
                </button>
              ))}
            </div>
          </div>

          {/* Konuşma Listesi */}
          <div className="flex-1 overflow-y-auto bg-white dark:!bg-gray-950">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-pulse-900" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-8 w-8" />}
                title={search ? 'Sonuç bulunamadı' : 'Henüz mesaj yok'}
                description={search ? 'Farklı bir arama terimi deneyin.' : 'Müşteri mesajları burada görünecek.'}
              />
            ) : (
              <div>
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.customer.id}
                    onClick={() => selectConversation(conv)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors bg-white dark:!bg-gray-950 hover:bg-gray-50 dark:hover:!bg-gray-900 border-b border-gray-100 dark:border-gray-800',
                      selectedCustomer?.id === conv.customer.id && 'bg-pulse-50 hover:bg-pulse-50 dark:bg-pulse-900/20 dark:hover:bg-pulse-900/20'
                    )}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div className={cn(
                        'flex h-11 w-11 items-center justify-center rounded-full font-semibold text-sm',
                        selectedCustomer?.id === conv.customer.id
                          ? 'bg-pulse-200 text-pulse-800'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      )}>
                        {conv.customer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      {conv.unreadCount > 0 && (
                        <div className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-pulse-900 text-[10px] font-bold text-white">
                          {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                        </div>
                      )}
                    </div>

                    {/* İçerik */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          'text-sm truncate',
                          conv.unreadCount > 0 ? 'font-bold text-gray-900 dark:text-gray-100' : 'font-medium text-gray-900 dark:text-gray-100'
                        )}>
                          {conv.customer.name}
                        </span>
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {formatConversationDate(conv.lastMessage.created_at)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        {conv.lastMessage.direction === 'outbound' && (
                          <span className="text-xs text-gray-400 flex-shrink-0">Siz:</span>
                        )}
                        <p className={cn(
                          'text-xs truncate',
                          conv.unreadCount > 0 ? 'font-medium text-gray-700' : 'text-gray-500'
                        )}>
                          {conv.lastMessage.content}
                        </p>
                      </div>

                      {/* AI sınıflandırma badge'i */}
                      {conv.lastMessage.ai_classification && conv.lastMessage.direction === 'inbound' && (
                        <div className="mt-1">
                          <span className={cn(AI_LABELS[conv.lastMessage.ai_classification].color, 'text-[10px]')}>
                            {AI_LABELS[conv.lastMessage.ai_classification].icon}
                            {AI_LABELS[conv.lastMessage.ai_classification].label}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sağ Panel — Chat Görünümü */}
        <div className={cn(
          'flex-1 flex flex-col bg-gray-50 dark:!bg-gray-950',
          mobileShowChat ? 'flex' : 'hidden lg:flex'
        )}>
          {selectedCustomer ? (
            <>
              {/* Chat Header */}
              <div className="flex-shrink-0 flex items-center gap-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
                <button
                  onClick={goBackToList}
                  className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>

                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pulse-100 text-pulse-900 font-semibold text-sm flex-shrink-0">
                  {selectedCustomer.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{selectedCustomer.name}</h2>
                  <p className="text-xs text-gray-500">{formatPhone(selectedCustomer.phone)}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={`/dashboard/customers`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    title="Müşteri profili"
                  >
                    <User className="h-4 w-4" />
                  </a>
                </div>
              </div>

              {/* Mesajlar */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-pulse-900" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <MessageSquare className="mb-3 h-10 w-10 text-gray-300" />
                    <p className="text-sm text-gray-500">Bu müşteriyle henüz mesaj yok</p>
                    <p className="text-xs text-gray-400 mt-1">Aşağıdaki alandan mesaj yazabilirsiniz.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {groupMessagesByDate(messages).map((group) => (
                      <div key={group.date}>
                        {/* Tarih ayırıcı */}
                        <div className="flex items-center justify-center my-4">
                          <span className="rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 text-xs text-gray-500 dark:text-gray-400 shadow-sm">
                            {group.date}
                          </span>
                        </div>

                        {/* Mesaj balonları */}
                        {group.messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={cn(
                              'flex mb-2',
                              msg.direction === 'outbound' ? 'justify-end' : 'justify-start'
                            )}
                          >
                            <div className={cn(
                              'max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm',
                              msg.direction === 'outbound'
                                ? 'bg-pulse-900 text-white rounded-br-md'
                                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-bl-md'
                            )}>
                              {/* AI sınıflandırma */}
                              {msg.ai_classification && msg.direction === 'inbound' && (
                                <div className="mb-1.5">
                                  <span className={cn(AI_LABELS[msg.ai_classification].color, 'text-[10px]')}>
                                    <Bot className="h-2.5 w-2.5" />
                                    AI: {AI_LABELS[msg.ai_classification].label}
                                    {msg.ai_confidence && (
                                      <span className="opacity-70">
                                        ({Math.round(msg.ai_confidence * 100)}%)
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}

                              {/* Mesaj tipi göstergesi */}
                              {msg.message_type === 'ai_generated' && (
                                <div className="mb-1.5 flex items-center gap-1">
                                  <Sparkles className={cn(
                                    'h-3 w-3',
                                    msg.direction === 'outbound' ? 'text-white/70' : 'text-purple-500'
                                  )} />
                                  <span className={cn(
                                    'text-[10px] font-medium',
                                    msg.direction === 'outbound' ? 'text-white/70' : 'text-purple-500'
                                  )}>
                                    AI tarafından oluşturuldu
                                  </span>
                                </div>
                              )}

                              {/* Mesaj içeriği */}
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>

                              {/* Gönderen personel (outbound) */}
                              {msg.direction === 'outbound' && (msg as any).staff_name && (
                                <p className="text-[10px] text-white/60 mt-0.5">{(msg as any).staff_name}</p>
                              )}

                              {/* Zaman + Kanal */}
                              <div className={cn(
                                'flex items-center justify-end gap-1 mt-1',
                                msg.direction === 'outbound' ? 'text-white/60' : 'text-gray-400'
                              )}>
                                {/* Kanal ikonu */}
                                {msg.channel === 'whatsapp' && (
                                  <Smartphone className="h-2.5 w-2.5 text-green-400" />
                                )}
                                {msg.channel === 'sms' && (
                                  <Phone className="h-2.5 w-2.5 opacity-60" />
                                )}
                                <span className="text-[10px]">
                                  {format(parseISO(msg.created_at), 'HH:mm')}
                                </span>
                                {msg.direction === 'outbound' && msg.twilio_status && (
                                  <span className="text-[10px]">
                                    {msg.twilio_status === 'delivered' ? '✓✓' :
                                     msg.twilio_status === 'read' ? '✓✓' :
                                     msg.twilio_status === 'sent' ? '✓' : '⏳'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* AI Öneri Paneli */}
              {aiSuggestion && (
                <div className="flex-shrink-0 border-t border-purple-200 dark:border-purple-900/40 bg-purple-50 dark:bg-purple-900/20 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 flex-shrink-0 mt-0.5">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-purple-700 mb-1">AI Yanıt Önerisi</p>
                      <p className="text-sm text-gray-700">{aiSuggestion}</p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={useAiSuggestion}
                          className="text-xs font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg px-3 py-1.5 transition-colors"
                        >
                          Kullan
                        </button>
                        <button
                          onClick={() => setAiSuggestion(null)}
                          className="text-xs font-medium text-gray-500 hover:text-gray-700 rounded-lg px-3 py-1.5 transition-colors"
                        >
                          Kapat
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mesaj Yazma Alanı */}
              <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
                <form onSubmit={handleSend} className="flex items-end gap-3">
                  <button
                    type="button"
                    onClick={handleAiSuggest}
                    disabled={aiLoading || messages.length === 0}
                    title="AI yanıt önerisi al"
                    className={cn(
                      'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition-all',
                      aiLoading
                        ? 'bg-purple-100 text-purple-500'
                        : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                    )}
                  >
                    {aiLoading
                      ? <Loader2 className="h-5 w-5 animate-spin" />
                      : <Sparkles className="h-5 w-5" />
                    }
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplatePickerOpen(true)}
                    title="Şablondan mesaj gönder"
                    className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/30 transition-all"
                  >
                    <FileText className="h-5 w-5" />
                  </button>
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="input resize-none py-3 pr-12 min-h-[48px] max-h-32"
                      placeholder="Mesaj yazın..."
                      rows={1}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={sending || !newMessage.trim()}
                    className={cn(
                      'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition-all',
                      newMessage.trim()
                        ? 'bg-pulse-900 text-white hover:bg-pulse-800 shadow-sm'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    {sending
                      ? <Loader2 className="h-5 w-5 animate-spin" />
                      : <Send className="h-5 w-5" />
                    }
                  </button>
                </form>
                <p className="mt-2 text-[10px] text-gray-400 text-center">
                  <Sparkles className="inline h-3 w-3 text-purple-400 mr-1" />
                  AI öneri · <FileText className="inline h-3 w-3 text-green-600 mr-1" />
                  Şablon · Enter ile gönder · Shift+Enter ile yeni satır
                </p>
              </div>
            </>
          ) : (
            /* Boş durum — henüz konuşma seçilmedi */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-pulse-100 dark:bg-pulse-900/30">
                <MessageSquare className="h-10 w-10 text-pulse-900 dark:text-pulse-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Mesajlarınız</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                Sol panelden bir konuşma seçerek mesaj geçmişini görüntüleyin
                ve müşterilerinizle iletişim kurun.
              </p>
              <div className="mt-8 grid gap-3 text-left max-w-xs">
                <FeatureItem
                  icon={<Bot className="h-4 w-4 text-purple-500" />}
                  title="AI Mesaj Sınıflandırma"
                  desc="Gelen mesajlar otomatik kategorize edilir"
                />
                <FeatureItem
                  icon={<Sparkles className="h-4 w-4 text-amber-500" />}
                  title="Akıllı Yanıt Önerileri"
                  desc="AI destekli yanıt taslakları"
                />
                <FeatureItem
                  icon={<Phone className="h-4 w-4 text-green-500" />}
                  title="Çok Kanallı Mesajlaşma"
                  desc="SMS ve web üzerinden müşteri iletişimi"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedCustomer && (
        <TemplatePicker
          open={templatePickerOpen}
          onClose={() => setTemplatePickerOpen(false)}
          customerName={selectedCustomer.name}
          businessName={businessName || ''}
          onSend={handleSendTemplate}
        />
      )}
    </div>
  )
}

function FeatureItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-700 flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
      </div>
    </div>
  )
}
