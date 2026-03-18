import Link from 'next/link'
import { Zap, Calendar, MessageSquare, Star, Users, ArrowRight } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pulse-500">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-bold">
            Pulse<span className="text-pulse-600">App</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Giriş Yap
          </Link>
          <Link href="/auth/register" className="btn-primary text-sm">
            Ücretsiz Dene
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-20 text-center max-w-4xl mx-auto">
        <div className="mb-4 inline-flex items-center rounded-full bg-pulse-50 px-4 py-1.5 text-sm font-medium text-pulse-700">
          🚀 14 gün ücretsiz deneyin
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
          İşletmenizin
          <span className="text-pulse-600"> dijital asistanı</span>
        </h1>
        <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto">
          Akıllı randevu yönetimi, otomatik hatırlatıcılar,
          müşteri takibi ve yorum toplama — hepsi tek platformda.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/auth/register" className="btn-primary text-base px-8 py-3">
            Ücretsiz Başla <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link href="#features" className="btn-secondary text-base px-8 py-3">
            Özellikleri Gör
          </Link>
        </div>
      </section>

      {/* Özellikler */}
      <section id="features" className="px-6 py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-center text-3xl font-bold text-gray-900 mb-12">
            Her şey tek panelden
          </h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<Calendar className="h-6 w-6" />}
              title="Akıllı Randevu"
              desc="7/24 online randevu, çakışma kontrolü, otomatik hatırlatıcılar"
            />
            <FeatureCard
              icon={<MessageSquare className="h-6 w-6" />}
              title="Online Randevu"
              desc="Müşterileriniz online randevu alır, siz dashboard'dan yönetirsiniz"
            />
            <FeatureCard
              icon={<Star className="h-6 w-6" />}
              title="Yorum Yönetimi"
              desc="Otomatik yorum talebi, düşük puan uyarısı, Google yorum yönlendirme"
            />
            <FeatureCard
              icon={<Users className="h-6 w-6" />}
              title="Müşteri Takibi"
              desc="VIP/risk segmentasyonu, geri kazanma mesajları, doğum günü hatırlatması"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 text-center text-sm text-gray-400">
        © 2025 PulseApp. Tüm hakları saklıdır.
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-pulse-50 text-pulse-600">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-500">{desc}</p>
    </div>
  )
}
