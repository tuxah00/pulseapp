'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, MessageSquare } from 'lucide-react'

/**
 * Adım 3 — Otomatik mesajlar.
 *
 * 6 preset toggle: hatırlatma 24h/2h, değerlendirme isteği, takip mesajı,
 * winback, doğum günü. Her toggle'ın altında mesaj metni expandable ve düzenlenebilir.
 */

export type WorkflowKey =
  | 'reminder_24h'
  | 'reminder_2h'
  | 'auto_review_request'
  | 'follow_up_24h'
  | 'winback'
  | 'birthday'

export interface WorkflowSelection {
  enabled: Record<WorkflowKey, boolean>
  templates: Partial<Record<WorkflowKey, string>>
  winbackDays: number
}

interface WorkflowsStepProps {
  onSelectionChange: (selection: WorkflowSelection) => void
}

interface WorkflowPreset {
  key: WorkflowKey
  label: string
  description: string
  defaultTemplate: string
  defaultEnabled: boolean
}

const PRESETS: WorkflowPreset[] = [
  {
    key: 'reminder_24h',
    label: 'Randevudan 24 saat önce hatırlatma',
    description: 'Müşteriye bir gün önceden SMS.',
    defaultTemplate:
      'Merhaba {name}, yarın {time} saatindeki randevunuzu hatırlatmak istedik. Sizi bekliyoruz!',
    defaultEnabled: true,
  },
  {
    key: 'reminder_2h',
    label: 'Randevudan 2 saat önce hatırlatma',
    description: 'Randevu saatine 2 saat kala son hatırlatma.',
    defaultTemplate:
      'Merhaba {name}, 2 saat sonra {time} randevunuz var. Görüşmek üzere!',
    defaultEnabled: true,
  },
  {
    key: 'auto_review_request',
    label: 'Randevudan 2 saat sonra değerlendirme isteği',
    description: 'Hizmet bitince otomatik yorum/puan talebi.',
    defaultTemplate:
      'Merhaba {name}, bugünkü hizmetimizi değerlendirmek ister misiniz? {link}',
    defaultEnabled: true,
  },
  {
    key: 'follow_up_24h',
    label: 'Randevu sonrası 24 saat takip',
    description: '"Nasıl hissediyorsunuz?" takip mesajı.',
    defaultTemplate:
      'Merhaba {name}, bugün nasıl hissediyorsunuz? Soru veya endişeniz olursa bize yazabilirsiniz.',
    defaultEnabled: false,
  },
  {
    key: 'winback',
    label: 'Gelmeyen müşteriye geri dönüş',
    description: 'Belirli bir süredir gelmeyen müşteriye tekrar davet.',
    defaultTemplate:
      'Sizi özledik {name}! Yeni randevu için size özel %10 indirim hazırladık. Randevu: {link}',
    defaultEnabled: false,
  },
  {
    key: 'birthday',
    label: 'Doğum günü tebrik mesajı',
    description: 'Müşterinin doğum günü geldiğinde kutlama + kampanya.',
    defaultTemplate:
      'Doğum gününüz kutlu olsun {name}! Bu ay size özel %15 indirim hediyemiz olsun.',
    defaultEnabled: false,
  },
]

