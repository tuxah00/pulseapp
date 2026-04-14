import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AuthContext } from '@/lib/api/with-permission'
import type { StaffPermissions } from '@/types'

// ── Tool Definitions (OpenAI format) ──

export const ASSISTANT_TOOLS: ChatCompletionTool[] = [
  // Grup 1: Randevular
  {
    type: 'function',
    function: {
      name: 'list_appointments',
      description: 'Randevuları listeler. Tarih aralığı, durum, personel veya müşteri ile filtreleme yapılabilir.',
      parameters: {
        type: 'object',
        properties: {
          date_from: { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD). Varsayılan: bugün.' },
          date_to: { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD). Varsayılan: bugün.' },
          status: { type: 'string', enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'], description: 'Randevu durumu filtresi' },
          staff_id: { type: 'string', description: 'Personel ID filtresi' },
          customer_id: { type: 'string', description: 'Müşteri ID filtresi' },
          limit: { type: 'number', description: 'Maksimum sonuç sayısı. Varsayılan: 20' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_available_slots',
      description: 'Belirli bir tarih ve hizmet için müsait randevu saatlerini getirir.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'Tarih (YYYY-MM-DD)' },
          service_id: { type: 'string', description: 'Hizmet ID (süresine göre slot hesaplanır)' },
          staff_id: { type: 'string', description: 'Personel ID (opsiyonel, belirli personele göre filtre)' },
        },
        required: ['date'],
      },
    },
  },
  // Grup 2: Müşteriler
  {
    type: 'function',
    function: {
      name: 'search_customers',
      description: 'İsim veya telefon numarasıyla müşteri arar.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Aranacak isim veya telefon numarası' },
          limit: { type: 'number', description: 'Maksimum sonuç. Varsayılan: 10' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_customer_details',
      description: 'Müşterinin detaylı profilini getirir: kişisel bilgiler, ziyaret sayısı, toplam gelir, segment, yaklaşan randevular.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string', description: 'Müşteri ID' },
        },
        required: ['customer_id'],
      },
    },
  },
  // Grup 3: Hizmetler & Paketler
  {
    type: 'function',
    function: {
      name: 'list_services',
      description: 'İşletmenin aktif hizmetlerini listeler (ad, süre, fiyat).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_packages',
      description: 'İşletmenin hizmet paketlerini/seans paketlerini listeler.',
      parameters: { type: 'object', properties: {} },
    },
  },
  // Grup 4: Personel & Program
  {
    type: 'function',
    function: {
      name: 'list_staff',
      description: 'Aktif personel listesini getirir (ad, rol, telefon).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_staff_schedule',
      description: 'Belirli bir personelin belirli tarihteki vardiya/çalışma programını getirir.',
      parameters: {
        type: 'object',
        properties: {
          staff_id: { type: 'string', description: 'Personel ID' },
          date: { type: 'string', description: 'Tarih (YYYY-MM-DD)' },
        },
        required: ['staff_id', 'date'],
      },
    },
  },
  // Grup 5: Analitik
  {
    type: 'function',
    function: {
      name: 'get_appointment_stats',
      description: 'Belirli dönem için randevu istatistiklerini getirir: toplam, tamamlanan, iptal, no-show, en popüler hizmetler.',
      parameters: {
        type: 'object',
        properties: {
          date_from: { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD)' },
          date_to: { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' },
        },
        required: ['date_from', 'date_to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_revenue_stats',
      description: 'Belirli dönem için gelir istatistiklerini getirir: toplam gelir, ortalama randevu geliri, en çok gelir getiren hizmetler.',
      parameters: {
        type: 'object',
        properties: {
          date_from: { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD)' },
          date_to: { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' },
        },
        required: ['date_from', 'date_to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_customer_stats',
      description: 'Müşteri istatistikleri: segment dağılımı, yeni müşteri sayısı, risk müşteriler, toplam müşteri.',
      parameters: {
        type: 'object',
        properties: {
          date_from: { type: 'string', description: 'Başlangıç tarihi (opsiyonel, yeni müşteri sayımı için)' },
          date_to: { type: 'string', description: 'Bitiş tarihi' },
        },
      },
    },
  },
  // Grup 7: İşletme Bilgileri
  {
    type: 'function',
    function: {
      name: 'get_business_info',
      description: 'İşletmenin temel bilgilerini getirir: ad, sektör, telefon, adres, şehir.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_working_hours',
      description: 'İşletmenin çalışma saatlerini getirir (gün bazlı açılış-kapanış).',
      parameters: { type: 'object', properties: {} },
    },
  },
]

// ── Tool Label Map (UI göstergesi için) ──

export const TOOL_LABELS: Record<string, string> = {
  list_appointments: 'Randevular kontrol ediliyor...',
  get_available_slots: 'Müsait saatler kontrol ediliyor...',
  search_customers: 'Müşteri aranıyor...',
  get_customer_details: 'Müşteri bilgileri getiriliyor...',
  list_services: 'Hizmetler listeleniyor...',
  list_packages: 'Paketler listeleniyor...',
  list_staff: 'Personel listesi getiriliyor...',
  get_staff_schedule: 'Çalışma programı kontrol ediliyor...',
  get_appointment_stats: 'Randevu istatistikleri hesaplanıyor...',
  get_revenue_stats: 'Gelir istatistikleri hesaplanıyor...',
  get_customer_stats: 'Müşteri istatistikleri hesaplanıyor...',
  get_business_info: 'İşletme bilgileri getiriliyor...',
  get_working_hours: 'Çalışma saatleri getiriliyor...',
}

// ── Permission Map ──

const TOOL_PERMISSIONS: Record<string, keyof StaffPermissions> = {
  list_appointments: 'appointments',
  get_available_slots: 'appointments',
  search_customers: 'customers',
  get_customer_details: 'customers',
  list_services: 'services',
  list_packages: 'dashboard',
  list_staff: 'dashboard',
  get_staff_schedule: 'dashboard',
  get_appointment_stats: 'analytics',
  get_revenue_stats: 'analytics',
  get_customer_stats: 'analytics',
  get_business_info: 'dashboard',
  get_working_hours: 'dashboard',
}

// ── Tool Executor ──

export async function executeAssistantTool(
  toolName: string,
  args: Record<string, any>,
  ctx: AuthContext,
): Promise<{ success: boolean; data?: any; error?: string }> {
  // Permission check
  const requiredPerm = TOOL_PERMISSIONS[toolName]
  if (requiredPerm && !ctx.permissions[requiredPerm]) {
    return { success: false, error: `Bu işlem için yetkiniz yok: ${requiredPerm}` }
  }

  const admin = createAdminClient()
  const { businessId } = ctx

  try {
    switch (toolName) {
      case 'list_appointments':
        return await handleListAppointments(admin, businessId, args)
      case 'get_available_slots':
        return await handleGetAvailableSlots(admin, businessId, args)
      case 'search_customers':
        return await handleSearchCustomers(admin, businessId, args)
      case 'get_customer_details':
        return await handleGetCustomerDetails(admin, businessId, args)
      case 'list_services':
        return await handleListServices(admin, businessId)
      case 'list_packages':
        return await handleListPackages(admin, businessId)
      case 'list_staff':
        return await handleListStaff(admin, businessId)
      case 'get_staff_schedule':
        return await handleGetStaffSchedule(admin, businessId, args)
      case 'get_appointment_stats':
        return await handleGetAppointmentStats(admin, businessId, args)
      case 'get_revenue_stats':
        return await handleGetRevenueStats(admin, businessId, args)
      case 'get_customer_stats':
        return await handleGetCustomerStats(admin, businessId, args)
      case 'get_business_info':
        return await handleGetBusinessInfo(admin, businessId)
      case 'get_working_hours':
        return await handleGetWorkingHours(admin, businessId)
      default:
        return { success: false, error: `Bilinmeyen araç: ${toolName}` }
    }
  } catch (err: any) {
    console.error(`Tool execution error [${toolName}]:`, err)
    return { success: false, error: 'İşlem sırasında bir hata oluştu' }
  }
}

// ── Handler Implementations ──

type SupabaseAdmin = ReturnType<typeof createAdminClient>

async function handleListAppointments(
  admin: SupabaseAdmin, businessId: string, args: Record<string, any>,
) {
  const today = new Date().toISOString().split('T')[0]
  const dateFrom = args.date_from || today
  const dateTo = args.date_to || today
  const limit = Math.min(args.limit || 20, 50)

  let query = admin
    .from('appointments')
    .select('id, appointment_date, start_time, end_time, status, source, customers(id, name, phone), services(id, name, duration_minutes, price), staff_members(id, name)')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .gte('appointment_date', dateFrom)
    .lte('appointment_date', dateTo)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(limit)

  if (args.status) query = query.eq('status', args.status)
  if (args.staff_id) query = query.eq('staff_id', args.staff_id)
  if (args.customer_id) query = query.eq('customer_id', args.customer_id)

  const { data, error } = await query
  if (error) return { success: false, error: error.message }

  const appointments = (data || []).map((a: any) => ({
    id: a.id,
    tarih: a.appointment_date,
    saat: `${a.start_time} - ${a.end_time}`,
    durum: a.status,
    musteri: a.customers?.name || 'Bilinmiyor',
    musteri_telefon: a.customers?.phone || null,
    hizmet: a.services?.name || 'Belirtilmemiş',
    sure_dk: a.services?.duration_minutes || null,
    personel: a.staff_members?.name || 'Atanmamış',
  }))

  return { success: true, data: { toplam: appointments.length, randevular: appointments } }
}

async function handleGetAvailableSlots(
  admin: SupabaseAdmin, businessId: string, args: Record<string, any>,
) {
  const date = args.date
  if (!date) return { success: false, error: 'Tarih belirtilmedi' }

  // Get working hours
  const { data: biz } = await admin
    .from('businesses')
    .select('working_hours')
    .eq('id', businessId)
    .single()

  if (!biz?.working_hours) return { success: true, data: { musait_saatler: [], not: 'Çalışma saatleri ayarlanmamış' } }

  const dayOfWeek = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
  const dayHours = biz.working_hours[dayOfWeek]

  if (!dayHours || dayHours.closed) {
    return { success: true, data: { musait_saatler: [], not: 'Bu gün kapalı' } }
  }

  // Get service duration
  let durationMinutes = 30
  if (args.service_id) {
    const { data: svc } = await admin
      .from('services')
      .select('duration_minutes')
      .eq('id', args.service_id)
      .single()
    if (svc) durationMinutes = svc.duration_minutes
  }

  // Get existing appointments for that day
  let apptQuery = admin
    .from('appointments')
    .select('start_time, end_time')
    .eq('business_id', businessId)
    .eq('appointment_date', date)
    .is('deleted_at', null)
    .in('status', ['pending', 'confirmed'])

  if (args.staff_id) apptQuery = apptQuery.eq('staff_id', args.staff_id)

  const { data: existingAppts } = await apptQuery

  // Generate slots
  const openMinutes = timeToMinutes(dayHours.open)
  const closeMinutes = timeToMinutes(dayHours.close)
  const bookedSlots = (existingAppts || []).map((a: any) => ({
    start: timeToMinutes(a.start_time),
    end: timeToMinutes(a.end_time),
  }))

  const available: string[] = []
  for (let m = openMinutes; m + durationMinutes <= closeMinutes; m += 30) {
    const slotEnd = m + durationMinutes
    const conflict = bookedSlots.some((b: any) => m < b.end && slotEnd > b.start)
    if (!conflict) {
      available.push(minutesToTime(m))
    }
  }

  return { success: true, data: { tarih: date, sure_dk: durationMinutes, musait_saatler: available } }
}

async function handleSearchCustomers(
  admin: SupabaseAdmin, businessId: string, args: Record<string, any>,
) {
  const q = args.query
  const limit = Math.min(args.limit || 10, 25)

  const { data, error } = await admin
    .from('customers')
    .select('id, name, phone, email, segment, total_visits, last_visit_at')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
    .order('last_visit_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) return { success: false, error: error.message }

  return {
    success: true,
    data: {
      toplam: (data || []).length,
      musteriler: (data || []).map((c: any) => ({
        id: c.id,
        isim: c.name,
        telefon: c.phone,
        email: c.email,
        segment: c.segment,
        ziyaret_sayisi: c.total_visits,
        son_ziyaret: c.last_visit_at,
      })),
    },
  }
}

async function handleGetCustomerDetails(
  admin: SupabaseAdmin, businessId: string, args: Record<string, any>,
) {
  const { data: customer, error } = await admin
    .from('customers')
    .select('*')
    .eq('id', args.customer_id)
    .eq('business_id', businessId)
    .single()

  if (error || !customer) return { success: false, error: 'Müşteri bulunamadı' }

  // Get upcoming appointments
  const today = new Date().toISOString().split('T')[0]
  const { data: upcoming } = await admin
    .from('appointments')
    .select('id, appointment_date, start_time, status, services(name)')
    .eq('business_id', businessId)
    .eq('customer_id', args.customer_id)
    .is('deleted_at', null)
    .gte('appointment_date', today)
    .order('appointment_date', { ascending: true })
    .limit(5)

  return {
    success: true,
    data: {
      isim: customer.name,
      telefon: customer.phone,
      email: customer.email,
      dogum_tarihi: customer.birthday,
      segment: customer.segment,
      toplam_ziyaret: customer.total_visits,
      toplam_gelir: customer.total_revenue,
      no_show_sayisi: customer.total_no_shows,
      son_ziyaret: customer.last_visit_at,
      notlar: customer.notes,
      yaklasan_randevular: (upcoming || []).map((a: any) => ({
        id: a.id,
        tarih: a.appointment_date,
        saat: a.start_time,
        durum: a.status,
        hizmet: a.services?.name || 'Belirtilmemiş',
      })),
    },
  }
}

async function handleListServices(admin: SupabaseAdmin, businessId: string) {
  const { data, error } = await admin
    .from('services')
    .select('id, name, description, duration_minutes, price')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) return { success: false, error: error.message }

  return {
    success: true,
    data: {
      toplam: (data || []).length,
      hizmetler: (data || []).map((s: any) => ({
        id: s.id,
        ad: s.name,
        aciklama: s.description,
        sure_dk: s.duration_minutes,
        fiyat: s.price,
      })),
    },
  }
}

async function handleListPackages(admin: SupabaseAdmin, businessId: string) {
  const { data, error } = await admin
    .from('service_packages')
    .select('id, name, description, sessions_total, price, validity_days, services(name)')
    .eq('business_id', businessId)

  if (error) return { success: false, error: error.message }

  return {
    success: true,
    data: {
      toplam: (data || []).length,
      paketler: (data || []).map((p: any) => ({
        id: p.id,
        ad: p.name,
        aciklama: p.description,
        seans_sayisi: p.sessions_total,
        fiyat: p.price,
        gecerlilik_gun: p.validity_days,
        hizmet: p.services?.name || null,
      })),
    },
  }
}

async function handleListStaff(admin: SupabaseAdmin, businessId: string) {
  const { data, error } = await admin
    .from('staff_members')
    .select('id, name, role, phone, email')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) return { success: false, error: error.message }

  const roleLabels: Record<string, string> = {
    owner: 'İşletme Sahibi', manager: 'Yönetici', staff: 'Personel',
  }

  return {
    success: true,
    data: {
      toplam: (data || []).length,
      personeller: (data || []).map((s: any) => ({
        id: s.id,
        isim: s.name,
        rol: roleLabels[s.role] || s.role,
        telefon: s.phone,
        email: s.email,
      })),
    },
  }
}

async function handleGetStaffSchedule(
  admin: SupabaseAdmin, businessId: string, args: Record<string, any>,
) {
  const { staff_id, date } = args

  // Get shifts for that date
  const { data: shifts } = await admin
    .from('shifts')
    .select('start_time, end_time, notes')
    .eq('business_id', businessId)
    .eq('staff_id', staff_id)
    .eq('date', date)

  // Get staff name
  const { data: staff } = await admin
    .from('staff_members')
    .select('name, working_hours')
    .eq('id', staff_id)
    .single()

  // Get appointments for that date
  const { data: appts } = await admin
    .from('appointments')
    .select('start_time, end_time, status, customers(name), services(name)')
    .eq('business_id', businessId)
    .eq('staff_id', staff_id)
    .eq('appointment_date', date)
    .is('deleted_at', null)
    .in('status', ['pending', 'confirmed'])
    .order('start_time', { ascending: true })

  return {
    success: true,
    data: {
      personel: staff?.name || 'Bilinmiyor',
      tarih: date,
      vardiyalar: (shifts || []).map((s: any) => ({
        baslangic: s.start_time,
        bitis: s.end_time,
        notlar: s.notes,
      })),
      randevular: (appts || []).map((a: any) => ({
        saat: `${a.start_time} - ${a.end_time}`,
        durum: a.status,
        musteri: a.customers?.name || 'Bilinmiyor',
        hizmet: a.services?.name || 'Belirtilmemiş',
      })),
    },
  }
}

async function handleGetAppointmentStats(
  admin: SupabaseAdmin, businessId: string, args: Record<string, any>,
) {
  const { date_from, date_to } = args

  const { data: appts } = await admin
    .from('appointments')
    .select('status, services(name)')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .gte('appointment_date', date_from)
    .lte('appointment_date', date_to)

  const all = appts || []
  const statusCounts: Record<string, number> = {}
  const serviceCounts: Record<string, number> = {}

  for (const a of all) {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1
    const sName = (a as any).services?.name || 'Belirtilmemiş'
    serviceCounts[sName] = (serviceCounts[sName] || 0) + 1
  }

  const topServices = Object.entries(serviceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ hizmet: name, sayi: count }))

  return {
    success: true,
    data: {
      donem: `${date_from} — ${date_to}`,
      toplam: all.length,
      bekleyen: statusCounts.pending || 0,
      onaylanan: statusCounts.confirmed || 0,
      tamamlanan: statusCounts.completed || 0,
      iptal: statusCounts.cancelled || 0,
      gelmedi: statusCounts.no_show || 0,
      no_show_orani: all.length > 0 ? `${(((statusCounts.no_show || 0) / all.length) * 100).toFixed(1)}%` : '0%',
      en_populer_hizmetler: topServices,
    },
  }
}

async function handleGetRevenueStats(
  admin: SupabaseAdmin, businessId: string, args: Record<string, any>,
) {
  const { date_from, date_to } = args

  // Completed appointments with services
  const { data: appts } = await admin
    .from('appointments')
    .select('services(name, price)')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .eq('status', 'completed')
    .gte('appointment_date', date_from)
    .lte('appointment_date', date_to)

  // Paid invoices
  const { data: invoices } = await admin
    .from('invoices')
    .select('total, paid_amount')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .in('status', ['paid', 'partial'])
    .gte('created_at', date_from + 'T00:00:00')
    .lte('created_at', date_to + 'T23:59:59')

  const appointmentRevenue = (appts || []).reduce((sum: number, a: any) => sum + ((a as any).services?.price || 0), 0)
  const invoiceRevenue = (invoices || []).reduce((sum: number, inv: any) => sum + (inv.paid_amount || 0), 0)

  const serviceRevenue: Record<string, number> = {}
  for (const a of appts || []) {
    const sName = (a as any).services?.name || 'Belirtilmemiş'
    const price = (a as any).services?.price || 0
    serviceRevenue[sName] = (serviceRevenue[sName] || 0) + price
  }

  const topByRevenue = Object.entries(serviceRevenue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, total]) => ({ hizmet: name, toplam_gelir: total }))

  return {
    success: true,
    data: {
      donem: `${date_from} — ${date_to}`,
      randevu_geliri: appointmentRevenue,
      fatura_geliri: invoiceRevenue,
      toplam_tamamlanan: (appts || []).length,
      ortalama_randevu_geliri: (appts || []).length > 0 ? Math.round(appointmentRevenue / (appts || []).length) : 0,
      en_cok_gelir_getiren: topByRevenue,
    },
  }
}

