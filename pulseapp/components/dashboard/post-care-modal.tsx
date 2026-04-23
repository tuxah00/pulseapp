'use client'

import { useState } from 'react'
import { X, Send, FileText, Loader2 } from 'lucide-react'
import { Portal } from '@/components/ui/portal'
import { CustomSelect } from '@/components/ui/custom-select'
import { getPluginTemplates, renderTemplate } from '@/lib/plugins/registry'
import type { SectorType } from '@/types'

interface PostCareModalProps {
  show: boolean
  onClose: () => void
  sector: SectorType
  customerName: string
  customerPhone: string
  businessName: string
  serviceName: string
  sessionDate: string
  businessId: string
  customerId: string
}

export function PostCareModal({
  show,
  onClose,
  sector,
  customerName,
  customerPhone,
  businessName,
  serviceName,
  sessionDate,
  businessId,
  customerId,
}: PostCareModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [messageContent, setMessageContent] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [closing, setClosing] = useState(false)

  const templates = getPluginTemplates(sector, 'post_care')

  const handleClose = () => {
    setClosing(true)
  }

  const handleAnimationEnd = () => {
    if (closing) {
      setClosing(false)
      setSent(false)
      setSelectedTemplate('')
      setMessageContent('')
      onClose()
    }
  }

  const handleTemplateSelect = (templateKey: string) => {
    setSelectedTemplate(templateKey)
    const template = templates.find(t => t.key === templateKey)
    if (template) {
      const rendered = renderTemplate(template.content, {
        customerName,
        businessName,
        treatmentName: serviceName,
        date: sessionDate,
        nextAppointmentDate: '',
      })
      // Markdown'ı düz metin olarak al (WhatsApp/SMS için)
      const plainText = rendered
        .replace(/^#+\s*/gm, '')
        .replace(/\*\*/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      setMessageContent(plainText)
    }
  }

  const handleSend = async () => {
    if (!messageContent.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          customerId,
          to: customerPhone,
          content: messageContent,
          channel: 'auto',
        }),
      })
      if (res.ok) {
        setSent(true)
      }
    } catch {
      // hata durumu
    } finally {
      setSending(false)
    }
  }

  if (!show) return null

  return (
    <Portal>
      <div
        className={`modal-overlay fixed inset-0 z-[60] flex items-center justify-center ${closing ? 'closing' : ''}`}
        onClick={handleClose}
        onAnimationEnd={handleAnimationEnd}
      >
        <div
          className={`modal-content bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto ${closing ? 'closing' : ''}`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-pulse-900 dark:text-pulse-400" />
              Bakım Talimatları Gönder
            </h2>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-4 space-y-4">
            {/* Hasta bilgisi */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm">
              <div className="text-gray-600 dark:text-gray-400">
                <span className="font-medium text-gray-900 dark:text-white">{customerName}</span>
                {' · '}{customerPhone}
              </div>
              <div className="text-gray-500 dark:text-gray-500 mt-0.5">
                {serviceName} · {sessionDate}
              </div>
            </div>

            {sent ? (
              <div className="text-center py-8">
                <div className="text-green-500 text-4xl mb-3">✓</div>
                <p className="text-lg font-medium text-gray-900 dark:text-white">Talimat Gönderildi</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Bakım talimatları {customerName} adlı hastaya gönderildi.
                </p>
                <button
                  onClick={handleClose}
                  className="mt-4 px-4 py-2 text-sm bg-pulse-900 text-white rounded-lg hover:bg-pulse-800 transition-colors"
                >
                  Kapat
                </button>
              </div>
            ) : (
              <>
                {/* Şablon seçimi */}
                {templates.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Şablon Seçin
                    </label>
                    <CustomSelect
                      options={templates.map(t => ({ value: t.key, label: t.name }))}
                      value={selectedTemplate}
                      onChange={handleTemplateSelect}
                      placeholder="Şablon seçin..."
                    />
                  </div>
                )}

                {/* Mesaj içeriği */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Mesaj İçeriği
                  </label>
                  <textarea
                    value={messageContent}
                    onChange={e => setMessageContent(e.target.value)}
                    rows={8}
                    placeholder="Bakım talimatlarını yazın veya yukarıdan şablon seçin..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm resize-none"
                  />
                </div>

                {/* Gönder */}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                  >
                    İptal
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending || !messageContent.trim()}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-pulse-900 text-white rounded-lg hover:bg-pulse-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Gönder
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Portal>
  )
}
