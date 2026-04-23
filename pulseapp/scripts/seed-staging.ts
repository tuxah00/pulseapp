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

// Demo verisi, isim sonundaki bu tag ile tanınır
const SEED_TAG = '[SEED]'

// ── Veri Setleri ──────────────────────────────────────────────────────────────

const FIRST_NAMES = ['Ayşe', 'Fatma', 'Zeynep', 'Elif', 'Merve', 'Selin', 'Büşra',
  'Esra', 'Derya', 'Gül', 'Ahmet', 'Mehmet', 'Mustafa', 'Ali', 'Ömer',
  'Hasan', 'Hüseyin', 'İbrahim', 'Yusuf', 'Can']
const LAST_NAMES = ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Doğan', 'Arslan',
  'Koç', 'Kurt', 'Aydın', 'Polat', 'Taş', 'Er', 'Çetin', 'Öztürk']
const FALLBACK_SERVICES = ['Botoks', 'Dolgu', 'PRP', 'Lazer', 'Cilt Bakımı', 'Mezoterapi']
const SEGMENTS = ['new', 'regular', 'vip', 'regular', 'new']
const STATUSES = ['completed', 'completed', 'completed', 'cancelled', 'no_show']

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomPhone() {
  return `+905${Math.floor(100_000_000 + Math.random() * 900_000_000)}`
}

function randomPastDate(maxDaysAgo = 180) {
  const d = new Date()
  d.setDate(d.getDate() - Math.floor(Math.random() * maxDaysAgo))
  return d.toISOString().split('T')[0]
}

// ── Ana Seed Fonksiyonu ───────────────────────────────────────────────────────

async function seed() {
  console.log(`🌱 Seed başlıyor — businessId: ${BUSINESS_ID}`)

  // ── 1. Mevcut demo müşteri sayısını kontrol et (idempotency) ──
  const { count } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', BUSINESS_ID)
    .ilike('full_name', `%${SEED_TAG}%`)

  if ((count ?? 0) >= 30) {
    console.log(`✅ Zaten ${count} demo müşteri var — seed atlandı.`)
    return
  }

  // ── 2. 30 Müşteri — tek batch insert ──────────────────────────────────────
  console.log('👥 30 demo müşteri oluşturuluyor…')

  const customerRows = Array.from({ length: 30 }, (_, i) => ({
    business_id: BUSINESS_ID,
    full_name: `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)} ${SEED_TAG}`,
    phone: randomPhone(),
    segment: randomItem(SEGMENTS),
    birthday: i < 10 ? `199${i % 5}-0${(i % 9) + 1}-15` : null,
    notes: 'Demo veri — seed-staging.ts',
  }))

  const { data: insertedCustomers, error: custErr } = await supabase
    .from('customers')
    .insert(customerRows)
    .select('id, full_name')

  if (custErr) {
    console.error('Müşteri batch insert hatası:', custErr.message)
    process.exit(1)
  }
  const customers = insertedCustomers ?? []
  console.log(`  ✓ ${customers.length} müşteri oluşturuldu`)

  // ── 3. Hizmetleri çek ──────────────────────────────────────────────────────
  const { data: services } = await supabase
    .from('services')
    .select('id, name, duration, price')
    .eq('business_id', BUSINESS_ID)
    .limit(10)

  const servicePool = services?.length
    ? services
    : FALLBACK_SERVICES.map((name, i) => ({ id: null, name, duration: 30 + i * 15, price: 500 + i * 200 }))

  // ── 4. 6 Aylık randevu geçmişi — tek batch insert ────────────────────────
  console.log('📅 Randevu geçmişi oluşturuluyor…')

  const appointmentRows = customers.slice(0, 20).flatMap((customer) => {
    const apptCount = 2 + Math.floor(Math.random() * 8)
    return Array.from({ length: apptCount }, () => {
      const service = randomItem(servicePool)
      const hour = 9 + Math.floor(Math.random() * 9)
      return {
        business_id: BUSINESS_ID,
        customer_id: customer.id,
        service_id: service.id ?? undefined,
        service_name: service.name,
        appointment_date: randomPastDate(180),
        start_time: `${String(hour).padStart(2, '0')}:00`,
        end_time: `${String(hour + 1).padStart(2, '0')}:00`,
        status: randomItem(STATUSES),
        price: service.price ?? 500,
        notes: `Demo randevu — ${customer.full_name}`,
      }
    })
  })

  const { error: apptErr } = await supabase.from('appointments').insert(appointmentRows)
  if (apptErr) console.warn('  ⚠ Randevu insert hatası:', apptErr.message)
  else console.log(`  ✓ ${appointmentRows.length} randevu oluşturuldu`)

  // ── 5. 20 Demo Fotoğraf — 5 before/after çifti + 10 progress ─────────────
  // Her before/after çifti kendi pair_id'sine sahip (1 before + 1 after = 1 pair).
  console.log('📸 Fotoğraf kayıtları oluşturuluyor…')

  const photoRows = Array.from({ length: 20 }, (_, i) => {
    const customer = customers[i % customers.length]
    // 0-9 arası: 5 before/after çifti (çift i için pairId aynı; tek i için farklı pairId)
    // 10-19 arası: progress fotoğrafları
    const isPair = i < 10
    const pairIndex = isPair ? Math.floor(i / 2) : null
    return {
      business_id: BUSINESS_ID,
      customer_id: customer.id,
      photo_url: `https://picsum.photos/seed/pulse${i}/400/400`,
      photo_type: isPair ? (i % 2 === 0 ? 'before' : 'after') : 'progress',
      // Her çift (0+1, 2+3, 4+5, 6+7, 8+9) aynı pair_id'yi paylaşır
      pair_id: isPair ? `00000000-0000-0000-0000-${String(pairIndex).padStart(12, '0')}` : null,
      notes: 'Demo fotoğraf — seed-staging.ts',
      is_public: i < 6,
    }
  })

  const { error: photoErr } = await supabase.from('customer_photos').insert(photoRows)
  if (photoErr) console.warn('  ⚠ Fotoğraf insert hatası:', photoErr.message)
  else console.log(`  ✓ ${photoRows.length} fotoğraf kaydı oluşturuldu`)

  console.log('\n🎉 Seed tamamlandı!')
  console.log(`   Müşteri: ${customers.length} | Randevu: ${appointmentRows.length} | Fotoğraf: ${photoRows.length}`)
}

seed().catch((err) => {
  console.error('Seed başarısız:', err)
  process.exit(1)
})
