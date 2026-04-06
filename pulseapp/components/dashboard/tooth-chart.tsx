'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, X, Save, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  type ToothRecord,
  type ToothCondition,
  TOOTH_CONDITION_LABELS,
  TOOTH_CONDITION_COLORS,
} from '@/types'

// FDI numaralarına göre diş düzeni
// Üst sağ: 18-11 | Üst sol: 21-28
// Alt sol: 31-38 | Alt sağ: 41-48
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11]
const UPPER_LEFT  = [21, 22, 23, 24, 25, 26, 27, 28]
const LOWER_LEFT  = [31, 32, 33, 34, 35, 36, 37, 38]
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41]

const CONDITIONS: ToothCondition[] = [
  'healthy', 'caries', 'filled', 'crown', 'extracted',
  'implant', 'root_canal', 'bridge', 'missing',
]

interface Props {
  businessId: string
  customerId: string
  staffId: string | null
}

interface EditState {
  toothNumber: number
  condition: ToothCondition
  treatment: string
  notes: string
  treatedAt: string
}

export default function ToothChart({ businessId, customerId, staffId }: Props) {
  const [records, setRecords] = useState<ToothRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editTooth, setEditTooth] = useState<EditState | null>(null)

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/tooth-records?businessId=${businessId}&customerId=${customerId}`
      )
      if (res.ok) {
        const j = await res.json()
        setRecords(j.records ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [businessId, customerId])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  function getRecord(toothNumber: number): ToothRecord | undefined {
    return records.find(r => r.tooth_number === toothNumber)
  }

  function openTooth(toothNumber: number) {
    const rec = getRecord(toothNumber)
    setEditTooth({
      toothNumber,
      condition: rec?.condition ?? 'healthy',
      treatment: rec?.treatment ?? '',
      notes: rec?.notes ?? '',
      treatedAt: rec?.treated_at ?? '',
    })
  }

  async function handleSave() {
    if (!editTooth) return
    setSaving(true)
    try {
      const res = await fetch('/api/tooth-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          customerId,
          toothNumber: editTooth.toothNumber,
          condition: editTooth.condition,
          treatment: editTooth.treatment || null,
          notes: editTooth.notes || null,
          treatedAt: editTooth.treatedAt || null,
        }),
      })
      if (res.ok) {
        await fetchRecords()
        setEditTooth(null)
      } else {
        const j = await res.json().catch(() => ({}))
        alert(j.error || 'Kayıt sırasında hata oluştu')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!editTooth) return
    const rec = getRecord(editTooth.toothNumber)
    if (!rec) { setEditTooth(null); return }
    setSaving(true)
    try {
      await fetch(
        `/api/tooth-records?businessId=${businessId}&customerId=${customerId}&toothNumber=${editTooth.toothNumber}`,
        { method: 'DELETE' }
      )
      await fetchRecords()
      setEditTooth(null)
    } finally {
      setSaving(false)
    }
  }

  function ToothCell({ num }: { num: number }) {
    const rec = getRecord(num)
    const condition = rec?.condition ?? 'healthy'
    const colors = TOOTH_CONDITION_COLORS[condition]
    const isEditing = editTooth?.toothNumber === num

    return (
      <button
        type="button"
        onClick={() => openTooth(num)}
        title={`${num} — ${TOOTH_CONDITION_LABELS[condition]}`}
        className={cn(
          'flex flex-col items-center justify-center w-8 h-10 rounded border-2 text-[9px] font-bold transition-all hover:scale-110 hover:z-10 relative',
          colors.bg, colors.border, colors.text,
          isEditing && 'ring-2 ring-pulse-900 scale-110 z-10',
          condition === 'extracted' && 'line-through opacity-60',
        )}
      >
        <span className="text-[8px] text-gray-500 leading-none">{num}</span>
        {condition !== 'healthy' && (
          <span className={cn('text-[7px] leading-none mt-0.5', colors.text)}>
            {TOOTH_CONDITION_LABELS[condition].slice(0, 3)}
          </span>
        )}
      </button>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-pulse-900" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Renk Açıklaması */}
      <div className="flex flex-wrap gap-1.5">
        {CONDITIONS.filter(c => c !== 'healthy').map(c => {
          const colors = TOOTH_CONDITION_COLORS[c]
          return (
            <span key={c} className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium border', colors.bg, colors.border, colors.text)}>
              {TOOTH_CONDITION_LABELS[c]}
            </span>
          )
        })}
      </div>

      {/* Diş Haritası */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 select-none">
        {/* Üst çene */}
        <p className="text-center text-[10px] text-gray-400 dark:text-gray-500 mb-1.5 font-medium">ÜST ÇENE</p>
        <div className="flex justify-center gap-0.5 mb-1">
          {UPPER_RIGHT.map(n => <ToothCell key={n} num={n} />)}
          <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1" />
          {UPPER_LEFT.map(n => <ToothCell key={n} num={n} />)}
        </div>

        {/* Ayırıcı */}
        <div className="my-2 border-t border-dashed border-gray-300 dark:border-gray-600" />

        {/* Alt çene */}
        <div className="flex justify-center gap-0.5 mt-1">
          {LOWER_RIGHT.reverse().map(n => <ToothCell key={n} num={n} />)}
          <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1" />
          {LOWER_LEFT.map(n => <ToothCell key={n} num={n} />)}
        </div>
        <p className="text-center text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 font-medium">ALT ÇENE</p>
      </div>

      {/* Düzenleme Paneli */}
      {editTooth && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Diş #{editTooth.toothNumber}
            </h4>
            <button onClick={() => setEditTooth(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded p-0.5">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Durum Seçimi */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 block">Durum</label>
            <div className="flex flex-wrap gap-1">
              {CONDITIONS.map(c => {
                const colors = TOOTH_CONDITION_COLORS[c]
                const selected = editTooth.condition === c
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEditTooth(prev => prev ? { ...prev, condition: c } : null)}
                    className={cn(
                      'rounded px-2 py-0.5 text-xs font-medium border transition-all',
                      colors.bg, colors.border, colors.text,
                      selected ? 'ring-2 ring-pulse-900 scale-105' : 'opacity-70 hover:opacity-100'
                    )}
                  >
                    {TOOTH_CONDITION_LABELS[c]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* İşlem Notu */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Yapılan İşlem</label>
            <input
              type="text"
              value={editTooth.treatment}
              onChange={e => setEditTooth(prev => prev ? { ...prev, treatment: e.target.value } : null)}
              placeholder="örn. Amalgam dolgu, porselen kron…"
              className="input text-sm"
            />
          </div>

          {/* Tarih */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">İşlem Tarihi</label>
            <input
              type="date"
              value={editTooth.treatedAt}
              onChange={e => setEditTooth(prev => prev ? { ...prev, treatedAt: e.target.value } : null)}
              className="input text-sm"
            />
          </div>

          {/* Notlar */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Notlar</label>
            <textarea
              value={editTooth.notes}
              onChange={e => setEditTooth(prev => prev ? { ...prev, notes: e.target.value } : null)}
              placeholder="Ek bilgiler…"
              rows={2}
              className="input text-sm resize-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            {getRecord(editTooth.toothNumber) && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="btn-danger text-sm px-3"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />Sıfırla
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-sm flex-1"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Kaydet
            </button>
          </div>
        </div>
      )}

      {/* Özet */}
      {records.length > 0 && (
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {records.filter(r => r.condition !== 'healthy').length} dişte kayıt mevcut
        </div>
      )}
    </div>
  )
}
