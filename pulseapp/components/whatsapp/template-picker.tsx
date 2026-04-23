'use client'

import { useEffect, useMemo, useState } from 'react'
import { MessageSquare, Send, Smartphone, Sparkles, X, Loader2 } from 'lucide-react'
import { CustomSelect, type SelectOption } from '@/components/ui/custom-select'
import {
  TEMPLATE_META,
  TEMPLATE_CATEGORY_LABELS,
  generateWhatsAppMessage,
  type WhatsAppTemplateType,
  type WhatsAppTemplateCategory,
  type TemplateParams,
} from '@/lib/whatsapp/templates'
import { cn } from '@/lib/utils'

interface TemplatePickerProps {
  open: boolean
  onClose: () => void
  customerName: string
  businessName: string
  /** Seçim tamamlandığında çağrılır — `preview` = WhatsApp mesaj gövdesi */
  onSend: (args: {
    templateType: WhatsAppTemplateType
    templateParams: Record<string, string>
    preview: string
  }) => Promise<void> | void
  /** Gönderilen mesajın kanalı — picker "WhatsApp üzerinden gönderilir" ibaresini göstermek için */
  channel?: 'whatsapp' | 'sms'
}

const TEMPLATES_BY_CATEGORY: Record<WhatsAppTemplateCategory, WhatsAppTemplateType[]> = (() => {
  const map: Record<WhatsAppTemplateCategory, WhatsAppTemplateType[]> = {
    randevu: [],
    dogum_gunu: [],
    follow_up: [],
    kampanya: [],
  }
  for (const meta of Object.values(TEMPLATE_META)) {
    map[meta.category].push(meta.type)
  }
  return map
})()

const CATEGORY_OPTIONS: SelectOption[] = (Object.keys(TEMPLATE_CATEGORY_LABELS) as WhatsAppTemplateCategory[]).map(c => ({
  value: c,
  label: TEMPLATE_CATEGORY_LABELS[c],
}))

export function TemplatePicker({
  open,
  onClose,
  customerName,
  businessName,
  onSend,
  channel = 'whatsapp',
}: TemplatePickerProps) {
  const [category, setCategory] = useState<WhatsAppTemplateCategory>('randevu')
  const [templateType, setTemplateType] = useState<WhatsAppTemplateType>('appointment_reminder')
  const [paramValues, setParamValues] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [closing, setClosing] = useState(false)

  const meta = TEMPLATE_META[templateType]

  const templateOptions: SelectOption[] = useMemo(
    () => TEMPLATES_BY_CATEGORY[category].map(t => ({
      value: t,
      label: TEMPLATE_META[t].label,
    })),
    [category]
  )

  const preview = useMemo(() => {
    const params: TemplateParams = {
      customerName: customerName || '[Müşteri]',
      businessName: businessName || '[İşletme]',
      ...paramValues,
    }
    return generateWhatsAppMessage(templateType, params)
  }, [templateType, paramValues, customerName, businessName])

  const missingRequired = useMemo(
    () => meta.placeholders
      .filter(p => p.required && !paramValues[p.key]?.trim())
      .map(p => p.label),
    [meta, paramValues]
  )

  function requestClose() {
    if (sending) return
    setClosing(true)
  }

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
    // requestClose stable — state-only deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sending])

  function handleAnimationEnd() {
    if (!closing) return
    setClosing(false)
    onClose()
  }

  function handleCategoryChange(value: string) {
    const newCategory = value as WhatsAppTemplateCategory
    setCategory(newCategory)
    const firstTemplate = TEMPLATES_BY_CATEGORY[newCategory][0]
    if (firstTemplate) {
      setTemplateType(firstTemplate)
      setParamValues({})
    }
  }

  function handleTemplateChange(value: string) {
    setTemplateType(value as WhatsAppTemplateType)
    setParamValues({})
  }

  async function handleSubmit() {
    if (missingRequired.length > 0 || sending) return
    setSending(true)
    try {
      await onSend({ templateType, templateParams: paramValues, preview })
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div
      className={cn('fixed inset-0 z-[60] flex items-center justify-center p-4 modal-overlay', closing && 'closing')}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className={cn('modal-content bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col', closing && 'closing')}>
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-9 w-9 items-center justify-center rounded-xl',
              channel === 'whatsapp'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            )}>
              {channel === 'whatsapp' ? <Smartphone className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Şablondan Mesaj Gönder</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {channel === 'whatsapp' ? 'WhatsApp üzerinden gönderilir' : 'SMS üzerinden gönderilir'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Kategori
              </label>
              <CustomSelect
                options={CATEGORY_OPTIONS}
                value={category}
                onChange={handleCategoryChange}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Şablon
              </label>
              <CustomSelect
                options={templateOptions}
                value={templateType}
                onChange={handleTemplateChange}
              />
            </div>
          </div>

          {meta.placeholders.length > 0 && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-pulse-900 dark:text-pulse-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                  Şablon Değişkenleri
                </h3>
              </div>
              {meta.placeholders.map(p => (
                <div key={p.key}>
                  <label className={cn(
                    'block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1',
                    p.required && 'label-required'
                  )}>
                    {p.label}
                  </label>
                  {p.key === 'message' ? (
                    <textarea
                      value={paramValues[p.key] || ''}
                      onChange={(e) => setParamValues(v => ({ ...v, [p.key]: e.target.value }))}
                      placeholder={p.placeholder}
                      rows={3}
                      className="input resize-none py-2"
                    />
                  ) : (
                    <input
                      type="text"
                      value={paramValues[p.key] || ''}
                      onChange={(e) => setParamValues(v => ({ ...v, [p.key]: e.target.value }))}
                      placeholder={p.placeholder}
                      className="input py-2"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300 mb-2">
              Önizleme
            </h3>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100">
                {preview}
              </p>
            </div>
            <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">
              Müşteri adı ve işletme adı otomatik doldurulur.
            </p>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 min-h-[16px]">
            {missingRequired.length > 0
              ? `Zorunlu alan: ${missingRequired.join(', ')}`
              : 'Mesaj gönderilmeye hazır.'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={requestClose}
              className="btn-secondary"
              disabled={sending}
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={missingRequired.length > 0 || sending}
              className={cn(
                'btn-primary inline-flex items-center gap-2',
                (missingRequired.length > 0 || sending) && 'opacity-60 cursor-not-allowed'
              )}
            >
              {sending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />}
              Gönder
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
