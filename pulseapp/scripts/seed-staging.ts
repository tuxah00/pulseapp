/**
 * Staging / Demo Seed Scripti
 * ───────────────────────────
 * Mevcut Supabase DB'ye demo veri ekler.
 * Zaten seed yapılmışsa tekrar çalıştırılabilir (idempotent).
 *
 * Kullanım:
 *   npx tsx scripts/seed-staging.ts
 *
 * Gerekli env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SEED_BUSINESS_ID   (seed edilecek mevcut işletme ID'si)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const BUSINESS_ID = process.env.SEED_BUSINESS_ID!

if (!SUPABASE_URL || !SERVICE_KEY || !BUSINESS_ID) {
  console.error('Eksik env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_BUSINESS_ID')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const SEED_TAG = '[SEED]' // Demo müşteri isimlerinde bu tag bulunur

// ── Veri Setleri ──────────────────────────────────────────────────────────────

const FIRST_NAMES = ['Ayşe', 'Fatma', 'Zeynep', 'Elif', 'Merve', 'Selin', 'Büşra',
  'Esra', 'Derya', 'Gül', 'Ahmet', 'Mehmet', 'Mustafa', 'Ali', 'Ömer',
  'Hasan', 'Hüseyin', 'İbrahim', 'Yusuf', 'Can']
const LAST_NAMES = ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Doğan', 'Arslan',
  'Koç', 'Kurt', 'Aydın', 'Polat', 'Taş', 'Er', 'Çetin', 'Öztürk']
const SERVICES = ['Botoks', 'Dolgu', 'PRP', 'Lazer', 'Cilt Bakımı', 'Mezoterapi']
const SEGMENTS = ['new', 'regular', 'vip', 'regular', 'new']

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomPhone() {
  return `+905${Math.floor(100_000_000 + Math.random() * 900_000_000)}`
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function randomPastDate(maxDaysAgo = 180) {
  return daysAgo(Math.floor(Math.random() * maxDaysAgo))
}

// ── Ana Seed Fonksiyonu ───────────────────────────────────────────────────────

async function seed() {
  console.log(`🌱 Seed başlıyor — businessId: ${BUSINESS_ID}`)

  // ── 1. Mevcut demo müşteri sayısını kontrol et ──
  const { count } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', BUSINESS_ID)
    .ilike('full_name', `%${SEED_TAG}%`)

  if ((count ?? 0) >= 30) {
    console.log(`✅ Zaten ${count} demo müşteri var — seed atlandı.`)
    return
  }

  // ── 2. 30 Müşteri oluştur ──────────────────────────────────────────────────
  console.log('👥 30 demo müşteri oluşturuluyor…')
  const customers: { id: string; full_name: string }[] = []

  for (let i = 0; i < 30; i++) {
    const firstName = randomItem(FIRST_NAMES)
    const lastName = randomItem(LAST_NAMES)
    const fullName = `${firstName} ${lastName} ${SEED_TAG}`

    const { data, error } = await supabase
      .from('customers')
      .insert({
        business_id: BUSINESS_ID,
        full_name: fullName,
        phone: randomPhone(),
        segment: randomItem(SEGMENTS),
        birthday: i < 10 ? `199${i % 5}-0${(i % 9) + 1}-15` : null,
        notes: 'Demo veri — seed-staging.ts',
      })
      .select('id, full_name')
      .single()

    if (error) {
      console.warn(`  ⚠ Müşteri oluşturulamadı: ${error.message}`)
    } else if (data) {
      customers.push(data)
    }
  }
  console.log(`  ✓ ${customers.length} müşteri oluşturuldu`)

  // ── 3. Hizmetleri çek ──────────────────────────────────────────────────────
  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration, price')
    .eq('business_id', BUSINESS_ID)
    .limit(10)

  const servicePool = services?.length ? services : SERVICES.map((name, i) => ({
    id: null,
    name,
    duration: 30 + i * 15,
    price: 500 + i * 200,
  }))

  // ── 4. 6 Aylık randevu geçmişi ────────────────────────────────────────────
  console.log('📅 Randevu geçmişi oluşturuluyor…')
  let appointmentCount = 0
  const STATUSES = ['completed', 'completed', 'completed', 'cancelled', 'no_show']

  for (const customer of customers.slice(0, 20)) {
    const apptCount = 2 + Math.floor(Math.random() * 8)
    for (let j = 0; j < apptCount; j++) {
      const service = randomItem(servicePool)
      const apptDate = randomPastDate(180)
      const hour = 9 + Math.floor(Math.random() * 9)
      const startTime = `${String(hour).padStart(2, '0')}:00`
      const endTime = `${String(hour + 1).padStart(2, '0')}:00`

      const { error } = await supabase.from('appointments').insert({
        business_id: BUSINESS_ID,
        customer_id: customer.id,
        service_id: service.id ?? undefined,
        service_name: service.name,
        appointment_date: apptDate,
        start_time: startTime,
        end_time: endTime,
        status: randomItem(STATUSES),
        price: service.price ?? 500,
        notes: `Demo randevu — ${customer.full_name}`,
      })
      if (!error) appointmentCount++
    }
  }
  console.log(`  ✓ ${appointmentCount} randevu oluşturuldu`)

  // ── 5. 20 Demo Fotoğraf Kaydı ─────────────────────────────────────────────
  console.log('📸 Fotoğraf kayıtları oluşturuluyor…')
  const PHOTO_TYPES = ['before', 'after', 'progress'] as const
  let photoCount = 0
  const pairId = crypto.randomUUID()

  for (let i = 0; i < 20; i++) {
    const customer = customers[i % customers.length]
    const photoType = i < 10 ? (i % 2 === 0 ? 'before' : 'after') : 'progress'
    const usePair = i < 10

    const { error } = await supabase.from('customer_photos').insert({
      business_id: BUSINESS_ID,
      customer_id: customer.id,
      photo_url: `https://picsum.photos/seed/pulse${i}/400/400`,
      photo_type: photoType,
      pair_id: usePair ? pairId : null,
      notes: 'Demo fotoğraf — seed-staging.ts',
      is_public: i < 6,
    })
    if (!error) photoCount++
  }
  console.log(`  ✓ ${photoCount} fotoğraf kaydı oluşturuldu`)

  console.log('\n🎉 Seed tamamlandı!')
  console.log(`   Müşteri: ${customers.length} | Randevu: ${appointmentCount} | Fotoğraf: ${photoCount}`)
}

seed().catch((err) => {
  console.error('Seed başarısız:', err)
  process.exit(1)
})