async function handleGetCustomerStats(
  admin: SupabaseAdmin, businessId: string, args: Record<string, any>,
) {
  const { data: customers } = await admin
    .from('customers')
    .select('id, segment, created_at')
    .eq('business_id', businessId)
    .eq('is_active', true)

  const all = customers || []
  const segmentCounts: Record<string, number> = {}
  let newInPeriod = 0

  for (const c of all) {
    segmentCounts[c.segment] = (segmentCounts[c.segment] || 0) + 1
    if (args.date_from && c.created_at >= args.date_from && (!args.date_to || c.created_at <= args.date_to + 'T23:59:59')) {
      newInPeriod++
    }
  }

  return {
    success: true,
    data: {
      toplam_musteri: all.length,
      yeni_donemde: newInPeriod,
      segmentler: {
        yeni: segmentCounts.new || 0,
        duzenli: segmentCounts.regular || 0,
        vip: segmentCounts.vip || 0,
        risk: segmentCounts.risk || 0,
        kayip: segmentCounts.lost || 0,
      },
    },
  }
}

async function handleGetBusinessInfo(admin: SupabaseAdmin, businessId: string) {
  const { data, error } = await admin
    .from('businesses')
    .select('name, sector, phone, email, address, city, district')
    .eq('id', businessId)
    .single()

  if (error || !data) return { success: false, error: 'İşletme bilgisi alınamadı' }

  return {
    success: true,
    data: {
      isim: data.name,
      sektor: data.sector,
      telefon: data.phone,
      email: data.email,
      adres: data.address,
      sehir: data.city,
      ilce: data.district,
    },
  }
}

async function handleGetWorkingHours(admin: SupabaseAdmin, businessId: string) {
  const { data, error } = await admin
    .from('businesses')
    .select('working_hours')
    .eq('id', businessId)
    .single()

  if (error || !data) return { success: false, error: 'Çalışma saatleri alınamadı' }

  const dayNames: Record<string, string> = {
    monday: 'Pazartesi', tuesday: 'Salı', wednesday: 'Çarşamba',
    thursday: 'Perşembe', friday: 'Cuma', saturday: 'Cumartesi', sunday: 'Pazar',
  }

  const wh = data.working_hours as Record<string, any> | null
  if (!wh) return { success: true, data: { calisma_saatleri: null, not: 'Henüz ayarlanmamış' } }

  const hours: Record<string, string> = {}
  for (const [key, label] of Object.entries(dayNames)) {
    const day = wh[key]
    hours[label] = (!day || day.closed) ? 'Kapalı' : `${day.open} - ${day.close}`
  }

  return { success: true, data: { calisma_saatleri: hours } }
}

// ── Helpers ──

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
