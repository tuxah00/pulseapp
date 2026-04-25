'use client'

import { AlertTriangle, RefreshCcw, LayoutDashboard } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'
import { useParams } from 'next/navigation'

/**
 * Portal dashboard scope error boundary.
 * Dashboard alt rotalarındaki hatalarda layout korunur, içerik bu sayfaya düşer.
 */
export default function PortalDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const params = useParams<{ businessId: string }>()
  const businessId = params?.businessId

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[portal/dashboard error]', error)
    }
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="card max-w-md w-full p-8 text-center cursor-default">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-pulse-50 dark:bg-pulse-900/30 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-pulse-900 dark:text-pulse-300" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Bu bölüm yüklenemedi
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Geçici bir hata oluştu. Tekrar deneyebilir veya özet sayfasına dönebilirsiniz.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={reset}
            className="btn-primary flex items-center justify-center gap-2 flex-1"
          >
            <RefreshCcw className="w-4 h-4" />
            Tekrar Dene
          </button>
          {businessId && (
            <Link
              href={`/portal/${businessId}/dashboard`}
              className="btn-secondary flex items-center justify-center gap-2 flex-1"
            >
              <LayoutDashboard className="w-4 h-4" />
              Özete Dön
            </Link>
          )}
        </div>
        {error.digest && (
          <p className="mt-4 text-[11px] text-gray-400 dark:text-gray-500">
            Hata kimliği: <span className="tabular-nums">{error.digest}</span>
          </p>
        )}
      </div>
    </div>
  )
}
