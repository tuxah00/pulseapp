'use client'

import { AlertTriangle, RefreshCcw, Home } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

/**
 * Portal scope error boundary.
 * `/portal/[businessId]/*` altındaki herhangi bir hata bu sayfayı tetikler.
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Production'da Sentry'e iletilebilir; şu an sadece console
    if (process.env.NODE_ENV !== 'production') {
      console.error('[portal error]', error)
    }
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="card max-w-md w-full p-8 text-center cursor-default">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-pulse-50 dark:bg-pulse-900/30 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-pulse-900 dark:text-pulse-300" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Bir şeyler ters gitti
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Sayfayı yüklerken beklenmedik bir hata oluştu. Tekrar denemeyi seçebilir
          veya panele dönebilirsiniz.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={reset}
            className="btn-primary flex items-center justify-center gap-2 flex-1"
          >
            <RefreshCcw className="w-4 h-4" />
            Tekrar Dene
          </button>
          <Link
            href="/"
            className="btn-secondary flex items-center justify-center gap-2 flex-1"
          >
            <Home className="w-4 h-4" />
            Ana Sayfa
          </Link>
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
