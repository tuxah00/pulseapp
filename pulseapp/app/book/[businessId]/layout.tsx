import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Randevu Al — PulseApp',
  description: 'Online randevu alın.',
}

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Müşteri tarafı her zaman light mode — dark class'ını kaldır */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.classList.remove('dark');`,
        }}
      />
      <div className="min-h-screen bg-gray-100 booking-page">
        <div className="mx-auto max-w-2xl px-4 py-8 pb-16">
          {children}
        </div>
      </div>
    </>
  )
}
