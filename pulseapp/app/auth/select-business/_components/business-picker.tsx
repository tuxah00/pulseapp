'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Loader2, ChevronRight } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  owner: 'İşletme Sahibi',
  manager: 'Yönetici',
  staff: 'Personel',
}

export default function BusinessPicker({
  businesses,
}: {
  businesses: Array<{ id: string; name: string; role: string }>
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function select(businessId: string) {
    setSubmitting(businessId)
    setError(null)

    const res = await fetch('/api/auth/select-business', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId }),
    })

    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'İşletme seçilemedi')
      setSubmitting(null)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {businesses.map((b) => (
        <button
          key={b.id}
          onClick={() => select(b.id)}
          disabled={submitting !== null}
          className="w-full flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left hover:border-pulse-300 hover:bg-pulse-50/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-pulse-100">
            <Building2 className="h-5 w-5 text-pulse-900" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 truncate">{b.name}</p>
            <p className="text-xs text-gray-500">{ROLE_LABELS[b.role] || b.role}</p>
          </div>
          {submitting === b.id ? (
            <Loader2 className="h-4 w-4 animate-spin text-pulse-900 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
          )}
        </button>
      ))}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}
