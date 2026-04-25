import type { Metadata, Viewport } from 'next'
import { GeistSans } from 'geist/font/sans'
import './globals.css'
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: 'PulseApp — İşletmenizin Dijital Asistanı',
  description: 'AI destekli randevu yönetimi ve müşteri takibi.',
  keywords: ['randevu', 'kuaför', 'işletme yönetimi', 'AI asistan'],
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
  },
}

// themeColor belongs in viewport (not metadata) in Next.js 14+
export const viewport: Viewport = {
  themeColor: '#193d8f',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" className={cn(GeistSans.variable, "font-sans")} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});})}`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var html=document.documentElement;function k(e){if(e.key==='Tab'||(e.key&&e.key.indexOf('Arrow')===0))html.classList.add('using-keyboard');}function m(){html.classList.remove('using-keyboard');}document.addEventListener('keydown',k,true);document.addEventListener('mousedown',m,true);document.addEventListener('pointerdown',m,true);document.addEventListener('touchstart',m,true);})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
