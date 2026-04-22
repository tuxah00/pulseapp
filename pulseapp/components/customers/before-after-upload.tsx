'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { Loader2, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BeforeAfterUploadProps {
  customerId: string
  open: boolean
  onClose: () => void
  onUploaded: () => void
}

type Slot = 'before' | 'after' | 'single'

/**
 * Öncesi/Sonrası çift yükleme modalı.
 * Aynı `pair_id` altında before + after birlikte yüklenir (galeride yan yana eşleştirilir).
 * `pair_id` non-FK UUID; protocol_sessions FK'sından bağımsız çalışır.
 */
export function BeforeAfterUpload({ customerId, open, onClose, onUploaded }: BeforeAfterUploadProps) {
  const [mode, setMode] = useState<'pair' | 'single'>('pair')
  const [beforeFile, setBeforeFile] = useState<File | null>(null)
  const [afterFile, setAfterFile] = useState<File | null>(null)
  const [singleFile, setSingleFile] = useState<File | null>(null)
  const [singleType, setSingleType] = useState<'before' | 'after' | 'progress'>('progress')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') requestClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
    // requestClose içinde `busy` guard'ı var — effect'i busy değişimine bağlamaya gerek yok
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (open) {
      setBeforeFile(null); setAfterFile(null); setSingleFile(null)
      setSingleType('progress'); setNotes(''); setError(null); setMode('pair')
    }
  }, [open])

  function requestClose() {
    if (busy) return
    setClosing(true)
  }

  function handleAnimationEnd() {
    if (!closing) return
    setClosing(false)
    onClose()
  }

  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('customerId', customerId)
    const res = await fetch('/api/photos/upload', { method: 'POST', body: fd })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Yükleme hatası')
    return json.url as string
  }

  async function savePhoto(photoUrl: string, photoType: Slot, pairId?: string) {
    const body: Record<string, unknown> = {
      customerId,
      photoUrl,
      photoType: photoType === 'single' ? singleType : photoType,
      notes: notes.trim() || null,
    }
    if (pairId) body.pairId = pairId
    const res = await fetch('/api/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.error || 'Kayıt hatası')
    }
  }

  async function handleSubmit() {
    if (busy) return
    setError(null)

    try {
      if (mode === 'pair') {
        if (!beforeFile && !afterFile) {
          setError('En az bir fotoğraf seçin')
          return
        }
        setBusy(true)
        const pairId = crypto.randomUUID()
        const tasks: Promise<void>[] = []
        if (beforeFile) tasks.push(uploadFile(beforeFile).then(url => savePhoto(url, 'before', pairId)))
        if (afterFile) tasks.push(uploadFile(afterFile).then(url => savePhoto(url, 'after', pairId)))
        await Promise.all(tasks)
      } else {
        if (!singleFile) {
          setError('Fotoğraf seçin')
          return
        }
        setBusy(true)
        const url = await uploadFile(singleFile)
        await savePhoto(url, 'single')
      }

      onUploaded()
      requestClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yükleme başarısız')
    } finally {
      setBusy(false)
    }
  }

  if (!open && !closing) return null

  return (
    <div
      className={cn('modal-overlay fixed inset-0 z-[120] flex items-center justify-center bg-black/50 dark:bg-black/70 p-4', closing && 'closing')}
      onClick={requestClose}
      onAnimationEnd={handleAnimationEnd}
    >
      <div
        className={cn('modal-content card w-full max-w-lg dark:bg-gray-900', closing && 'closing')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="h-section">Fotoğraf Ekle</h2>
          <button onClick={requestClose} disabled={busy} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 disabled:opacity-50">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode('pair')}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium border',
              mode === 'pair' ? 'border-pulse-900 bg-pulse-50 text-pulse-900 dark:bg-pulse-900/20 dark:text-pulse-300' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
            )}
          >
            Öncesi / Sonrası Çifti
          </button>
          <button
            type="button"
            onClick={() => setMode('single')}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium border',
              mode === 'single' ? 'border-pulse-900 bg-pulse-50 text-pulse-900 dark:bg-pulse-900/20 dark:text-pulse-300' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
            )}
          >
            Tekil
          </button>
        </div>

        {mode === 'pair' ? (
          <div className="grid grid-cols-2 gap-3">
            <FileInput label="Öncesi" file={beforeFile} onChange={setBeforeFile} disabled={busy} />
            <FileInput label="Sonrası" file={afterFile} onChange={setAfterFile} disabled={busy} />
          </div>
        ) : (
          <div className="space-y-3">
            <FileInput label="Fotoğraf" file={singleFile} onChange={setSingleFile} disabled={busy} />
            <div>
              <label className="label">Tür</label>
              <div className="flex gap-2">
                {(['before', 'after', 'progress'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSingleType(t)}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-xs font-medium border',
                      singleType === t ? 'border-pulse-900 bg-pulse-50 text-pulse-900 dark:bg-pulse-900/20 dark:text-pulse-300' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    )}
                  >
                    {t === 'before' ? 'Öncesi' : t === 'after' ? 'Sonrası' : 'Süreç'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4">
          <label htmlFor="photo-notes" className="label">Not (opsiyonel)</label>
          <textarea
            id="photo-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="input"
            placeholder="Seans notu, gözlemler…"
            disabled={busy}
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={requestClose} disabled={busy} className="btn-secondary flex-1">İptal</button>
          <button type="button" onClick={handleSubmit} disabled={busy} className="btn-primary flex-1">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Upload className="h-4 w-4 mr-1.5" />Yükle</>}
          </button>
        </div>
      </div>
    </div>
  )
}

interface FileInputProps {
  label: string
  file: File | null
  onChange: (f: File | null) => void
  disabled?: boolean
}

function FileInput({ label, file, onChange, disabled }: FileInputProps) {
  // useMemo ensures the blob URL is created only when `file` changes (not on every render)
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  return (
    <label className={cn(
      'relative block aspect-square rounded-xl border-2 border-dashed cursor-pointer overflow-hidden',
      file ? 'border-pulse-900' : 'border-gray-300 dark:border-gray-600 hover:border-pulse-900',
      disabled && 'opacity-60 cursor-not-allowed'
    )}>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
      {previewUrl ? (
        <Image src={previewUrl} alt={label} fill unoptimized className="object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
          <Upload className="h-6 w-6 mb-1" />
          <span className="text-xs">{label}</span>
        </div>
      )}
      <span className="absolute top-1.5 left-1.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/60 text-white">
        {label}
      </span>
    </label>
  )
}
