'use client'

import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'

/**
 * Adım 2 — Personel Etiketleri.
 *
 * Sektör default etiketleri (Doktor / Hemşire / Asistan / Resepsiyon vb.)
 * default işaretli olarak gelir. Kullanıcı çıkarabilir, custom etiket
 * ekleyebilir. Sonuç `businesses.settings.staff_tag_options` JSONB array'e
 * yazılır — settings/staff sayfasında personel formundaki "Etiketler"
 * dropdown'unun seçenek havuzu olarak kullanılır.
 */

interface StaffTagsStepProps {
  seedTags: string[]
  onTagsChange: (tags: string[]) => void
}

export default function StaffTagsStep({ seedTags, onTagsChange }: StaffTagsStepProps) {
  // Tüm seed etiketler default seçili
  const [selectedSeed, setSelectedSeed] = useState<Set<string>>(() => new Set(seedTags))
  const [customTags, setCustomTags] = useState<string[]>([])
  const [newTagInput, setNewTagInput] = useState('')

  const emit = (seedSet: Set<string>, customs: string[]) => {
    const all = [...seedTags.filter(t => seedSet.has(t)), ...customs]
    onTagsChange(all)
  }

  const toggleSeed = (tag: string) => {
    const next = new Set(selectedSeed)
    if (next.has(tag)) next.delete(tag)
    else next.add(tag)
    setSelectedSeed(next)
    emit(next, customTags)
  }

  const addCustom = () => {
    const trimmed = newTagInput.trim()
    if (!trimmed) return
    // Mükerrer kontrolü (case-insensitive)
    const lower = trimmed.toLowerCase()
    const allLower = [...seedTags, ...customTags].map(t => t.toLowerCase())
    if (allLower.includes(lower)) {
      setNewTagInput('')
      return
    }
    const next = [...customTags, trimmed]
    setCustomTags(next)
    setNewTagInput('')
    emit(selectedSeed, next)
  }

  const removeCustom = (tag: string) => {
    const next = customTags.filter(t => t !== tag)
    setCustomTags(next)
    emit(selectedSeed, next)
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">Personel etiketleriniz nedir?</h2>
        <p className="mt-3 text-white/70">
          Personellerinizi etiketlere göre ayırırsınız: Doktor, Asistan, Resepsiyon vb. Sektörünüze göre öneriler hazırladık.
        </p>
      </div>

      {/* Sektör preset etiketleri */}
      <div className="flex flex-wrap justify-center gap-2">
        {seedTags.map((tag) => {
          const isSelected = selectedSeed.has(tag)
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleSeed(tag)}
              aria-pressed={isSelected}
              className={[
                'inline-flex items-center gap-1.5 rounded-full border-2 px-4 py-2 text-sm font-medium transition-all',
                isSelected
                  ? 'border-white bg-white text-pulse-900 shadow-lg'
                  : 'border-white/30 bg-white/5 text-white/80 hover:border-white/60 hover:bg-white/10',
              ].join(' ')}
            >
              {isSelected && <Check size={14} strokeWidth={3} />}
              {tag}
            </button>
          )
        })}
      </div>

      {/* Custom etiket ekleme */}
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-2 rounded-xl border-2 border-dashed border-white/30 bg-white/5 p-2">
          <input
            type="text"
            placeholder="Özel etiket (örn. Operatör)"
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addCustom()
              }
            }}
            className="flex-1 rounded-md bg-transparent px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!newTagInput.trim()}
            className="cursor-pointer rounded-md bg-white/10 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Plus size={16} />
          </button>
        </div>

        {customTags.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {customTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-medium text-pulse-900 shadow-md"
              >
                <Check size={14} strokeWidth={3} />
                {tag}
                <button
                  type="button"
                  onClick={() => removeCustom(tag)}
                  className="cursor-pointer rounded-full p-0.5 text-pulse-700 transition-colors hover:bg-pulse-100"
                  aria-label={`${tag} etiketini kaldır`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-white/50">
        Bu etiketleri sonradan Ayarlar &raquo; Personel sayfasından düzenleyebilirsiniz.
      </p>
    </div>
  )
}
