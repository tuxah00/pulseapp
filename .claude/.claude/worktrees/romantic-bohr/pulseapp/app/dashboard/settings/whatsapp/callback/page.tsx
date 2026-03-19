'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default function WhatsAppCallbackPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [message, setMessage] = useState<string>('Giriş tamamlanıyor...')

  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const errorParam = searchParams.get('error')

    if (errorParam) {
      const errDesc = searchParams.get('error_description') || errorParam
      router.replace(
        `/dashboard/settings/whatsapp?error=${encodeURIComponent(errDesc)}`,
      )
      return
    }

    if (!code || !state) {
      setMessage('Eksik parametre. Ayarlar sayfasına yönlendiriliyorsunuz.')
      setTimeout(() => router.replace('/dashboard/settings/whatsapp'), 2000)
      return
    }

    const redirectUri =
      typeof window !== 'undefined'
        ? `${window.location.origin}/dashboard/settings/whatsapp/callback`
        : ''

    fetch('/api/whatsapp/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        businessId: state,
        redirect_uri: redirectUri || undefined,
      }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (data.success) {
          router.replace(
            `/dashboard/settings/whatsapp?success=${encodeURIComponent('WhatsApp bağlantısı başarılı!')}`,
          )
        } else {
          router.replace(
            `/dashboard/settings/whatsapp?error=${encodeURIComponent(data.error || 'Bağlantı hatası')}`,
          )
        }
      })
      .catch(() => {
        router.replace(
          `/dashboard/settings/whatsapp?error=${encodeURIComponent('Bağlantı isteği başarısız.')}`,
        )
      })
  }, [searchParams, router])

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-green-600" />
      <p className="text-sm text-gray-600">{message}</p>
    </div>
  )
}
