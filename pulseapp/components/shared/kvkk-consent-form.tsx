'use client'

import { useState } from 'react'
import { ShieldCheck, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  businessName?: string
  onConsent: (types: string[]) => void
  required?: boolean
  showHealthData?: boolean
  showMarketing?: boolean
  className?: string
}

export function KvkkConsentForm({ businessName = 'İşletme', onConsent, required = true, showHealthData = false, showMarketing = false, className }: Props) {
  const [kvkk, setKvkk] = useState(false)
  const [healthData, setHealthData] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  function handleChange() {
    const types: string[] = []
    if (kvkk) types.push('kvkk')
    if (healthData) types.push('health_data')
    if (marketing) types.push('marketing')
    onConsent(types)
  }

  return (
    <div className={cn('rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3', className)}>
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-pulse-900 flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-900">Kişisel Veri İzinleri (KVKK)</span>
      </div>

      {/* Zorunlu KVKK onayı */}
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={kvkk}
          onChange={(e) => {
            setKvkk(e.target.checked)
            setTimeout(handleChange, 0)
          }}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-pulse-900 focus:ring-pulse-900"
          required={required}
        />
        <div className="flex-1">
          <span className="text-sm text-gray-700">
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-pulse-900 underline hover:text-pulse-700">
              Aydınlatma Metni
            </a>
            &apos;ni okudum ve kişisel verilerimin işlenmesini kabul ediyorum.
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </span>
        </div>
      </label>

      {/* Sağlık verisi açık rıza (opsiyonel, klinikler için) */}
      {showHealthData && (
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={healthData}
            onChange={(e) => {
              setHealthData(e.target.checked)
              setTimeout(handleChange, 0)
            }}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-pulse-900 focus:ring-pulse-900"
          />
          <span className="text-sm text-gray-700">
            Sağlık verilerimin tedavi amacıyla işlenmesine açık rıza veriyorum.
          </span>
        </label>
      )}

      {/* Pazarlama onayı */}
      {showMarketing && (
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => {
              setMarketing(e.target.checked)
              setTimeout(handleChange, 0)
            }}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-pulse-900 focus:ring-pulse-900"
          />
          <span className="text-sm text-gray-700">
            {businessName} tarafından kampanya ve bilgilendirme mesajları almak istiyorum.
          </span>
        </label>
      )}

      {/* Aydınlatma metni özeti */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
        KVKK Aydınlatma Özeti
      </button>

      {expanded && (
        <div className="text-xs text-gray-500 leading-relaxed bg-white rounded-lg p-3 border border-gray-100 space-y-1.5">
          <p><strong>Veri Sorumlusu:</strong> {businessName}</p>
          <p><strong>İşlenen Veriler:</strong> Ad-soyad, telefon, randevu bilgileri{showHealthData ? ', sağlık verileri' : ''}.</p>
          <p><strong>İşleme Amacı:</strong> Randevu yönetimi, hizmet sunumu{showHealthData ? ', tedavi takibi' : ''}.</p>
          <p><strong>Saklama Süresi:</strong> Hizmet ilişkisi süresince ve yasal yükümlülükler kapsamında.</p>
          <p><strong>Haklarınız:</strong> Verilerinize erişim, düzeltme, silme talep edebilirsiniz. Detaylar için{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-pulse-900 underline">aydınlatma metnini</a> inceleyin.
          </p>
        </div>
      )}
    </div>
  )
}
