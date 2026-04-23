'use client'

import { useState } from 'react'
import { Check, Clock, Plus, Trash2 } from 'lucide-react'
import type { SeedService } from '@/lib/config/sector-seeds'

/**
 * Adım 1 — Hizmetler.
 *
 * Preset kartlar + inline fiyat/süre düzenleme + özel hizmet ekleme.
 * Seçim state'i burada yönetilir; "Devam" tıklanınca parent'a seçilen
 * hizmetleri bildirir. Parent commit API'ye POST eder.
 */

export interface ServiceDraft {
  name: string
  description?: string | null
  duration_minutes: number
  price: number
  recommended_interval_days?: number | null
}

interface ServicesStepProps {
  seedServices: SeedService[]
  onServicesChange: (services: ServiceDraft[]) => void
}

type SeedCardState = {
  selected: boolean
  price: number
  duration_minutes: number
}

type CustomCard = {
  id: string
  name: string
  price: number
  duration_minutes: number
}

export default function ServicesStep({ seedServices, onServicesChange }: ServicesStepProps) {
  // Her preset için seçim + editable fiyat/süre
  const [seedState, setSeedState] = useState<Record<string, SeedCardState>>(() => {
    const init: Record<string, SeedCardState> = {}
    for (const s of seedServices) {
      init[s.key] = { selected: false, price: s.price, duration_minutes: s.duration_minutes }
    }
    return init
  })
  const [customCards, setCustomCards] = useState<CustomCard[]>([])

  const updateSeed = (key: string, patch: Partial<SeedCardState>) => {
    setSeedState(prev => {
      const next = { ...prev, [key]: { ...prev[key], ...patch } }
      emit(next, customCards)
      return next
    })
  }

  const addCustom = () => {
    const newCard: CustomCard = {
      id: `custom-${Date.now()}`,
      name: '',
      price: 0,
      duration_minutes: 30,
    }
    const next = [...customCards, newCard]
    setCustomCards(next)
    emit(seedState, next)
  }

  const updateCustom = (id: string, patch: Partial<CustomCard>) => {
    const next = customCards.map(c => (c.id === id ? { ...c, ...patch } : c))
    setCustomCards(next)
    emit(seedState, next)
  }

  const removeCustom = (id: string) => {
    const next = customCards.filter(c => c.id !== id)
    setCustomCards(next)
    emit(seedState, next)
  }

  const emit = (seed: Record<string, SeedCardState>, customs: CustomCard[]) => {
    const result: ServiceDraft[] = []
    for (const s of seedServices) {
      const state = seed[s.key]
      if (state?.selected) {
        result.push({
          name: s.name,
          description: s.description ?? null,
          duration_minutes: state.duration_minutes,
          price: state.price,
          recommended_interval_days: s.recommended_interval_days ?? null,
        })
      }
    }
    for (const c of customs) {
      if (c.name.trim().length > 0 && c.price > 0) {
        result.push({
          name: c.name.trim(),
          duration_minutes: c.duration_minutes,
          price: c.price,
        })
      }
    }
    onServicesChange(result)
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">Hangi hizmetleri sunuyorsunuz?</h2>
        <p className="mt-3 text-white/70">
          Sektörünüze uygun örnekler hazırladık. Beğendiklerinizi seçin, fiyatları size göre düzenleyin.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {seedServices.map(s => {
          const state = seedState[s.key]
          const isSelected = state?.selected ?? false
          return (
            <div
              key={s.key}
              className={[
                'relative overflow-hidden rounded-xl border-2 transition-all duration-200',
                isSelected
                  ? 'border-white bg-white text-pulse-900 shadow-xl'
                  : 'border-white/20 bg-white/5 text-white hover:border-white/40 hover:bg-white/10',
              ].join(' ')}
            >
              <button
                type="button"
                onClick={() => updateSeed(s.key, { selected: !isSelected })}
                aria-pressed={isSelected}
                className="flex w-full items-start justify-between gap-2 p-4 text-left"
              >
                <div className="flex-1">
                  <h3 className="font-semibold">{s.name}</h3>
                  {s.description && (
                    <p className={['mt-1 text-xs', isSelected ? 'text-gray-600' : 'text-white/60'].join(' ')}>
                      {s.description}
                    </p>
                  )}
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

              {isSelected && (
                <div className="flex items-center gap-2 border-t border-gray-200 px-4 pb-4 pt-3">
                  <label className="flex flex-1 items-center gap-1.5">
                    <span className="text-xs font-medium text-gray-500">₺</span>
                    <input
                      type="number"
                      min={0}
                      value={state.price}
                      onChange={e => updateSeed(s.key, { price: Number(e.target.value) || 0 })}
                      className="w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-900 focus:border-pulse-500 focus:outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-1.5">
                    <Clock size={12} className="text-gray-500" />
                    <input
                      type="number"
                      min={5}
                      step={5}
                      value={state.duration_minutes}
                      onChange={e => updateSeed(s.key, { duration_minutes: Number(e.target.value) || 0 })}
                      className="w-16 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-900 focus:border-pulse-500 focus:outline-none"
                    />
                    <span className="text-xs text-gray-500">dk</span>
                  </label>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Özel hizmet kartları */}
      {customCards.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white/80">Özel hizmetler</h3>
          {customCards.map(c => (
            <div key={c.id} className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-lg">
              <input
                type="text"
                placeholder="Hizmet adı"
                value={c.name}
                onChange={e => updateCustom(c.id, { name: e.target.value })}
                className="flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 focus:border-pulse-500 focus:outline-none"
              />
              <label className="flex items-center gap-1">
                <span className="text-xs text-gray-500">₺</span>
                <input
                  type="number"
                  min={0}
                  value={c.price}
                  onChange={e => updateCustom(c.id, { price: Number(e.target.value) || 0 })}
                  className="w-20 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-900 focus:border-pulse-500 focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-1">
                <Clock size={12} className="text-gray-500" />
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={c.duration_minutes}
                  onChange={e => updateCustom(c.id, { duration_minutes: Number(e.target.value) || 0 })}
                  className="w-14 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-900 focus:border-pulse-500 focus:outline-none"
                />
                <span className="text-xs text-gray-500">dk</span>
              </label>
              <button
                type="button"
                onClick={() => removeCustom(c.id)}
                className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                aria-label="Sil"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addCustom}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/30 px-4 py-3 text-sm font-medium text-white/80 transition-all hover:border-white/60 hover:bg-white/5 hover:text-white"
      >
        <Plus size={16} />
        Özel hizmet ekle
      </button>
    </div>
  )
}
