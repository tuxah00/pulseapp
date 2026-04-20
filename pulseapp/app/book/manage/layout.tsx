import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Randevu Yönetimi — PulseApp',
  description: 'Randevunuzu görüntüleyin, düzenleyin veya iptal edin.',
}

export default function ManageBookingLayout({
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
      <div className="booking-page">{children}</div>
    </>
  )
}
