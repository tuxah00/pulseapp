import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PulseApp — İşletmenizin Dijital Asistanı',
  description: 'AI destekli randevu yönetimi ve müşteri takibi.',
  keywords: ['randevu', 'kuaför', 'işletme yönetimi', 'AI asistan'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" className={inter.className} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
