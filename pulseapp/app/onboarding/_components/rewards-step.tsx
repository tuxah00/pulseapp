'use client'

import { useState } from 'react'
import { Check, Gift } from 'lucide-react'
import type { SeedReward } from '@/lib/config/sector-seeds'
import type { RewardType } from '@/types'

/**
 * Adım 4 — Ödüller.
 *
 * Ana toggle: "Ödül sistemini aktifleştir" (varsayılan kapalı).
 * Açıldığında preset ödül kartları gelir; seçilen kartlar commit'te `rewards`
 * tablosuna insert edilir ve `settings.rewards_enabled = true` yazılır.
 */

export interface RewardDraft {
  name: string
  description: string
  type: RewardType
  value: number
  validDays: number
}

interface RewardsStepProps {
  seedRewards: SeedReward[]
  onSelectionChange: (enabled: boolean, rewards: RewardDraft[]) => void
}

type SeedState = {
  selected: boolean
  value: number
  validDays: number
}

function formatValueLabel(rewardType: RewardType, value: number): string {
  switch (rewardType) {
    case 'discount_percent':
      return `%${value} indirim`
    case 'discount_amount':
      return `${value} ₺ indirim`
    case 'free_service':
      return 'Ücretsiz hizmet'
    case 'points':
      return `${value} puan`
    case 'gift':
      return 'Hediye'
    default:
      return '—'
  }
}

export default function RewardsStep({ seedRewards, onSelectionChange }: RewardsStepProps) {
  const [rewardsEnabled, setRewardsEnabled] = useState(false)
  const [seedState, setSeedState] = useState<Record<number, SeedState>>(() => {
    const init: Record<number, SeedState> = {}
    seedRewards.forEach((r, i) => {
      init[i] = { selected: false, value: r.value, validDays: r.validDays }
    })
    return init
  })

  const emit = (enabled: boolean, state: Record<number, SeedState>) => {
    if (!enabled) {
      onSelectionChange(false, [])
      return
    }
    const result: RewardDraft[] = []
    seedRewards.forEach((r, i) => {
      const s = state[i]
      if (s?.selected) {
        result.push({
          name: r.name,
          description: `${r.description} (${r.triggerLabel})`,
          type: r.rewardType,
          value: s.value,
          validDays: s.validDays,
        })
      }
    })
    onSelectionChange(true, result)
  }

  const toggleMain = () => {
    const next = !rewardsEnabled
    setRewardsEnabled(next)
    emit(next, seedState)
  }

  const updateSeed = (idx: number, patch: Partial<SeedState>) => {
    const next = { ...seedState, [idx]: { ...seedState[idx], ...patch } }
    setSeedState(next)
    emit(rewardsEnabled, next)
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">Sadık müşterilerinizi ödüllendirin</h2>
        <p className="mt-3 text-white/70">
          Tekrar gelen ve arkadaş getiren müşteriler için otomatik ödül sistemi.
        </p>
      </div>

      {/* Ana toggle */}
      <div
        className={[
          'flex items-center gap-4 rounded-2xl border-2 p-5 transition-all',
          rewardsEnabled ? 'border-white bg-white' : 'border-white/20 bg-white/5',
        ].join(' ')}
      >
        <div
          className={[
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
            rewardsEnabled ? 'bg-pulse-900 text-white' : 'bg-white/10 text-white',
          ].join(' ')}
        >
          <Gift size={22} />
        </div>
        <div className="flex-1">
          <p className={['font-semibold', rewardsEnabled ? 'text-pulse-900' : 'text-white'].join(' ')}>
            Ödül sistemini aktifleştir
          </p>
          <p className={['text-xs', rewardsEnabled ? 'text-gray-600' : 'text-white/60'].join(' ')}>
            Daha sonra ayarlardan yeniden kapatabilirsiniz.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleMain}
          role="switch"
          aria-checked={rewardsEnabled}
          className={[
            'relative h-7 w-12 shrink-0 rounded-full p-0.5 transition-colors',
            rewardsEnabled ? 'bg-pulse-900' : 'bg-white/20',
          ].join(' ')}
        >
          <span
            className={[
              'block h-6 w-6 rounded-full bg-white shadow transition-transform duration-200',
              rewardsEnabled ? 'translate-x-5' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
      </div>

      {/* Preset kartlar — yalnızca toggle açıkken */}
      {rewardsEnabled && (
        <div className="animate-rewards-reveal grid grid-cols-1 gap-3 md:grid-cols-2">
          {seedRewards.map((r, i) => {
            const state = seedState[i]
            const isSelected = state?.selected ?? false
            return (
              <div
                key={`${r.name}-${i}`}
                style={{ ['--stagger-index' as string]: i }}
                className={[
                  'wizard-card-stagger relative overflow-hidden rounded-xl border-2 transition-all duration-200',
                  isSelected
                    ? 'border-white bg-white text-pulse-900 shadow-xl'
                    : 'border-white/20 bg-white/5 text-white hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10',
                ].join(' ')}
              >
                <button
                  type="button"
                  onClick={() => updateSeed(i, { selected: !isSelected })}
                  aria-pressed={isSelected}
                  className="flex w-full items-start gap-3 p-4 text-left"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold">{r.name}</h3>
                    <p className={['mt-1 text-xs', isSelected ? 'text-gray-600' : 'text-white/60'].join(' ')}>
                      {r.description}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span
                        className={[
                          'rounded-full px-2 py-0.5 text-[10px] font-medium',
                          isSelected ? 'bg-pulse-100 text-pulse-900' : 'bg-white/10 text-white/80',
                        ].join(' ')}
                      >
                        {r.triggerLabel}
                      </span>
                      <span
                        className={[
                          'rounded-full px-2 py-0.5 text-[10px] font-medium',
                          isSelected ? 'bg-green-100 text-green-700' : 'bg-white/10 text-white/80',
                        ].join(' ')}
                      >
                        {formatValueLabel(r.rewardType, state?.value ?? r.value)}
                      </span>
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

                {isSelected && (r.rewardType === 'discount_percent' || r.rewardType === 'discount_amount' || r.rewardType === 'points') && (
                  <div className="flex items-center gap-2 border-t border-gray-200 px-4 pb-4 pt-3">
                    <label className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span>Değer</span>
                      <input
                        type="number"
                        min={0}
                        value={state.value}
                        onChange={e => updateSeed(i, { value: Number(e.target.value) || 0 })}
                        className="w-20 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-900 focus:border-pulse-500 focus:outline-none"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span>Geçerlilik (gün)</span>
                      <input
                        type="number"
                        min={1}
                        value={state.validDays}
                        onChange={e => updateSeed(i, { validDays: Number(e.target.value) || 30 })}
                        className="w-20 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-900 focus:border-pulse-500 focus:outline-none"
                      />
                    </label>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
