'use client'

import { useState } from 'react'
import { Check, Megaphone } from 'lucide-react'
import type { SeedCampaign } from '@/lib/config/sector-seeds'
import type { CustomerSegment } from '@/types'

/**
 * Adım 5 — Kampanyalar.
 *
 * Sektöre göre önerilen 3-4 taslak kampanya kartı. Seçilen kartlar commit'te
 * `campaigns` tablosuna `status='draft'` olarak yazılır; kullanıcı dashboard'dan
 * zamanlayıp gönderir.
 */

export interface CampaignDraft {
  name: string
  description: string
  discountPercent: number | null
  targetSegments: CustomerSegment[] | null
  messageTemplate: string
}

interface CampaignsStepProps {
  seedCampaigns: SeedCampaign[]
  onCampaignsChange: (campaigns: CampaignDraft[]) => void
}

type SeedState = {
  selected: boolean
  discountPercent: number | null
  messageTemplate: string
}

const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  new: 'Yeni',
  regular: 'Düzenli',
  vip: 'VIP',
  risk: 'Risk',
  lost: 'Kayıp',
}

function formatSegmentLabel(segments: CustomerSegment[] | null): string {
  if (!segments || segments.length === 0) return 'Tüm müşteriler'
  return segments.map(s => SEGMENT_LABELS[s] ?? s).join(', ')
}

export default function CampaignsStep({ seedCampaigns, onCampaignsChange }: CampaignsStepProps) {
  const [seedState, setSeedState] = useState<Record<number, SeedState>>(() => {
    const init: Record<number, SeedState> = {}
    seedCampaigns.forEach((c, i) => {
      init[i] = {
        selected: false,
        discountPercent: c.discountPercent ?? null,
        messageTemplate: c.messageTemplate,
      }
    })
    return init
  })

  const emit = (state: Record<number, SeedState>) => {
    const result: CampaignDraft[] = []
    seedCampaigns.forEach((c, i) => {
      const s = state[i]
      if (s?.selected) {
        result.push({
          name: c.name,
          description: c.description,
          discountPercent: s.discountPercent,
          targetSegments: c.targetSegments,
          messageTemplate: s.messageTemplate,
        })
      }
    })
    onCampaignsChange(result)
  }

  const updateSeed = (idx: number, patch: Partial<SeedState>) => {
    const next = { ...seedState, [idx]: { ...seedState[idx], ...patch } }
    setSeedState(next)
    emit(next)
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">İlk kampanyalarınızı oluşturun</h2>
        <p className="mt-3 text-white/70">
          Taslak olarak kaydedilir — zamanlamak için dashboard&apos;daki kampanya yöneticisini kullanın.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 items-start">
        {seedCampaigns.map((c, i) => {
          const state = seedState[i]
          const isSelected = state?.selected ?? false
          return (
            <div
              key={`${c.name}-${i}`}
              style={{ ['--stagger-index' as string]: i }}
              className={[
                'wizard-card-stagger cursor-default overflow-hidden rounded-xl border-2 transition-all duration-200',
                isSelected
                  ? 'border-white bg-white text-pulse-900 shadow-xl'
                  : 'border-white/20 bg-white/5 text-white hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10',
              ].join(' ')}
            >
              <button
                type="button"
                onClick={() => updateSeed(i, { selected: !isSelected })}
                aria-pressed={isSelected}
                className="flex w-full cursor-pointer items-start gap-3 p-4 text-left"
              >
                <div
                  className={[
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                    isSelected ? 'bg-pulse-900 text-white' : 'bg-white/10 text-white',
                  ].join(' ')}
                >
                  <Megaphone size={18} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{c.name}</h3>
                  <p className={['mt-1 text-xs', isSelected ? 'text-gray-600' : 'text-white/60'].join(' ')}>
                    {c.description}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-[10px] font-medium',
                        isSelected ? 'bg-pulse-100 text-pulse-900' : 'bg-white/10 text-white/80',
                      ].join(' ')}
                    >
                      {formatSegmentLabel(c.targetSegments)}
                    </span>
                    {state?.discountPercent != null && (
                      <span
                        className={[
                          'rounded-full px-2 py-0.5 text-[10px] font-medium',
                          isSelected ? 'bg-green-100 text-green-700' : 'bg-white/10 text-white/80',
                        ].join(' ')}
                      >
                        %{state.discountPercent} indirim
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={[
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors',
                    isSelected ? 'bg-pulse-900 text-white' : 'border-2 border-white/30',
                  ].join(' ')}
                >
                  {isSelected && <Check size={14} strokeWidth={3} />}
                </div>
              </button>

              {/* Smooth accordion — always in DOM, grid-rows animates height */}
              <div className={['grid transition-all duration-300 ease-in-out', isSelected ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'].join(' ')}>
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-3 border-t border-gray-200 px-4 pb-4 pt-3">
                    {c.discountPercent != null && (
                      <label className="flex items-center gap-2 text-xs text-gray-500">
                        <span>İndirim (%)</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={state.discountPercent ?? 0}
                          onChange={e => updateSeed(i, { discountPercent: Number(e.target.value) || 0 })}
                          className="w-20 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-900 focus:border-pulse-500 focus:outline-none"
                        />
                      </label>
                    )}
                    <label className="block text-xs font-medium text-gray-600">
                      Mesaj metni
                      <textarea
                        rows={3}
                        value={state.messageTemplate}
                        onChange={e => updateSeed(i, { messageTemplate: e.target.value })}
                        className="mt-1 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-pulse-500 focus:outline-none"
                      />
                    </label>
                    <p className="text-[10px] text-gray-500">
                      Değişkenler: {'{name}'} (müşteri adı), {'{link}'} (kampanya/randevu bağlantısı)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
