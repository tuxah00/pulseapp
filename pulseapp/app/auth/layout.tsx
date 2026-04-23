import { BarChart2, CalendarCheck, MessageSquare, Users } from 'lucide-react'

const features = [
  { icon: CalendarCheck, text: 'Online randevu ve takvim yönetimi' },
  { icon: Users,         text: 'Müşteri segmentasyonu ve CRM' },
  { icon: MessageSquare, text: 'Otomatik SMS hatırlatmaları' },
  { icon: BarChart2,     text: 'Gelir-gider ve performans analizi' },
]

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="public-page flex min-h-screen">
      {/* ── Sol panel: Marka (sadece md+) ── */}
      <div className="hidden md:flex md:w-[45%] lg:w-[40%] flex-col justify-between p-10 xl:p-14"
           style={{ background: 'linear-gradient(145deg, #1457e1 0%, #338dff 60%, #7c3aed 100%)' }}>
        {/* Logo */}
        <div>
          <span className="text-2xl font-bold text-white tracking-tight">
            Pulse<span className="text-blue-200">App</span>
          </span>
        </div>

        {/* Orta içerik */}
        <div className="space-y-8">
          <div>
            <h2 className="text-3xl xl:text-4xl font-bold text-white leading-snug">
              İşletmenizi dijitale taşıyın
            </h2>
            <p className="mt-3 text-blue-100 text-base leading-relaxed">
              Randevu, müşteri ve ödeme yönetimini tek platformda birleştirin.
              14 gün ücretsiz, kart gerekmez.
            </p>
          </div>

          <ul className="space-y-4">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                  <Icon size={18} className="text-white" />
                </span>
                <span className="text-sm text-blue-50">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Alt */}
        <p className="text-xs text-blue-200">© 2025 PulseApp · Tüm hakları saklıdır</p>
      </div>

      {/* ── Sağ panel: Form ── */}
      <div className="flex flex-1 flex-col items-center justify-center
                      bg-gray-50 px-6 py-12 sm:px-12">
        {/* Sadece mobilde görünen logo */}
        <div className="mb-8 text-center md:hidden">
          <h1 className="text-3xl font-bold text-pulse-900">
            Pulse<span className="text-gray-900">App</span>
          </h1>
          <p className="mt-1 text-sm text-gray-500">İşletmenizin dijital asistanı</p>
        </div>

        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  )
}
