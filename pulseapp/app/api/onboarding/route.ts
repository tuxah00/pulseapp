// RLS bypass: onboarding — staff_members kaydı henüz yok, RLS kullanıcıyı işletmeye bağlayamaz
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getSeedForSector } from '@/lib/config/sector-seeds'
import type { SectorType } from '@/types'
import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/onboarding' })

/**
 * Yeni oluşturulan işletmeye sektöre özel örnek içerik (hizmet, paket, otomatik
 * mesaj akışı) ekler. Hata durumunda onboarding'i bozmamak için try/catch altında.
 */
async function seedSectorContent(
  supabase: ReturnType<typeof createAdminClient>,
  businessId: string,
  sector: SectorType,
) {
  const seed = getSeedForSector(sector)
  if (!seed) return

  // Zaten hizmet varsa (tekrar çağrı) tekrar seed yapma
  const { count: existingCount } = await supabase
    .from('services')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
  if ((existingCount ?? 0) > 0) return

  // 1) Hizmetler
  const serviceRows = seed.services.map(s => ({
    business_id: businessId,
    name: s.name,
    description: s.description ?? null,
    duration_minutes: s.duration_minutes,
    price: s.price,
    sort_order: s.sort_order ?? 0,
    recommended_interval_days: s.recommended_interval_days ?? null,
    is_active: true,
  }))
  const { data: insertedServices, error: svcErr } = await supabase
    .from('services')
    .insert(serviceRows)
    .select('id, name')
  if (svcErr) {
    log.error({ err: svcErr }, '[Seed] services ekleme hatası')
    return
  }

  // seed key → service_id eşlemesi (name üzerinden)
  const nameToId = new Map<string, string>((insertedServices ?? []).map(r => [r.name, r.id]))
  const keyToServiceId = new Map<string, string>()
  for (const s of seed.services) {
    const id = nameToId.get(s.name)
    if (id) keyToServiceId.set(s.key, id)
  }

  // 2) Paketler
  if (seed.packages.length > 0) {
    const pkgRows = seed.packages.map(p => ({
      business_id: businessId,
      name: p.name,
      description: p.description ?? null,
      service_id: p.service_key ? keyToServiceId.get(p.service_key) ?? null : null,
      sessions_total: p.sessions_total,
      price: p.price,
      validity_days: p.validity_days ?? null,
      sort_order: p.sort_order ?? 0,
      is_active: true,
    }))
    const { error: pkgErr } = await supabase.from('service_packages').insert(pkgRows)
    if (pkgErr) log.error({ err: pkgErr }, '[Seed] service_packages ekleme hatası')
  }

  // 3) Otomatik mesaj akışları
  if (seed.workflows.length > 0) {
    const wfRows = seed.workflows.map(w => ({
      business_id: businessId,
      name: w.name,
      trigger_type: w.trigger_type,
      is_active: w.is_active,
      steps: w.steps,
    }))
    const { error: wfErr } = await supabase.from('workflows').insert(wfRows)
    if (wfErr) log.error({ err: wfErr }, '[Seed] workflows ekleme hatası')
  }
}

export async function POST(request: NextRequest) {
  try {
    // Kimlik doğrulama
    const authClient = createServerSupabaseClient()
    const { data: { user } } = await authClient.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
    }

    const body = await request.json()
    const { user_id, business_name, sector, phone, city } = body

    if (!user_id || !business_name || !sector) {
      return NextResponse.json(
        { error: 'Eksik bilgi: user_id, business_name ve sector zorunlu.' },
        { status: 400 }
      )
    }

    // Gönderilen user_id'nin oturum açan kullanıcıyla eşleştiğini doğrula
    if (user_id !== user.id) {
      return NextResponse.json({ error: 'Yetkisiz: kullanıcı doğrulaması başarısız' }, { status: 403 })
    }

    const supabase = createAdminClient()

    // Supabase fonksiyonunu çağır
    const { data, error } = await supabase.rpc('create_business_for_user', {
      p_user_id: user_id,
      p_business_name: business_name,
      p_sector: sector,
      p_phone: phone || null,
      p_city: city || null,
    })

    if (error) {
      log.error({ err: error }, 'İşletme oluşturma hatası')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Sektör bazlı örnek içerikleri yükle (hizmet, paket, otomatik mesaj)
    try {
      if (data) {
        await seedSectorContent(supabase, data as string, sector as SectorType)
      }
    } catch (seedErr) {
      log.error({ err: seedErr }, 'Seed içerik ekleme hatası')
      // Seed başarısız olsa da onboarding'i bitir
    }

    return NextResponse.json({ business_id: data })
  } catch (err) {
    log.error({ err }, 'Onboarding hatası')
    return NextResponse.json(
      { error: 'Sunucu hatası.' },
      { status: 500 }
    )
  }
}