export default function WorkflowsStep({ onSelectionChange }: WorkflowsStepProps) {
  const [enabled, setEnabled] = useState<Record<WorkflowKey, boolean>>(() => {
    const init = {} as Record<WorkflowKey, boolean>
    for (const p of PRESETS) init[p.key] = p.defaultEnabled
    return init
  })
  const [templates, setTemplates] = useState<Partial<Record<WorkflowKey, string>>>(() => {
    const init: Partial<Record<WorkflowKey, string>> = {}
    for (const p of PRESETS) init[p.key] = p.defaultTemplate
    return init
  })
  const [expanded, setExpanded] = useState<WorkflowKey | null>(null)
  const [winbackDays, setWinbackDays] = useState(60)

  const emit = (
    nextEnabled: Record<WorkflowKey, boolean>,
    nextTemplates: Partial<Record<WorkflowKey, string>>,
    nextWinback: number,
  ) => {
    onSelectionChange({
      enabled: nextEnabled,
      templates: nextTemplates,
      winbackDays: nextWinback,
    })
  }

  const toggle = (key: WorkflowKey) => {
    const next = { ...enabled, [key]: !enabled[key] }
    setEnabled(next)
    emit(next, templates, winbackDays)
  }

  const updateTemplate = (key: WorkflowKey, value: string) => {
    const next = { ...templates, [key]: value }
    setTemplates(next)
    emit(enabled, next, winbackDays)
  }

  const updateWinback = (days: number) => {
    setWinbackDays(days)
    emit(enabled, templates, days)
  }

  // İlk render'da parent'ı varsayılan seçimle bilgilendir
  useEffect(() => {
    emit(enabled, templates, winbackDays)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">
          Müşterilerinizle otomatik iletişim
        </h2>
        <p className="mt-3 text-white/70">
          Tetikleyicilere göre otomatik SMS/mesaj gönderimi. Metinleri tıklayıp düzenleyebilirsiniz.
        </p>
      </div>

      <div className="space-y-2">
        {PRESETS.map(p => {
          const on = enabled[p.key]
          const isOpen = expanded === p.key
          return (
            <div
              key={p.key}
              className={[
                'overflow-hidden rounded-xl border-2 transition-all',
                on ? 'border-white bg-white' : 'border-white/20 bg-white/5',
              ].join(' ')}
            >
              <div className="flex items-center gap-3 p-4">
                <button
                  type="button"
                  onClick={() => toggle(p.key)}
                  role="switch"
                  aria-checked={on}
                  className={[
                    'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                    on ? 'bg-pulse-900' : 'bg-white/20',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                      on ? 'translate-x-[22px]' : 'translate-x-0.5',
                    ].join(' ')}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : p.key)}
                  className="flex flex-1 items-start justify-between gap-2 text-left"
                >
                  <div>
                    <p className={['font-semibold', on ? 'text-pulse-900' : 'text-white'].join(' ')}>
                      {p.label}
                    </p>
                    <p className={['text-xs', on ? 'text-gray-600' : 'text-white/60'].join(' ')}>
                      {p.description}
                    </p>
                  </div>
                  <ChevronDown
                    size={18}
                    className={[
                      'shrink-0 transition-transform',
                      on ? 'text-gray-500' : 'text-white/60',
                      isOpen ? 'rotate-180' : '',
                    ].join(' ')}
                  />
                </button>
              </div>

              {isOpen && (
                <div className={['border-t px-4 pb-4 pt-3', on ? 'border-gray-200' : 'border-white/10'].join(' ')}>
                  <label className={['mb-1 flex items-center gap-2 text-xs font-medium', on ? 'text-gray-600' : 'text-white/70'].join(' ')}>
                    <MessageSquare size={12} />
                    Mesaj metni
                  </label>
                  <textarea
                    rows={3}
                    value={templates[p.key] ?? ''}
                    onChange={e => updateTemplate(p.key, e.target.value)}
                    className={[
                      'w-full rounded-md border px-3 py-2 text-sm focus:outline-none',
                      on
                        ? 'border-gray-200 bg-gray-50 text-gray-900 focus:border-pulse-500'
                        : 'border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-white/60',
                    ].join(' ')}
                  />
                  <p className={['mt-1 text-[10px]', on ? 'text-gray-500' : 'text-white/50'].join(' ')}>
                    Değişkenler: {'{name}'} (müşteri adı), {'{time}'} (randevu saati), {'{link}'} (bağlantı)
                  </p>

                  {p.key === 'winback' && on && (
                    <div className="mt-3 flex items-center gap-2">
                      <label className="text-xs font-medium text-gray-600">Kaç gün sonra gönderilsin?</label>
                      <input
                        type="number"
                        min={7}
                        max={365}
                        value={winbackDays}
                        onChange={e => updateWinback(Number(e.target.value) || 60)}
                        className="w-20 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-900 focus:border-pulse-500 focus:outline-none"
                      />
                      <span className="text-xs text-gray-500">gün</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

