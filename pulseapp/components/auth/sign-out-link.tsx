'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Loader2 } from 'lucide-react'

/**
 * Oturumu kapatıp login sayfasına yönlendiren küçük buton.
 * Onboarding ekranı gibi ana navigasyonun olmadığı yerlerde kullanıcıya
 * çıkış / hesap değiştirme seçeneği sunmak için kullanılır.
 */
export default function SignOutLink({ className = '' }: { className?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    // Çoklu işletme seçimi cookie'sini de temizle — farklı hesaba geçilince
    // stale business_id kalmasın.
    document.cookie = 'active_business_id=; path=/; max-age=0'
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 ${className}`}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <LogOut className="h-3.5 w-3.5" />
      )}
      Çıkış yap / Farklı hesap
    </button>
  )
}
