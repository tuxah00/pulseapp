#!/usr/bin/env node
/**
 * Estetik klinik seed scripti — pulseapp@gmail.com test hesabını
 * gerçekçi medical_aesthetic verisiyle doldurur.
 *
 * Kullanım:  node scripts/seed-clinic.mjs
 *
 * Idempotent: önce business_id'ye ait müşteri/randevu/fatura vb. tüm
 * test verilerini siler, sonra yeniden ekler.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ---------- .env.local yükleme ----------
function loadEnv() {
  try {
    const txt = readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8')
    for (const raw of txt.split('\n')) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue
      const eq = line.indexOf('=')
      if (eq < 0) continue
      const k = line.slice(0, eq).trim()
      const v = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[k]) process.env[k] = v
    }
  } catch (e) { /* env yoksa devam */ }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik')
  process.exit(1)
}

const TEST_EMAIL = 'pulseapp@gmail.com'
const TARGET_SECTOR = 'medical_aesthetic'

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------- yardımcılar ----------
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const pick = (arr) => arr[rand(0, arr.length - 1)]
const pickWeighted = (entries) => {
  // entries: [[value, weight], ...]
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = Math.random() * total
  for (const [v, w] of entries) { if ((r -= w) <= 0) return v }
  return entries[entries.length - 1][0]
}
const dayKey = (d) => d.toISOString().slice(0, 10)
const hhmm = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const placeholder = (seed, w = 400, h = 400) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`

async function exec(label, p) {
  const { data, error, count } = await p
  if (error) { console.error(`❌ ${label}:`, error.message); throw error }
  const n = Array.isArray(data) ? data.length : (count ?? '?')
  console.log(`   ✓ ${label}: ${n}`)
  return data
}

// ---------- veri havuzları ----------
const SERVICES = [
  { name: 'Konsültasyon', duration_minutes: 30, price: 500,  recommended_interval_days: null },
  { name: 'Botox Uygulaması', duration_minutes: 30, price: 2500, recommended_interval_days: 120 },
  { name: 'Dolgu (1 ml)', duration_minutes: 45, price: 3500, recommended_interval_days: 180 },
  { name: 'Lazer Epilasyon (Koltuk Altı)', duration_minutes: 30, price: 800,  recommended_interval_days: 30 },
  { name: 'Lazer Epilasyon (Bacak)', duration_minutes: 60, price: 1800, recommended_interval_days: 30 },
  { name: 'PRP Saç', duration_minutes: 60, price: 2800, recommended_interval_days: 30 },
  { name: 'PRP Cilt', duration_minutes: 60, price: 2500, recommended_interval_days: 30 },
  { name: 'Hydrafacial', duration_minutes: 60, price: 1500, recommended_interval_days: 30 },
  { name: 'Kimyasal Peeling', duration_minutes: 45, price: 1200, recommended_interval_days: 21 },
  { name: 'RF Yüz Germe', duration_minutes: 60, price: 2200, recommended_interval_days: 30 },
]

const ROOMS = [
  { name: 'Oda 1', color: '#a78bfa' },
  { name: 'Oda 2', color: '#f472b6' },
  { name: 'LED Odası', color: '#34d399' },
]

const EXTRA_STAFF = [
  { name: 'Dr. Selin Kaya',     role: 'staff', email: null, phone: null },
  { name: 'Esra Aydın (Estetisyen)', role: 'staff', email: null, phone: null },
]

const PACKAGES = [
  { name: 'Lazer Epilasyon Koltuk Altı — 8 Seans', service_name: 'Lazer Epilasyon (Koltuk Altı)', sessions_total: 8, price: 5500, validity_days: 365 },
  { name: 'Botox Yıllık — 3 Seans',                service_name: 'Botox Uygulaması',                sessions_total: 3, price: 6800, validity_days: 365 },
  { name: 'PRP Saç — 4 Seans',                     service_name: 'PRP Saç',                          sessions_total: 4, price: 9800, validity_days: 180 },
  { name: 'Kimyasal Peeling — 6 Seans',            service_name: 'Kimyasal Peeling',                 sessions_total: 6, price: 6000, validity_days: 240 },
]

const PATIENT_NAMES = [
  'Ayşe Yılmaz','Zeynep Kaya','Elif Şahin','Selin Öztürk','Deniz Aydın',
  'Ece Çelik','Merve Doğan','Esra Korkmaz','Pınar Demir','Burcu Aksoy',
  'Sevgi Arslan','Hande Yıldız','Gamze Erdem','Tuğba Polat','Damla Çetin',
  'Ceren Acar','Naz Karaca','Sıla Bulut','Ayça Tunç','İrem Ergin',
  'Aslı Güneş','Beste Kurt','Funda Özmen','Gizem Şimşek','Hilal Tan',
  'Mehmet Demir','Ahmet Kara','Burak Arslan','Cem Yıldız','Emre Şahin',
  'Kerem Polat','Murat Gürsoy','Onur Bayrak','Serkan Türk','Tarık Aslan',
  'Volkan Korkut','Yiğit Erol','Berk Tuna','Eren Yağmur','Doruk Kılıç',
]

const RECORD_TEMPLATES = [
  { diagnosis: 'Nazolabial dolgu planlaması',  treatment: '1 ml hyalüronik asit dolgu, sağ-sol simetri', priority: 'medium', category: 'Estetik Konsültasyon' },
  { diagnosis: 'Koltuk altı lazer epilasyon',  treatment: 'Diode lazer 8 seanslık paket — 30 gün ara', priority: 'low', category: 'Lazer' },
  { diagnosis: 'Alın botoks kontrolü',         treatment: '20 ünite, 3 nokta — 4 ay sonra tekrar', priority: 'medium', category: 'Botox' },
  { diagnosis: 'PRP — saç dökülmesi',          treatment: '4 seanslık PRP, ayda bir uygulama', priority: 'high', category: 'PRP' },
  { diagnosis: 'Cilt yenileme — Hydrafacial',  treatment: 'Aylık hydrafacial + ev bakım önerileri', priority: 'low', category: 'Cilt Bakımı' },
  { diagnosis: 'Akne sonrası leke',            treatment: 'Kimyasal peeling 6 seans', priority: 'medium', category: 'Peeling' },
  { diagnosis: 'Yüz oval kaybı',               treatment: 'RF yüz germe 4 seans + ev bakımı', priority: 'medium', category: 'RF' },
  { diagnosis: 'Dudak dolgusu kontrolü',       treatment: '0.5 ml top-up, 6 ay sonra revizyon', priority: 'low', category: 'Dolgu' },
  { diagnosis: 'Bacak lazer epilasyon',        treatment: '6 seanslık paket, anti-aknet bakım', priority: 'low', category: 'Lazer' },
  { diagnosis: 'PRP cilt — gözaltı',           treatment: 'Mezo + PRP kombine 3 seans', priority: 'medium', category: 'PRP' },
]

const ALLERGENS = [
  { allergen: 'Lateks',          severity: 'moderate', reaction: 'Cilt kızarıklığı' },
  { allergen: 'Lidokain',        severity: 'severe',   reaction: 'Anaflaksi riski' },
  { allergen: 'Hyalüronik Asit', severity: 'mild',     reaction: 'Lokal şişlik' },
  { allergen: 'Penisilin',       severity: 'severe',   reaction: 'Solunum güçlüğü' },
  { allergen: 'Nikel',           severity: 'mild',     reaction: 'Kontakt dermatit' },
  { allergen: 'Aspirin',         severity: 'moderate', reaction: 'Mide bulantısı' },
]

const CONTRAINDICATIONS = [
  { service_name: 'Dolgu (1 ml)',        allergen: 'Hyalüronik Asit', risk_level: 'high',     warning_message: 'Müşteri hyalüronik asit alerjisi bildirmiş — uygulama yapılmamalı' },
  { service_name: 'Botox Uygulaması',    allergen: 'Lidokain',        risk_level: 'high',     warning_message: 'Lidokain alerjisi — botox topik anestezi içerebilir' },
  { service_name: 'PRP Saç',             allergen: 'Lateks',          risk_level: 'medium',   warning_message: 'Eldiven değişimi gerekli (lateks-free)' },
]

const EXPENSE_TEMPLATES = [
  { category: 'Ürün/Malzeme', desc: 'Botoks ampul stok',         amount: 18000, recurring: false },
  { category: 'Ürün/Malzeme', desc: 'Hyalüronik asit dolgu',     amount: 22000, recurring: false },
  { category: 'Ürün/Malzeme', desc: 'Lazer sarf malzeme',        amount: 4500,  recurring: false },
  { category: 'Ürün/Malzeme', desc: 'Hydrafacial serumları',     amount: 6500,  recurring: false },
  { category: 'Ürün/Malzeme', desc: 'PRP tüpleri ve kit',        amount: 3200,  recurring: false },
  { category: 'Kira',         desc: 'Klinik kirası',             amount: 35000, recurring: true, period: 'monthly' },
  { category: 'Personel',     desc: 'Maaşlar',                   amount: 65000, recurring: true, period: 'monthly' },
  { category: 'Faturalar',    desc: 'Elektrik',                  amount: 4200,  recurring: true, period: 'monthly' },
  { category: 'Faturalar',    desc: 'Su',                        amount: 850,   recurring: true, period: 'monthly' },
  { category: 'Faturalar',    desc: 'İnternet & telefon',        amount: 1200,  recurring: true, period: 'monthly' },
  { category: 'Reklam',       desc: 'Instagram reklam',          amount: 5000,  recurring: false },
  { category: 'Reklam',       desc: 'Google Ads kampanyası',     amount: 3500,  recurring: false },
  { category: 'Bakım',        desc: 'Lazer cihaz periyodik bakımı', amount: 7500, recurring: false },
  { category: 'Bakım',        desc: 'Klima servisi',             amount: 1800,  recurring: false },
  { category: 'Muhasebe',     desc: 'Mali müşavir',              amount: 4500,  recurring: true, period: 'monthly' },
]

const INCOME_TEMPLATES = [
  { category: 'Konsültasyon Geliri', desc: 'Online konsültasyon',  amount: 500 },
  { category: 'Ürün Satışı',         desc: 'Ev bakım kremi satışı', amount: 850 },
  { category: 'Ürün Satışı',         desc: 'Güneş kremi seti',      amount: 1200 },
  { category: 'Komisyon',            desc: 'Cihaz tedarikçi komisyonu', amount: 3200 },
  { category: 'Paket/Üyelik',        desc: 'Paket peşinat',         amount: 2500 },
  { category: 'Kira Geliri',         desc: 'Alt kat kiracı',        amount: 8500 },
  { category: 'Diğer',               desc: 'Eski ekipman satışı',   amount: 4200 },
  { category: 'Konsültasyon Geliri', desc: 'Telefon danışmanlığı',  amount: 350 },
  { category: 'Ürün Satışı',         desc: 'Saç bakım ürünü',       amount: 690 },
  { category: 'Diğer',               desc: 'İade tahsilatı',        amount: 1100 },
]

const REVIEW_COMMENTS = [
  'Çok memnun kaldım, ekip çok ilgili.',
  'Sonuçlar harika, kesinlikle tavsiye ederim.',
  'Klinik temiz ve modern, doktor güler yüzlü.',
  'Beklediğimden çok daha iyi bir deneyimdi.',
  'Profesyonel hizmet, randevu saatine sadık kaldılar.',
  'Sonuçlardan çok memnunum, teşekkürler.',
  'Hijyen ve özen mükemmeldi.',
  'İlk kez geldim ama sürekli müşterileri olacağım.',
  'Ortam ferah, personel kibar.',
  'Doktor hanım çok deneyimli, içim rahat etti.',
  'Fiyat-performans çok iyi.',
  'Sonuçlar için biraz erken ama görünüm güzel.',
]

// ---------- ana akış ----------
async function main() {
  console.log('🌱 Estetik Klinik Seed Başladı\n')

  // 1) İşletme bul
  console.log('1) İşletme tespiti')
  const { data: usrLookup, error: usrErr } = await sb.rpc('seed_dummy_noop').then(
    () => ({ data: null, error: null }),
    () => ({ data: null, error: null })
  )
  // auth.users'ı RPC'siz okumak için: admin auth API
  const { data: usersList, error: listErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (listErr) throw listErr
  const testUser = usersList?.users?.find(u => u.email === TEST_EMAIL)
  if (!testUser) throw new Error(`${TEST_EMAIL} bulunamadı`)

  const { data: staffRows, error: staffErr } = await sb.from('staff_members')
    .select('id, business_id, role').eq('user_id', testUser.id).limit(1)
  if (staffErr) throw staffErr
  if (!staffRows?.length) throw new Error('staff_members kaydı yok — önce dashboard onboarding tamamlanmalı')

  const businessId = staffRows[0].business_id
  const ownerStaffId = staffRows[0].id
  console.log(`   ✓ business_id = ${businessId}`)
  console.log(`   ✓ owner staff_id = ${ownerStaffId}`)

  // sektörü garanti et
  await sb.from('businesses').update({ sector: TARGET_SECTOR }).eq('id', businessId)

  // 2) Temizlik
  console.log('\n2) Mevcut test verisi temizleniyor')
  const cleanTables = [
    'invoice_payments','pos_transactions','invoices','expenses','income',
    'follow_up_queue','protocol_sessions','treatment_protocols',
    'package_usages','customer_packages','service_packages',
    'customer_photos','customer_allergies','service_contraindications',
    'reviews','messages','consent_records',
    'appointments','rooms','services','customers',
  ]
  // patient_file kayıtlarını ayrıca sil
  await exec('business_records (patient_file)',
    sb.from('business_records').delete().eq('business_id', businessId).eq('type', 'patient_file').select('id'))
  for (const t of cleanTables) {
    await exec(`temizlik · ${t}`,
      sb.from(t).delete().eq('business_id', businessId).select('id'))
  }
  // Owner dışındaki staff'ları temizle (önceki seed'den kalan ek personel)
  await exec('temizlik · ek staff',
    sb.from('staff_members').delete().eq('business_id', businessId).neq('id', ownerStaffId).select('id'))

  // 3) Services
  console.log('\n3) Hizmetler')
  const servicesPayload = SERVICES.map((s, i) => ({
    business_id: businessId, ...s, sort_order: i, is_active: true,
  }))
  const services = await exec('services',
    sb.from('services').insert(servicesPayload).select('id, name, price, duration_minutes'))
  const svcByName = new Map(services.map(s => [s.name, s]))

  // 4) Rooms
  console.log('\n4) Odalar')
  const rooms = await exec('rooms',
    sb.from('rooms').insert(ROOMS.map(r => ({ business_id: businessId, ...r, capacity: 1, is_active: true })))
      .select('id, name'))

  // 5) Ek staff
  console.log('\n5) Ek personel')
  const extraStaff = await exec('staff_members',
    sb.from('staff_members').insert(EXTRA_STAFF.map(s => ({
      business_id: businessId, user_id: null, ...s, is_active: true,
    }))).select('id, name'))
  const allStaff = [{ id: ownerStaffId, name: 'Sahip' }, ...extraStaff]

  // 6) Service packages
  console.log('\n6) Paket şablonları')
  const pkgPayload = PACKAGES.map((p, i) => ({
    business_id: businessId,
    name: p.name,
    service_id: svcByName.get(p.service_name)?.id ?? null,
    sessions_total: p.sessions_total,
    price: p.price,
    validity_days: p.validity_days,
    sort_order: i,
    is_active: true,
  }))
  const pkgTemplates = await exec('service_packages',
    sb.from('service_packages').insert(pkgPayload).select('id, name, service_id, sessions_total, price'))

  // 7) Customers (40)
  console.log('\n7) Hastalar')
  const today = new Date('2026-04-17T12:00:00+03:00')
  const segments = []
  for (let i = 0; i < 8;  i++) segments.push('vip')
  for (let i = 0; i < 14; i++) segments.push('regular')
  for (let i = 0; i < 10; i++) segments.push('new')
  for (let i = 0; i < 5;  i++) segments.push('risk')
  for (let i = 0; i < 3;  i++) segments.push('lost')

  const customersPayload = PATIENT_NAMES.map((name, i) => {
    const segment = segments[i]
    const phoneSuffix = String(1000 + i).padStart(4, '0')
    const dobYear = 2026 - rand(22, 60)
    const dob = `${dobYear}-${String(rand(1, 12)).padStart(2, '0')}-${String(rand(1, 28)).padStart(2, '0')}`
    let total_visits = 0, total_revenue = 0, last_visit_at = null, no_show_score = 0, created_at = null
    if (segment === 'vip')      { total_visits = rand(10, 22); total_revenue = rand(22000, 65000); last_visit_at = addDays(today, -rand(2, 25)).toISOString(); no_show_score = rand(0, 5) }
    else if (segment === 'regular') { total_visits = rand(3, 9); total_revenue = rand(4500, 18000); last_visit_at = addDays(today, -rand(5, 45)).toISOString(); no_show_score = rand(0, 10) }
    else if (segment === 'new') { total_visits = rand(0, 2); total_revenue = rand(0, 2500); created_at = addDays(today, -rand(1, 25)).toISOString(); last_visit_at = total_visits > 0 ? addDays(today, -rand(1, 20)).toISOString() : null }
    else if (segment === 'risk') { total_visits = rand(2, 8); total_revenue = rand(3500, 14000); last_visit_at = addDays(today, -rand(60, 120)).toISOString(); no_show_score = rand(15, 30) }
    else                         { total_visits = rand(2, 6); total_revenue = rand(2500, 9000); last_visit_at = addDays(today, -rand(180, 320)).toISOString(); no_show_score = rand(20, 50) }

    return {
      business_id: businessId,
      name,
      phone: `+9055599${phoneSuffix.padStart(5, '0')}`.slice(0, 16),
      email: Math.random() < 0.5 ? `${name.toLowerCase().replace(/\s/g, '.').replace(/ı/g,'i').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ş/g,'s').replace(/ç/g,'c').replace(/ğ/g,'g')}@example.com` : null,
      birthday: dob,
      notes: Math.random() < 0.7 ? pick([
        'Hassas cilt — patch test öneriliyor',
        'Sürekli müşteri, paket tercih ediyor',
        'Yoğun çalışma temposu — akşam saat tercih',
        'Önceki uygulamalardan memnun',
        'Güneş hassasiyeti var',
      ]) : null,
      segment,
      total_visits,
      total_revenue,
      last_visit_at,
      no_show_score,
      preferred_channel: pick(['sms', 'whatsapp', 'auto']),
      kvkk_consent_given: true,
      kvkk_consent_given_at: addDays(today, -rand(1, 60)).toISOString(),
      whatsapp_opted_in: Math.random() < 0.8,
      is_active: true,
      ...(created_at ? { created_at } : {}),
    }
  })
  const customers = await exec('customers',
    sb.from('customers').insert(customersPayload).select('id, name, segment, phone'))

  // 8) Consent records
  console.log('\n8) KVKK onayları')
  const consents = customers.map(c => ({
    business_id: businessId, customer_id: c.id, customer_phone: c.phone,
    consent_type: 'kvkk', method: 'in_person',
    given_at: addDays(today, -rand(1, 60)).toISOString(),
  }))
  // %75'ine ek marketing onayı
  for (const c of customers) {
    if (Math.random() < 0.75) {
      consents.push({
        business_id: businessId, customer_id: c.id, customer_phone: c.phone,
        consent_type: 'marketing', method: 'in_person',
        given_at: addDays(today, -rand(1, 60)).toISOString(),
      })
    }
  }
  await exec('consent_records', sb.from('consent_records').insert(consents).select('id'))

  // 9) Allergies (6)
  console.log('\n9) Alerjiler')
  const allergyCustomers = [...customers].sort(() => Math.random() - 0.5).slice(0, 6)
  const allergiesPayload = allergyCustomers.map((c, i) => ({
    business_id: businessId, customer_id: c.id,
    ...ALLERGENS[i % ALLERGENS.length],
  }))
  await exec('customer_allergies',
    sb.from('customer_allergies').insert(allergiesPayload).select('id'))

  // 10) Contraindications (3)
  console.log('\n10) Kontrendikasyonlar')
  const contraindicationsPayload = CONTRAINDICATIONS.map(c => ({
    business_id: businessId,
    service_id: svcByName.get(c.service_name)?.id,
    allergen: c.allergen,
    risk_level: c.risk_level,
    warning_message: c.warning_message,
  })).filter(c => c.service_id)
  await exec('service_contraindications',
    sb.from('service_contraindications').insert(contraindicationsPayload).select('id'))

  // 11) Patient files (~30)
  console.log('\n11) Hasta dosyaları')
  const fileCustomers = [...customers].sort(() => Math.random() - 0.5).slice(0, 30)
  const filesPayload = fileCustomers.map((c, i) => {
    const tpl = RECORD_TEMPLATES[i % RECORD_TEMPLATES.length]
    return {
      business_id: businessId,
      type: 'patient_file',
      title: `${c.name} — ${tpl.diagnosis}`,
      customer_id: c.id,
      data: {
        diagnosis: tpl.diagnosis,
        treatment_plan: tpl.treatment,
        treatment_notes: 'Düzenli takip planlandı.',
        priority: tpl.priority,
        category: tpl.category,
        follow_up_date: dayKey(addDays(today, rand(7, 60))),
        dob: '1985-01-01',
        phone: c.phone,
      },
    }
  })
  await exec('business_records (patient_file)',
    sb.from('business_records').insert(filesPayload).select('id'))

  // 12) Customer packages (12)
  console.log('\n12) Müşteri paketleri')
  const pkgCustomers = [...customers].filter(c => c.segment === 'vip' || c.segment === 'regular').slice(0, 12)
  const customerPackagesPayload = pkgCustomers.map((c, i) => {
    const tpl = pkgTemplates[i % pkgTemplates.length]
    const used = i === 0 ? tpl.sessions_total : rand(1, Math.max(1, tpl.sessions_total - 1))
    return {
      business_id: businessId,
      package_id: tpl.id,
      customer_id: c.id,
      customer_name: c.name,
      customer_phone: c.phone,
      package_name: tpl.name,
      service_id: tpl.service_id,
      sessions_total: tpl.sessions_total,
      sessions_used: used,
      price_paid: Number(tpl.price),
      status: used >= tpl.sessions_total ? 'completed' : 'active',
      purchase_date: dayKey(addDays(today, -rand(20, 80))),
      expiry_date: dayKey(addDays(today, 365)),
      staff_id: ownerStaffId,
    }
  })
  const customerPackages = await exec('customer_packages',
    sb.from('customer_packages').insert(customerPackagesPayload).select('id, customer_id, sessions_used, sessions_total, package_name, service_id, price_paid'))

  // 13) Treatment protocols (8)
  console.log('\n13) Tedavi protokolleri')
  const protoCustomers = [...customers].filter(c => c.segment === 'vip' || c.segment === 'regular').slice(0, 8)
  const protocolsPayload = protoCustomers.map((c, i) => {
    const opts = [
      { name: 'Lazer Epilasyon (Koltuk Altı) — 8 Seans', svc: 'Lazer Epilasyon (Koltuk Altı)', total: 8, completed: 3, interval: 30 },
      { name: 'Botox Kontrol — 3 Seans',                  svc: 'Botox Uygulaması',              total: 3, completed: 1, interval: 120 },
      { name: 'PRP Saç — 4 Seans',                        svc: 'PRP Saç',                       total: 4, completed: 2, interval: 30 },
      { name: 'Kimyasal Peeling — 6 Seans',               svc: 'Kimyasal Peeling',              total: 6, completed: 2, interval: 21 },
    ]
    const opt = opts[i % opts.length]
    return {
      business_id: businessId,
      customer_id: c.id,
      service_id: svcByName.get(opt.svc)?.id ?? null,
      name: opt.name,
      total_sessions: opt.total,
      completed_sessions: opt.completed,
      interval_days: opt.interval,
      status: 'active',
      created_by: ownerStaffId,
      notes: 'Düzenli takip, post-care talimatları verildi.',
    }
  })
  const protocols = await exec('treatment_protocols',
    sb.from('treatment_protocols').insert(protocolsPayload).select('id, customer_id, total_sessions, completed_sessions, interval_days, name'))

  // 14) Appointments (~180): geçmiş 90 gün + gelecek 14 gün
  console.log('\n14) Randevular')
  // her staff/oda kombosu için occupancy haritası: key = `${dayKey}|${staffId}`, value = list of [start, end] minutes
  const occupancy = new Map()
  const overlaps = (slots, start, end) => slots.some(([s, e]) => start < e && end > s)
  const services24 = services
  const newAppts = []

  function tryBookSlot(date, customerId, source, status) {
    const dk = dayKey(date)
    // Pazar (0) kapalı, diğer günler 09:00-19:00
    if (date.getDay() === 0) return null
    // 30 deneme: rastgele saat & service & staff
    for (let attempt = 0; attempt < 30; attempt++) {
      const svc = pick(services24)
      const dur = svc.duration_minutes
      const startHour = rand(9, 18)
      const startMin = pick([0, 15, 30, 45])
      const startTotal = startHour * 60 + startMin
      const endTotal = startTotal + dur
      if (endTotal > 19 * 60) continue
      const staff = pick(allStaff)
      const room = pick(rooms)
      const occKey = `${dk}|${staff.id}`
      const slots = occupancy.get(occKey) || []
      if (overlaps(slots, startTotal, endTotal)) continue
      slots.push([startTotal, endTotal])
      occupancy.set(occKey, slots)
      const sh = Math.floor(startTotal / 60), sm = startTotal % 60
      const eh = Math.floor(endTotal / 60), em = endTotal % 60
      return {
        id: randomUUID(),
        business_id: businessId,
        customer_id: customerId,
        staff_id: staff.id,
        service_id: svc.id,
        room_id: room.id,
        appointment_date: dk,
        start_time: hhmm(sh, sm),
        end_time: hhmm(eh, em),
        status,
        source,
        notes: null,
        manage_token: randomUUID(),
        token_expires_at: addDays(date, 30).toISOString(),
        confirmation_status: status === 'confirmed' ? 'confirmed_by_customer' : 'none',
        reminder_24h_sent: status === 'completed' && Math.random() < 0.4,
        reminder_2h_sent:  status === 'completed' && Math.random() < 0.3,
        review_requested:  status === 'completed' && Math.random() < 0.05,
        created_at: addDays(date, -rand(7, 14)).toISOString(),
      }
    }
    return null
  }

  // Geçmiş 90 gün — yaklaşık 130 randevu
  for (let i = 0; i < 130; i++) {
    const ago = rand(1, 90)
    const date = addDays(today, -ago)
    const cust = pick(customers)
    const status = pickWeighted([
      ['completed', 88], ['cancelled', 8], ['no_show', 4],
    ])
    const source = pickWeighted([
      ['manual', 40], ['web', 25], ['ai_assistant', 15], ['phone', 15], ['whatsapp', 5],
    ])
    const a = tryBookSlot(date, cust.id, source, status)
    if (a) newAppts.push(a)
  }

  // Gelecek 14 gün — yaklaşık 50 randevu
  for (let i = 0; i < 50; i++) {
    const ahead = rand(1, 14)
    const date = addDays(today, ahead)
    const cust = pick(customers)
    const status = pickWeighted([
      ['confirmed', 60], ['pending', 30], ['confirmed', 10],  // son grup waiting
    ])
    const source = pickWeighted([
      ['manual', 40], ['web', 30], ['ai_assistant', 15], ['phone', 10], ['whatsapp', 5],
    ])
    const a = tryBookSlot(date, cust.id, source, status)
    if (a) newAppts.push(a)
  }

  // Bölünmüş insert (large arrays)
  const chunk = (arr, n) => Array.from({length: Math.ceil(arr.length/n)}, (_,i)=>arr.slice(i*n, (i+1)*n))
  let totalAppts = 0
  for (const part of chunk(newAppts, 100)) {
    const inserted = await sb.from('appointments').insert(part).select('id')
    if (inserted.error) throw inserted.error
    totalAppts += inserted.data.length
  }
  console.log(`   ✓ appointments: ${totalAppts}`)

  // tüm randevuları çek (id+date+status+customer)
  const { data: allAppts, error: aErr } = await sb.from('appointments')
    .select('id, customer_id, service_id, staff_id, appointment_date, status').eq('business_id', businessId)
  if (aErr) throw aErr
  const completedAppts = allAppts.filter(a => a.status === 'completed')

  // 15) Protocol sessions
  console.log('\n15) Protokol seansları')
  const sessions = []
  for (const p of protocols) {
    // tamamlananları geçmişteki completed appt'larla eşleştir (tip uyumlu olmasa da olur)
    const candidateAppts = completedAppts.filter(a => a.customer_id === p.customer_id)
    for (let n = 1; n <= p.total_sessions; n++) {
      const isDone = n <= p.completed_sessions
      const planned = dayKey(addDays(today, isDone ? -((p.total_sessions - n + 1) * p.interval_days) : ((n - p.completed_sessions) * p.interval_days)))
      sessions.push({
        protocol_id: p.id,
        business_id: businessId,
        session_number: n,
        appointment_id: isDone && candidateAppts[n-1] ? candidateAppts[n-1].id : null,
        status: isDone ? 'completed' : 'planned',
        planned_date: planned,
        completed_date: isDone ? planned : null,
        notes: isDone ? 'Seans başarıyla tamamlandı' : null,
        before_photo_url: isDone ? placeholder(`before-${p.id}-${n}`) : null,
        after_photo_url:  isDone ? placeholder(`after-${p.id}-${n}`)  : null,
      })
    }
  }
  await exec('protocol_sessions',
    sb.from('protocol_sessions').insert(sessions).select('id'))

  // 16) Package usages
  console.log('\n16) Paket kullanımları')
  const usages = []
  for (const cp of customerPackages) {
    const candidateAppts = completedAppts.filter(a => a.customer_id === cp.customer_id && a.service_id === cp.service_id)
    for (let n = 0; n < cp.sessions_used; n++) {
      usages.push({
        business_id: businessId,
        customer_package_id: cp.id,
        appointment_id: candidateAppts[n]?.id ?? null,
        used_at: addDays(today, -rand(5, 60)).toISOString(),
        staff_id: ownerStaffId,
      })
    }
  }
  if (usages.length) await exec('package_usages',
    sb.from('package_usages').insert(usages).select('id'))

  // 17) Customer photos (genel)
  console.log('\n17) Müşteri fotoğrafları')
  const photoPayload = []
  for (const cust of customers.slice(0, 15)) {
    photoPayload.push({
      business_id: businessId, customer_id: cust.id,
      photo_url: placeholder(`before-${cust.id}`), photo_type: 'before',
      taken_at: dayKey(addDays(today, -rand(30, 90))),
    })
    photoPayload.push({
      business_id: businessId, customer_id: cust.id,
      photo_url: placeholder(`after-${cust.id}`), photo_type: 'after',
      taken_at: dayKey(addDays(today, -rand(1, 25))),
    })
  }
  await exec('customer_photos',
    sb.from('customer_photos').insert(photoPayload).select('id'))

  // 18) Invoices + invoice_payments
  console.log('\n18) Faturalar')
  const invoices = []
  let invSeq = 1
  const invoicePayments = []
  for (const a of completedAppts) {
    const svc = services.find(s => s.id === a.service_id)
    if (!svc) continue
    const subtotal = Number(svc.price)
    const total = subtotal
    const status = pickWeighted([
      ['paid', 65], ['partial', 15], ['pending', 15], ['overdue', 5],
    ])
    const payment_method = pickWeighted([
      ['card', 40], ['cash', 30], ['transfer', 20], ['online', 10],
    ])
    let paid_amount = 0
    if (status === 'paid') paid_amount = total
    else if (status === 'partial') paid_amount = Math.round(total * (rand(20, 70) / 100))
    const inv = {
      id: randomUUID(),
      business_id: businessId,
      customer_id: a.customer_id,
      appointment_id: a.id,
      invoice_number: `2026-${String(invSeq++).padStart(5, '0')}`,
      items: [{ name: svc.name, type: 'service', quantity: 1, price: subtotal, total: subtotal }],
      subtotal,
      tax_rate: 0,
      tax_amount: 0,
      total,
      status,
      payment_method,
      paid_at: status === 'paid' ? addDays(new Date(a.appointment_date + 'T12:00:00'), rand(0, 3)).toISOString() : null,
      due_date: dayKey(addDays(new Date(a.appointment_date + 'T12:00:00'), 14)),
      paid_amount,
      staff_id: a.staff_id,
      payment_type: status === 'partial' ? 'installment' : 'standard',
      installment_count: status === 'partial' ? rand(2, 6) : null,
      installment_frequency: status === 'partial' ? 'monthly' : null,
      created_at: a.appointment_date + 'T12:00:00+03:00',
    }
    invoices.push(inv)
    if (status === 'paid') {
      invoicePayments.push({
        business_id: businessId, invoice_id: inv.id,
        amount: total, method: payment_method, payment_type: 'payment',
        staff_id: a.staff_id, created_at: inv.paid_at,
      })
    } else if (status === 'partial') {
      const half = Math.round(paid_amount / 2)
      invoicePayments.push({
        business_id: businessId, invoice_id: inv.id,
        amount: half, method: payment_method, payment_type: 'installment',
        installment_number: 1, staff_id: a.staff_id,
        created_at: addDays(new Date(a.appointment_date + 'T12:00:00'), 1).toISOString(),
      })
      if (paid_amount - half > 0) {
        invoicePayments.push({
          business_id: businessId, invoice_id: inv.id,
          amount: paid_amount - half, method: payment_method, payment_type: 'installment',
          installment_number: 2, staff_id: a.staff_id,
          created_at: addDays(new Date(a.appointment_date + 'T12:00:00'), 30).toISOString(),
        })
      }
    }
  }
  // Paket faturaları
  for (const cp of customerPackages) {
    const inv = {
      id: randomUUID(),
      business_id: businessId,
      customer_id: cp.customer_id,
      invoice_number: `2026-${String(invSeq++).padStart(5, '0')}`,
      items: [{ name: cp.package_name, type: 'package', quantity: 1, price: Number(cp.price_paid), total: Number(cp.price_paid) }],
      subtotal: Number(cp.price_paid),
      tax_rate: 0,
      tax_amount: 0,
      total: Number(cp.price_paid),
      status: 'paid',
      payment_method: pick(['card', 'transfer']),
      paid_at: addDays(today, -rand(5, 60)).toISOString(),
      due_date: dayKey(addDays(today, 0)),
      paid_amount: Number(cp.price_paid),
      staff_id: ownerStaffId,
      payment_type: 'standard',
      created_at: addDays(today, -rand(5, 60)).toISOString(),
    }
    invoices.push(inv)
    invoicePayments.push({
      business_id: businessId, invoice_id: inv.id,
      amount: inv.total, method: inv.payment_method, payment_type: 'payment',
      staff_id: ownerStaffId, created_at: inv.paid_at,
    })
  }
  for (const part of chunk(invoices, 100)) {
    const r = await sb.from('invoices').insert(part).select('id')
    if (r.error) throw r.error
  }
  console.log(`   ✓ invoices: ${invoices.length}`)
  for (const part of chunk(invoicePayments, 200)) {
    const r = await sb.from('invoice_payments').insert(part).select('id')
    if (r.error) throw r.error
  }
  console.log(`   ✓ invoice_payments: ${invoicePayments.length}`)

  // 19) POS transactions (15)
  console.log('\n19) Kasa işlemleri')
  const posList = []
  for (let i = 0; i < 15; i++) {
    const a = pick(completedAppts)
    const svc = services.find(s => s.id === a.service_id)
    if (!svc) continue
    const total = Number(svc.price)
    posList.push({
      business_id: businessId,
      appointment_id: a.id,
      customer_id: a.customer_id,
      staff_id: a.staff_id,
      transaction_type: 'sale',
      items: [{ name: svc.name, quantity: 1, price: total, total }],
      subtotal: total,
      total,
      payments: [{ method: pick(['cash', 'card']), amount: total }],
      payment_status: 'paid',
      receipt_number: `POS-${1000 + i}`,
      created_at: addDays(today, -rand(1, 30)).toISOString(),
    })
  }
  await exec('pos_transactions',
    sb.from('pos_transactions').insert(posList).select('id'))

  // 20) Expenses
  console.log('\n20) Giderler')
  const expenseRows = []
  // Aylık tekrarlayanları 3 ay için
  for (const e of EXPENSE_TEMPLATES.filter(x => x.recurring)) {
    for (let m = 0; m < 3; m++) {
      expenseRows.push({
        business_id: businessId,
        category: e.category,
        description: e.desc,
        amount: e.amount,
        expense_date: dayKey(addDays(today, -m * 30)),
        is_recurring: true,
        recurring_period: e.period || 'monthly',
        created_by: testUser.id,
      })
    }
  }
  // One-off giderler — son 90 gün içine yayılmış
  const oneOffs = EXPENSE_TEMPLATES.filter(x => !x.recurring)
  while (expenseRows.length < 35) {
    const e = pick(oneOffs)
    expenseRows.push({
      business_id: businessId,
      category: e.category,
      description: e.desc,
      amount: e.amount + rand(-500, 500),
      expense_date: dayKey(addDays(today, -rand(1, 88))),
      is_recurring: false,
      created_by: testUser.id,
    })
  }
  await exec('expenses',
    sb.from('expenses').insert(expenseRows).select('id'))

  // 21) Income
  console.log('\n21) Manuel gelirler')
  const incomeRows = INCOME_TEMPLATES.map(i => ({
    business_id: businessId,
    category: i.category,
    description: i.desc,
    amount: i.amount,
    income_date: dayKey(addDays(today, -rand(1, 80))),
    is_recurring: false,
  }))
  await exec('income',
    sb.from('income').insert(incomeRows).select('id'))

  // 22) Reviews (12)
  console.log('\n22) Yorumlar')
  const reviewAppts = completedAppts.slice(0, 12)
  const reviewRows = reviewAppts.map(a => ({
    business_id: businessId,
    customer_id: a.customer_id,
    appointment_id: a.id,
    rating: pickWeighted([[5, 60], [4, 35], [3, 5]]),
    comment: pick(REVIEW_COMMENTS),
    status: 'pending',
  }))
  await exec('reviews',
    sb.from('reviews').insert(reviewRows).select('id'))

  // 23) Follow-up queue (10)
  console.log('\n23) Takip kuyruğu')
  const followups = completedAppts.slice(0, 10).map(a => ({
    business_id: businessId,
    customer_id: a.customer_id,
    appointment_id: a.id,
    type: 'post_session',
    scheduled_for: addDays(new Date(a.appointment_date + 'T12:00:00'), 7).toISOString(),
    status: 'pending',
    message: 'Seansınızdan bu yana 1 hafta geçti — nasıl hissediyorsunuz?',
  }))
  await exec('follow_up_queue',
    sb.from('follow_up_queue').insert(followups).select('id'))

  console.log('\n✅ Seed tamamlandı.\n')
}

main().catch(e => { console.error('\n💥 Hata:', e); process.exit(1) })
