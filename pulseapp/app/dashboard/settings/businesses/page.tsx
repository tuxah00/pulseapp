import { createClient } from '@supabase/supabase-js'
import { ExternalLink, Building2, Copy } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SECTOR_LABELS: Record<string, string> = {
  hair_salon: 'Kuaför', barber: 'Berber', beauty_salon: 'Güzellik Salonu',
  dental_clinic: 'Diş Kliniği', psychologist: 'Psikolog', lawyer: 'Avukat',
  restaurant: 'Restoran', cafe: 'Kafe', auto_service: 'Oto Servis',
  veterinary: 'Veteriner', physiotherapy: 'Fizyoterapi', dietitian: 'Diyetisyen',
  tutoring: 'Özel Ders', photo_studio: 'Fotoğraf Stüdyosu', car_wash: 'Oto Yıkama',
  spa_massage: 'Spa & Masaj', medical_aesthetic: 'Medikal Estetik', fitness: 'Fitness',
  yoga_pilates: 'Yoga & Pilates', tattoo_piercing: 'Dövme & Piercing', other: 'Diğer',
}

export default async function BusinessesSettingsPage() {
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, sector, city, district, subscription_plan, subscription_status, is_active, created_at')
    .order('created_at', { ascending: false })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">İşletmeler</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Sistemdeki tüm işletmeler — test ve yönetim için
        </p>
      </div>

      <div className="space-y-3">
        {!businesses?.length && (
          <div className="card py-12 text-center text-gray-400">Henüz işletme yok.</div>
        )}
        {businesses?.map((b) => (
          <div key={b.id} className="card p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-gray-900 dark:text-gray-100">{b.name}</p>
                <span className={`badge text-xs ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {b.is_active ? 'Aktif' : 'Pasif'}
                </span>
                <span className="badge bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs">
                  {SECTOR_LABELS[b.sector] || b.sector}
                </span>
                <span className="badge bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs">
                  {b.subscription_plan} · {b.subscription_status}
                </span>
              </div>
              {(b.city || b.district) && (
                <p className="text-xs text-gray-400 mt-0.5">{[b.district, b.city].filter(Boolean).join(', ')}</p>
              )}
              <p className="text-xs text-gray-300 dark:text-gray-600 mt-1 font-mono truncate">{b.id}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={`${appUrl}/book/${b.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Booking
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
