import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import './globals.css'
import { cn } from "@/lib/utils";

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
    <html lang="tr" className={cn(GeistSans.variable, "font-sans")} suppressHydrationWarning>
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
