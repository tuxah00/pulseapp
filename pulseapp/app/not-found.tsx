import Link from 'next/link'
import { Compass, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pulse-50 via-white to-pulse-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg p-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-pulse-900/10 dark:bg-pulse-900/30 text-pulse-900 dark:text-pulse-300">
            <Compass className="h-8 w-8" />
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider text-pulse-900 dark:text-pulse-300">
            404
          </p>
          <h1 className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
            Sayfa bulunamadı
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Aradığınız sayfa kaldırılmış, taşınmış ya da hiç var olmamış olabilir.
            Lütfen bağlantıyı kontrol edin veya ana sayfaya dönün.
          </p>

          <div className="mt-6 flex items-center justify-center">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-pulse-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-pulse-900/90 focus:outline-none focus:ring-2 focus:ring-pulse-900/30"
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
