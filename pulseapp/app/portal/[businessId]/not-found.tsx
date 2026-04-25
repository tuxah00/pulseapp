import { FileQuestion, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

/**
 * Portal scope 404 sayfası.
 * `/portal/[businessId]/<bilinmeyen-yol>` durumunda bu sayfa açılır.
 */
export default function PortalNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="card max-w-md w-full p-8 text-center cursor-default">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-pulse-50 dark:bg-pulse-900/30 flex items-center justify-center">
          <FileQuestion className="w-8 h-8 text-pulse-900 dark:text-pulse-300" />
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Sayfa bulunamadı
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Aradığınız sayfa kaldırılmış ya da hiç var olmamış olabilir. URL'yi
          tekrar kontrol edin veya panele geri dönün.
        </p>
        <Link
          href="/"
          className="btn-primary inline-flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  )
}
