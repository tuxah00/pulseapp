'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertOctagon, Home, RefreshCcw } from 'lucide-react'

/**
 * Root layout (`app/layout.tsx`) çöktüğünde tetiklenen global error boundary.
 * Next.js bu dosyada kendi `<html>` ve `<body>` etiketlerini sağlamamızı bekler;
 * bu nedenle paylaşılan `ErrorFallback` bileşeni inline yeniden yazılır
 * (provider/theme bağlam yok; minimum HTML).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

  const isDev = process.env.NODE_ENV === 'development'

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background:
            'linear-gradient(135deg, #f0f4ff 0%, #ffffff 50%, #e6edff 100%)',
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          color: '#0f172a',
          padding: 16,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 520,
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: 16,
            boxShadow:
              '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            padding: 32,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              margin: '0 auto 20px',
              width: 64,
              height: 64,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(25, 61, 143, 0.1)',
              color: '#193d8f',
            }}
          >
            <AlertOctagon width={32} height={32} />
          </div>

          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
            Uygulama yüklenemedi
          </h1>
          <p
            style={{
              marginTop: 8,
              fontSize: 14,
              color: '#6b7280',
              lineHeight: 1.5,
            }}
          >
            Beklenmeyen bir hata nedeniyle PulseApp başlatılamadı. Sayfayı
            yenilemeyi deneyin; sorun devam ederse destek ekibimizle iletişime
            geçin.
          </p>

          {error?.digest && (
            <p
              style={{
                marginTop: 16,
                display: 'inline-block',
                background: '#f3f4f6',
                color: '#4b5563',
                padding: '4px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontFamily:
                  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
              }}
            >
              Hata kodu: {error.digest}
            </p>
          )}

          {isDev && error?.message && (
            <pre
              style={{
                marginTop: 16,
                textAlign: 'left',
                background: '#0b1020',
                color: '#fca5a5',
                padding: 12,
                borderRadius: 8,
                fontSize: 11,
                overflow: 'auto',
                maxHeight: 200,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {error.message}
              {error.stack ? '\n\n' + error.stack : ''}
            </pre>
          )}

          <div
            style={{
              marginTop: 24,
              display: 'flex',
              gap: 8,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#193d8f',
                color: '#ffffff',
                border: 'none',
                borderRadius: 8,
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <RefreshCcw width={16} height={16} />
              Yeniden Dene
            </button>
            <Link
              href="/dashboard"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                background: '#ffffff',
                color: '#374151',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
              }}
            >
              <Home width={16} height={16} />
              Ana Sayfaya Dön
            </Link>
          </div>
        </div>
      </body>
    </html>
  )
}
