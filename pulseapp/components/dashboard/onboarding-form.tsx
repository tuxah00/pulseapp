'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { SECTOR_LABELS, type SectorType } from '@/types'
import { SECTOR_GROUPS } from '@/lib/config/sector-modules'
import { CustomSelect } from '@/components/ui/custom-select'

// Sektör gruplarını, grup başlığı "— Grup Adı —" şeklinde ayırt edilebilir flat liste
const SECTOR_OPTIONS = SECTOR_GROUPS.flatMap((group) =>
  group.sectors.map((s) => ({ value: s, label: `${group.label} — ${SECTOR_LABELS[s]}` })),
)

interface OnboardingFormProps {
  userId: string
  userEmail: string
  userName: string
}

export default function OnboardingForm({ userId, userEmail, userName }: OnboardingFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [businessName, setBusinessName] = useState('')
  const [sector, setSector] = useState<SectorType>('hair_salon')
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          business_name: businessName,
          sector,
          phone: phone || null,
          city: city || null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'İşletme oluşturulurken bir hata oluştu.')
        setLoading(false)
        return
      }

      // Sayfayı yenile — artık staff_member var, dashboard yüklenecek
      router.refresh()
    } catch (err) {
      setError('Bağlantı hatası. Tekrar deneyin.')
      setLoading(false)
    }
  }

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">İşletme Bilgileri</h2>
      <p className="text-sm text-gray-500 mb-6">
        İşletmenizi tanımlayın, hemen başlayalım.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="businessName" className="label">İşletme Adı</label>
          <input
            id="businessName"
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="input"
            placeholder="Güzellik Salonu Nur"
            required
          />
        </div>

        <div>
          <label htmlFor="sector" className="label">Sektör</label>
          <CustomSelect
            options={SECTOR_OPTIONS}
            value={sector}
            onChange={(v) => setSector(v as SectorType)}
          />
        </div>

        <div>
          <label htmlFor="phone" className="label">Telefon</label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input"
            placeholder="0532 123 45 67"
          />
        </div>

        <div>
          <label htmlFor="city" className="label">Şehir</label>
          <input
            id="city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="input"
            placeholder="Erzincan"
            required
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          İşletmemi Oluştur
        </button>
      </form>
    </div>
  )
}
