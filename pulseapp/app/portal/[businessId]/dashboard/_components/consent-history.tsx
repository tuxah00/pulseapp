'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, ShieldCheck, ShieldOff, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/lib/hooks/use-confirm'

interface ConsentRecord {
  id: string
  consent_type: 'kvkk' | 'marketing' | 'health_data' | 'whatsapp'
  given_at: string
  revoked_at: string | null
  method: 'online_form' | 'in_person' | 'phone' | 'whatsapp'
  notes: string | null
}

const CONSENT_TYPE_LABELS: Record<ConsentRecord['consent_type'], string> = {
  kvkk: 'KVKK Aydınlatma Onayı',
  marketing: 'Pazarlama İletişim Onayı',
  health_data: 'Sağlık Verisi Paylaşım Onayı',
  whatsapp: 'WhatsApp İletişim Onayı',
}

const METHOD_LABELS: Record<ConsentRecord['method'], string> = {
  online_form: 'Online form',
  in_person: 'Yüz yüze',
  phone: 'Telefonla',
  whatsapp: 'WhatsApp',
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('tr-TR', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return iso
  }
}

/**
 * Müşterinin verdiği KVKK / pazarlama / sağlık verisi onaylarını listeler.
 * Aktif onaylarda "İptal Et" butonu; iptal edilenler pasif gösterilir.
 */
export default function ConsentHistory() {
  const [consents, setConsents] = useState<ConsentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)
  const { confirm } = useConfirm()

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/consents')
      const data = await res.json()
      if (res.ok) setConsents(data.consents || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleRevoke(c: ConsentRecord) {
    const ok = await confirm({
      title: 'Onayı iptal et',
      message: `"${CONSENT_TYPE_LABELS[c.consent_type]}" onayını iptal etmek istediğinizden emin misiniz? Bu işlem geri alınamaz; tekrar onay vermek için salonla iletişime geçmeniz gerekebilir.`,
      confirmText: 'Onayı İptal Et',
      cancelText: 'Vazgeç',
      variant: 'warning',
    })
    if (!ok) return

    setRevoking(c.id)
    try {
      const res = await fetch('/api/portal/consents/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentId: c.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        window.dispatchEvent(new CustomEvent('pulse-toast', {
          detail: { type: 'error', title: 'İptal başarısız', body: data?.error || 'Hata' },
        }))
      } else {
        window.dispatchEvent(new CustomEvent('pulse-toast', {
          detail: { type: 'system', title: 'Onay iptal edildi' },
        }))
        load()
      }
    } finally {
      setRevoking(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-3">
        <Loader2 className="h-4 w-4 animate-spin" />
        Onay kayıtları yükleniyor...
      </div>
    )
  }

  if (consents.length === 0) {
    return (
      <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        Sistemde kayıtlı onayınız bulunmuyor.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {consents.map((c) => {
        const active = !c.revoked_at
        return (
          <div
            key={c.id}
            className={cn(
              'rounded-xl border px-4 py-3 flex items-start gap-3',
              active
                ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700'
                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 opacity-75'
            )}
          >
            {active ? (
              <ShieldCheck className="h-4 w-4 mt-0.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            ) : (
              <ShieldOff className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {CONSENT_TYPE_LABELS[c.consent_type]}
                </span>
                <span className={cn(
                  'inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded',
                  active
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                )}>
                  {active ? <><Check className="h-3 w-3" /> Aktif</> : <><X className="h-3 w-3" /> İptal</>}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {formatDate(c.given_at)} · {METHOD_LABELS[c.method]}
                {c.revoked_at && <span> · {formatDate(c.revoked_at)} tarihinde iptal edildi</span>}
              </p>
              {c.notes && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">{c.notes}</p>
              )}
            </div>
            {active && (
              <button
                type="button"
                onClick={() => handleRevoke(c)}
                disabled={revoking === c.id}
                className="text-xs font-medium px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 flex-shrink-0"
              >
                {revoking === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'İptal Et'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
