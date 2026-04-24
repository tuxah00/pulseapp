'use client'

import { useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import type { SeedPackage } from '@/lib/config/sector-seeds'

/**
 * Adım 2 — Seans paketleri.
 *
 * Preset paket kartları + inline seans sayısı / fiyat / geçerlilik düzenleme.
 * Özel paket ekleme (isim, seans, fiyat, gün).
 */

export interface PackageDraft {
  name: string
  description?: string | null
  sessions_total: number
  price: number
  validity_days?: number | null
}

interface PackagesStepProps {
  seedPackages: SeedPackage[]
  onPackagesChange: (packages: PackageDraft[]) => void
}

type SeedPackageState = {
  selected: boolean
  sessions_total: number
  price: number
  validity_days: number | null
}

type CustomPackage = {
  id: string
  name: string
  sessions_total: number
  price: number
  validity_days: number | null
}

export default function PackagesStep({ seedPackages, onPackagesChange }: PackagesStepProps) {
  const [seedState, setSeedState] = useState<Record<string, SeedPackageState>>(() => {
    const init: Record<string, SeedPackageState> = {}
    seedPackages.forEach((p, i) => {
      const key = `${p.name}-${i}`
      init[key] = {
        selected: false,
        sessions_total: p.sessions_total,
        price: p.price,
        validity_days: p.validity_days ?? null,
      }
    })
    return init
  })
  const [customCards, setCustomCards] = useState<CustomPackage[]>([])

  const packageKey = (p: SeedPackage, i: number) => `${p.name}-${i}`

  const emit = (seed: Record<string, SeedPackageState>, customs: CustomPackage[]) => {
    const result: PackageDraft[] = []
    seedPackages.forEach((p, i) => {
      const state = seed[packageKey(p, i)]
      if (state?.selected) {
        result.push({
          name: p.name,
          description: p.description ?? null,
          sessions_total: state.sessions_total,
          price: state.price,
          validity_days: state.validity_days,
        })
      }
    })
    for (const c of customs) {
      if (c.name.trim().length > 0 && c.sessions_total > 0 && c.price > 0) {
        result.push({
          name: c.name.trim(),
          sessions_total: c.sessions_total,
          price: c.price,
          validity_days: c.validity_days,
        })
      }
    }
    onPackagesChange(result)
  }

  const updateSeed = (key: string, patch: Partial<SeedPackageState>) => {
    const next = { ...seedState, [key]: { ...seedState[key], ...patch } }
    setSeedState(next)
    emit(next, customCards)
  }

  const addCustom = () => {
    const card: CustomPackage = {
      id: `custom-${Date.now()}`,
      name: '',
      sessions_total: 3,
      price: 0,
      validity_days: 180,
    }
    const next = [...customCards, card]
    setCustomCards(next)
    emit(seedState, next)
  }

  const updateCustom = (id: string, patch: Partial<CustomPackage>) => {
    const next = customCards.map(c => (c.id === id ? { ...c, ...patch } : c))
    setCustomCards(next)
    emit(seedState, next)
  }

  const removeCustom = (id: string) => {
    const next = customCards.filter(c => c.id !== id)
    setCustomCards(next)
    emit(seedState, next)
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">Seans paketleri oluşturalım</h2>
        <p className="mt-3 text-white/70">
          Müşterileriniz için hazır paketler — seans sayısı, fiyat ve geçerliliği size göre ayarlayın.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 items-start">
        {seedPackages.map((p, i) => {
          const key = packageKey(p, i)
          const state = seedState[key]
          const isSelected = state?.selected ?? false
          return (
            <div
              key={key}
              style={{ ['--stagger-index' as string]: i }}
              className={[
                'wizard-card-stagger relative overflow-hidden rounded-xl border-2 transition-all duration-200 cursor-default',
                isSelected
                  ? 'border-white bg-white text-pulse-900 shadow-xl'
                  : 'border-white/20 bg-white/5 text-white hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10',
              ].join(' ')}
            >
              <button
                type="button"
                onClick={() => updateSeed(key, { selected: !isSelected })}
                aria-pressed={isSelected}
                className="flex w-full cursor-pointer items-start justify-between gap-2 p-4 text-left"
              >
                <div className="flex-1">
                  <h3 className="font-semibold">{p.name}</h3>
                  {p.description && (
                    <p className={['mt-1 text-xs', isSelected ? 'text-gray-600' : 'text-white/60'].join(' ')}>
                      {p.description}
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
                <div className="grid grid-cols-3 gap-2 border-t border-gray-200 px-4 pb-4 pt-3">
                  <label className="flex flex-col gap-1 text-xs text-gray-500">
                    <span>Seans</span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={state.sessions_total}
                      onChange={e => updateSeed(key, { sessions_total: Number(e.target.value) || 1 })}
                      className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-900 focus:border-pulse-500 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-gray-500">
                    <span>Fiyat (₺)</span>
                    <input
                      type="number"
                      min={0}
                      value={state.price}
                      onChange={e => updateSeed(key, { price: Number(e.target.value) || 0 })}
                      className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-900 focus:border-pulse-500 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-gray-500">
                    <span>Geçerlilik (gün)</span>
                    <input
                      type="number"
                      min={0}
                      value={state.validity_days ?? 0}
                      onChange={e => {
                        const val = Number(e.target.value) || 0
                        updateSeed(key, { validity_days: val > 0 ? val : null })
                      }}
                      className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-900 focus:border-pulse-500 focus:outline-none"
                    />
                  </label>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {customCards.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white/80">Özel paketler</h3>
          {customCards.map(c => (
            <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3 shadow-lg">
              <input
                type="text"
                placeholder="Paket adı"
                value={c.name}
                onChange={e => updateCustom(c.id, { name: e.target.value })}
                className="min-w-[140px] flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-900 focus:border-pulse-500 focus:outline-none"
              />
              <label className="flex items-center gap-1 text-xs text-gray-500">
                <span>Seans</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={c.sessions_total}
                  onChange={e => updateCustom(c.id, { sessions_total: Number(e.target.value) || 1 })}
                  className="w-16 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-900 focus:border-pulse-500 focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-1 text-xs text-gray-500">
                <span>₺</span>
                <input
                  type="number"
                  min={0}
                  value={c.price}
                  onChange={e => updateCustom(c.id, { price: Number(e.target.value) || 0 })}
                  className="w-24 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-900 focus:border-pulse-500 focus:outline-none"
                />
              </label>
              <label className="flex items-center gap-1 text-xs text-gray-500">
                <span>Gün</span>
                <input
                  type="number"
                  min={0}
                  value={c.validity_days ?? 0}
                  onChange={e => {
                    const val = Number(e.target.value) || 0
                    updateCustom(c.id, { validity_days: val > 0 ? val : null })
                  }}
                  className="w-20 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-900 focus:border-pulse-500 focus:outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => removeCustom(c.id)}
                className="cursor-pointer rounded-md p-1.5 text-red-500 hover:bg-red-50"
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
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/30 px-4 py-3 text-sm font-medium text-white/80 transition-all hover:border-white/60 hover:bg-white/5 hover:text-white"
      >
        <Plus size={16} />
        Özel paket ekle
      </button>
    </div>
  )
}
