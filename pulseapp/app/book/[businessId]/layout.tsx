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
    <div className="min-h-screen bg-gray-50 booking-page">
      <div className="mx-auto max-w-lg px-4 py-8">
        {children}
      </div>
    </div>
  )
}
