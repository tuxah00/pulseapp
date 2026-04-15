import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Müşteri Portalı — PulseApp',
  description: 'Randevularınızı görüntüleyin ve yönetin.',
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Müşteri portalı her zaman light mode — dark class'ını kaldır */}
      <script
        dangerouslySetInnerHTML={{
          __html: `document.documentElement.classList.remove('dark');`,
        }}
      />
      <div className="min-h-screen bg-gray-50 portal-layout">
        {children}
      </div>
    </>
  )
}
