import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PulseApp — İşletmenizin Dijital Asistanı',
  description: 'AI destekli randevu yönetimi, WhatsApp entegrasyonu ve müşteri takibi.',
  keywords: ['randevu', 'kuaför', 'işletme yönetimi', 'whatsapp', 'AI asistan'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr" className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
