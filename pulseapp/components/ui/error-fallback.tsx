'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertOctagon, Home, RefreshCcw } from 'lucide-react'

export interface ErrorFallbackProps {
  /**
   * Next.js App Router error.tsx prop'u — Error nesnesi `digest` alanı içerebilir.
   */
  error: Error & { digest?: string }
  /**
   * Next.js'in error boundary'sini sıfırlayan callback. Mevcut değilse "Yeniden Dene"
   * butonu sayfayı reload eder.
   */
  reset?: () => void
  /**
   * Üst başlık. Varsayılan: "Bir şeyler ters gitti".
   */
  title?: string
  /**
   * Kullanıcıya gösterilecek kısa açıklama.
   */
  description?: string
  /**
   * "Ana Sayfaya Dön" butonunun gideceği rota. Varsayılan `/dashboard`.
   */
  homeHref?: string
  /**
   * Tam ekran (min-h-screen) mi yoksa segment içi mi gösterilsin.
   */
  fullScreen?: boolean
}

/**
 * Paylaşılan hata fallback bileşeni.
 *
 * - `error.tsx` ve `global-error.tsx` dosyalarında kullanılır.
 * - Production'da yalnızca `error.digest` gösterilir; geliştirme modunda mesaj + stack açılır.
 * - Yalnızca `console.error` ile loglar (Sentry vb. ileride ayrı bir fazda eklenir).
 */
export default function ErrorFallback({
  error,
  reset,
  title = 'Bir şeyler ters gitti',
  description = 'Beklenmeyen bir hata oluştu. Sorun devam ederse destek ekibimizle iletişime geçin.',
  homeHref = '/dashboard',
  fullScreen = false,
}: ErrorFallbackProps) {
  useEffect(() => {
    // Vercel logs üzerinden digest ile bulunabilmesi için
    console.error('[ErrorFallback]', error)
  }, [error])

  const isDev = process.env.NODE_ENV === 'development'

  const handleRetry = () => {
    if (reset) {
      reset()
    } else if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  return (
    <div
      className={
        (fullScreen ? 'min-h-screen ' : 'min-h-[60vh] ') +
        'flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4'
      }
    >
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-pulse-900/10 dark:bg-pulse-900/30 text-pulse-900 dark:text-pulse-300">
            <AlertOctagon className="h-8 w-8" />
          </div>

          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{description}</p>

          {error?.digest && (
            <p className="mt-4 inline-block rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-mono text-gray-600 dark:text-gray-300">
              Hata kodu: {error.digest}
            </p>
          )}

          {isDev && (error?.message || error?.stack) && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-pulse-900 dark:hover:text-pulse-300">
                Geliştirici ayrıntıları
              </summary>
              <div className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-950 p-3 text-left">
                <p className="text-xs font-mono text-red-300 break-all">{error.message}</p>
                {error.stack && (
                  <pre className="mt-2 text-[11px] font-mono text-gray-400 whitespace-pre-wrap break-all">
                    {error.stack}
                  </pre>
                )}
              </div>
            </details>
          )}

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-pulse-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-pulse-900/90 focus:outline-none focus:ring-2 focus:ring-pulse-900/30"
            >
              <RefreshCcw className="h-4 w-4" />
              Yeniden Dene
            </button>
            <Link
              href={homeHref}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm transition hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Home className="h-4 w-4" />
              Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
