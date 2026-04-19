'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Oturum değişikliklerini izleyen guard bileşeni.
 *
 * Neden gerekli:
 * Bir tarayıcıda aynı anda birden fazla sekme açık iken, bir sekmeden farklı
 * bir hesaba giriş yapılırsa diğer sekme **eski kullanıcı için render edilmiş
 * sayfayı** göstermeye devam eder. Kullanıcı o sekmeden yeni hesabın cookie'siyle
 * istek atarsa yetki karışıklığı ve veri sızıntısı riski doğar.
 *
 * Çözüm: Supabase `onAuthStateChange` dinleyicisi ile her sekmede oturum
 * kimliğini takip et; sayfa yüklendiğinde sunucudan gelen `expectedUserId`
 * ile karşılaştır. Farklıysa → aktif işletme cookie'sini temizle ve sayfayı
 * yeniden yükle (yeni kullanıcıya ait doğru içerik SSR'dan gelsin).
 */
export default function SessionWatcher({ expectedUserId }: { expectedUserId: string }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // İlk yüklemede mevcut session'ı kontrol et — SSR ile client cookie'si
    // farklıysa (başka sekme oturum değiştirdiyse) hemen refresh et.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        // Oturum kapalı → login'e
        document.cookie = 'active_business_id=; path=/; max-age=0'
        router.replace('/auth/login')
        return
      }
      if (user.id !== expectedUserId) {
        // Farklı kullanıcı — stale sayfa. Cookie'yi temizle ve yenile.
        document.cookie = 'active_business_id=; path=/; max-age=0'
        router.refresh()
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        document.cookie = 'active_business_id=; path=/; max-age=0'
        router.replace('/auth/login')
        return
      }
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        const newUserId = session?.user?.id
        if (newUserId && newUserId !== expectedUserId) {
          document.cookie = 'active_business_id=; path=/; max-age=0'
          router.refresh()
        }
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [expectedUserId, router])

  return null
}
