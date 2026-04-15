import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { AuthContext } from '@/lib/api/with-permission'
import type { StaffPermissions } from '@/types'
import { createPendingAction } from '@/lib/ai/assistant-actions'

type SupabaseAdmin = ReturnType<typeof createAdminClient>
type ToolCtx = AuthContext & { staffName: string; conversationId: string | null }

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
  // Grup 8: Mesajlar (okuma)
  {
    type: 'function',
    function: {
      name: 'list_pending_messages',
      description: 'Yanıtlanmamış gelen müşteri mesajlarını listeler (son 7 gün). Müşteriye cevap öncesi bağlam için kullan.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Maksimum mesaj. Varsayılan: 20' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_messages',
      description: 'Belirli müşteriyle son mesaj geçmişini getirir (her iki yön).',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string', description: 'Müşteri ID' },
          limit: { type: 'number', description: 'Maksimum mesaj. Varsayılan: 10' },
        },
        required: ['customer_id'],
      },
    },
  },
  // Grup 9: Denetim Kaydı
  {
    type: 'function',
    function: {
      name: 'search_audit_logs',
      description: 'Denetim kayıtlarında arama yapar (kim, ne, ne zaman). Sadece yöneticiler kullanabilir.',
      parameters: {
        type: 'object',
        properties: {
          date_from: { type: 'string', description: 'Başlangıç tarihi (YYYY-MM-DD)' },
          date_to: { type: 'string', description: 'Bitiş tarihi (YYYY-MM-DD)' },
          staff_id: { type: 'string', description: 'Filtre: belirli personel' },
          resource: { type: 'string', description: 'Filtre: kaynak tipi (appointment, customer, invoice...)' },
          action: { type: 'string', description: 'Filtre: eylem tipi (create, update, delete...)' },
          limit: { type: 'number', description: 'Maksimum. Varsayılan: 30' },
        },
      },
    },
  },
  // Grup 10: Yazma — Randevu
  {
    type: 'function',
    function: {
      name: 'create_appointment',
      description: 'Yeni randevu oluşturur. ÖNEMLİ: Kullanıcı onayı gerekir — önizleme oluşturur, kullanıcı Onayla deyince gerçekleşir. Çağırmadan önce müşteri ve hizmet ID\'lerini bilmelisin (gerekirse search_customers ve list_services kullan). start_time verilince end_time otomatik hizmet süresine göre hesaplanır.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string', description: 'Müşteri ID' },
          service_id: { type: 'string', description: 'Hizmet ID' },
          date: { type: 'string', description: 'Tarih (YYYY-MM-DD)' },
          start_time: { type: 'string', description: 'Başlangıç saati (HH:MM)' },
          staff_id: { type: 'string', description: 'Personel ID (opsiyonel, boşsa mevcut kullanıcı)' },
          notes: { type: 'string', description: 'Notlar (opsiyonel)' },
        },
        required: ['customer_id', 'service_id', 'date', 'start_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_appointment',
      description: 'Randevuyu iptal eder (soft delete). Kullanıcı onayı gerekir.',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: { type: 'string', description: 'Randevu ID' },
          reason: { type: 'string', description: 'İptal nedeni (opsiyonel)' },
        },
        required: ['appointment_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_appointment_status',
      description: 'Randevu durumunu değiştirir (onaylandı, tamamlandı, gelmedi vb.). Kullanıcı onayı gerekir.',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: { type: 'string', description: 'Randevu ID' },
          status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'],
            description: 'Yeni durum',
          },
        },
        required: ['appointment_id', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_appointment',
      description: 'Randevuyu başka bir tarih/saate öteler. Kullanıcı onayı gerekir.',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: { type: 'string', description: 'Randevu ID' },
          new_date: { type: 'string', description: 'Yeni tarih (YYYY-MM-DD)' },
          new_start_time: { type: 'string', description: 'Yeni başlangıç saati (HH:MM)' },
        },
        required: ['appointment_id', 'new_date', 'new_start_time'],
      },
    },
  },
  // Grup 11: Yazma — Müşteri
  {
    type: 'function',
    function: {
      name: 'create_customer',
      description: 'Yeni müşteri oluşturur. Kullanıcı onayı gerekir. Telefon zorunlu ve benzersiz (varsa uyarı çıkar).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Ad Soyad' },
          phone: { type: 'string', description: 'Telefon (örn +905551234567)' },
          email: { type: 'string', description: 'E-posta (opsiyonel)' },
          birthday: { type: 'string', description: 'Doğum tarihi (YYYY-MM-DD, opsiyonel)' },
          notes: { type: 'string', description: 'Notlar (opsiyonel)' },
        },
        required: ['name', 'phone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_customer',
      description: 'Müşteri bilgilerini günceller. Kullanıcı onayı gerekir. Sadece değişecek alanları gönder.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string', description: 'Müşteri ID' },
          name: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          notes: { type: 'string' },
          segment: { type: 'string', enum: ['new', 'regular', 'vip', 'risk', 'lost'] },
          preferred_channel: { type: 'string', enum: ['sms', 'whatsapp', 'auto'] },
        },
        required: ['customer_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_customer',
      description: 'Müşteriyi pasifleştirir (soft delete). Kullanıcı onayı gerekir. Geçmiş kayıtlar silinmez.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string', description: 'Müşteri ID' },
        },
        required: ['customer_id'],
      },
    },
  },
  // Grup 12: Yazma — Hizmet
  {
    type: 'function',
    function: {
      name: 'create_service',
      description: 'Yeni hizmet oluşturur. Kullanıcı onayı gerekir.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Hizmet adı' },
          duration_minutes: { type: 'number', description: 'Süre (dakika)' },
          price: { type: 'number', description: 'Fiyat (₺)' },
          description: { type: 'string', description: 'Açıklama (opsiyonel)' },
        },
        required: ['name', 'duration_minutes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_service',
      description: 'Hizmet bilgilerini günceller. Kullanıcı onayı gerekir.',
      parameters: {
        type: 'object',
        properties: {
          service_id: { type: 'string' },
          name: { type: 'string' },
          duration_minutes: { type: 'number' },
          price: { type: 'number' },
          description: { type: 'string' },
          is_active: { type: 'boolean' },
        },
        required: ['service_id'],
      },
    },
  },
  // Grup 13: Yazma — Mesaj
  {
    type: 'function',
    function: {
      name: 'send_message',
      description: 'Müşteriye SMS/WhatsApp mesajı gönderir. Kullanıcı onayı gerekir. Mesajlara yanıt yazarken önce get_recent_messages ile bağlamı al.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string', description: 'Müşteri ID' },
          content: { type: 'string', description: 'Mesaj içeriği (Türkçe, kısa, samimi)' },
          channel: { type: 'string', enum: ['sms', 'whatsapp'], description: 'Kanal (varsayılan sms)' },
        },
        required: ['customer_id', 'content'],
      },
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
  list_pending_messages: 'Bekleyen mesajlar yükleniyor...',
  get_recent_messages: 'Mesaj geçmişi getiriliyor...',
  search_audit_logs: 'Denetim kayıtları aranıyor...',
  create_appointment: 'Randevu önizlemesi hazırlanıyor...',
  cancel_appointment: 'İptal önizlemesi hazırlanıyor...',
  update_appointment_status: 'Durum değişikliği hazırlanıyor...',
  reschedule_appointment: 'Erteleme önizlemesi hazırlanıyor...',
  create_customer: 'Müşteri önizlemesi hazırlanıyor...',
  update_customer: 'Güncelleme önizlemesi hazırlanıyor...',
  delete_customer: 'Silme önizlemesi hazırlanıyor...',
  create_service: 'Hizmet önizlemesi hazırlanıyor...',
  update_service: 'Hizmet güncellemesi hazırlanıyor...',
  send_message: 'Mesaj önizlemesi hazırlanıyor...',
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
  list_pending_messages: 'messages',
  get_recent_messages: 'messages',
  search_audit_logs: 'settings',
  create_appointment: 'appointments',
  cancel_appointment: 'appointments',
  update_appointment_status: 'appointments',
  reschedule_appointment: 'appointments',
  create_customer: 'customers',
  update_customer: 'customers',
  delete_customer: 'customers',
  create_service: 'services',
  update_service: 'services',
  send_message: 'messages',
}

// ── Tool Executor ──

export async function executeAssistantTool(
  toolName: string,
  args: Record<string, any>,
  ctx: ToolCtx,
  admin: SupabaseAdmin,
): Promise<{ success: boolean; data?: any; error?: string; requires_confirmation?: boolean; action_id?: string; action_type?: string; preview?: string; details?: any }> {
  // Permission check
  const requiredPerm = TOOL_PERMISSIONS[toolName]
  if (requiredPerm && !ctx.permissions[requiredPerm]) {
    return { success: false, error: `Bu işlem için yetkiniz yok: ${requiredPerm}` }
  }

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
      case 'list_pending_messages':
        return await handleListPendingMessages(admin, businessId, args)
      case 'get_recent_messages':
        return await handleGetRecentMessages(admin, businessId, args)
      case 'search_audit_logs':
        return await handleSearchAuditLogs(admin, businessId, args)
      // Write tools → stash as pending action
      case 'create_appointment':
        return await handleCreateAppointment(admin, ctx, args)
      case 'cancel_appointment':
        return await handleCancelAppointment(admin, ctx, args)
      case 'update_appointment_status':
        return await handleUpdateAppointmentStatus(admin, ctx, args)
      case 'reschedule_appointment':
        return await handleRescheduleAppointment(admin, ctx, args)
      case 'create_customer':
        return await handleCreateCustomer(admin, ctx, args)
      case 'update_customer':
        return await handleUpdateCustomer(admin, ctx, args)
      case 'delete_customer':
        return await handleDeleteCustomer(admin, ctx, args)
      case 'create_service':
        return await handleCreateService(admin, ctx, args)
      case 'update_service':
        return await handleUpdateService(admin, ctx, args)
      case 'send_message':
        return await handleSendMessage(admin, ctx, args)
      default:
        return { success: false, error: `Bilinmeyen araç: ${toolName}` }
    }
  } catch (err: any) {
    console.error(`Tool execution error [${toolName}]:`, err)
    return { success: false, error: 'İşlem sırasında bir hata oluştu' }
  }
}

// Anahtarlar DB'de 3 harfli (mon/tue/wed/thu/fri/sat/sun), değer: {open, close} veya null
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const DAY_NAMES: Record<string, string> = {
  mon: 'Pazartesi', tue: 'Salı', wed: 'Çarşamba',
  thu: 'Perşembe', fri: 'Cuma', sat: 'Cumartesi', sun: 'Pazar',
}

function getDayKey(dateStr: string): string {
  // YYYY-MM-DD → mon/tue/...
  const d = new Date(dateStr + 'T00:00:00')
  return DAY_KEYS[d.getDay()]
}

function getDayHours(workingHours: any, dateStr: string): { open: string; close: string } | null {
  if (!workingHours) return null
  const dh = workingHours[getDayKey(dateStr)]
  // Kapalı gün null olarak kaydedilir; bazı eski kayıtlarda {closed: true} olabilir
  if (!dh || dh.closed) return null
  if (!dh.open || !dh.close) return null
  return { open: dh.open, close: dh.close }
}

// ── Handler Implementations ──

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

  const dayHours = getDayHours(biz.working_hours, date)
  if (!dayHours) {
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
  // Sanitize: strip Supabase filter metacharacters to prevent injection
  const q = String(args.query || '').replace(/[%_\\(),."']/g, '')
  if (!q) return { success: false, error: 'Arama sorgusu boş' }
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

  // Parallel: shifts + staff name + appointments
  const [{ data: shifts }, { data: staff }, { data: appts }] = await Promise.all([
    admin
      .from('shifts')
      .select('start_time, end_time, notes')
      .eq('business_id', businessId)
      .eq('staff_id', staff_id)
      .eq('date', date),
    admin
      .from('staff_members')
      .select('name, working_hours')
      .eq('id', staff_id)
      .single(),
    admin
      .from('appointments')
      .select('start_time, end_time, status, customers(name), services(name)')
      .eq('business_id', businessId)
      .eq('staff_id', staff_id)
      .eq('appointment_date', date)
      .is('deleted_at', null)
      .in('status', ['pending', 'confirmed'])
      .order('start_time', { ascending: true }),
  ])

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

  // Parallel: completed appointments + paid invoices
  const [{ data: appts }, { data: invoices }] = await Promise.all([
    admin
      .from('appointments')
      .select('services(name, price)')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .eq('status', 'completed')
      .gte('appointment_date', date_from)
      .lte('appointment_date', date_to),
    admin
      .from('invoices')
      .select('total, paid_amount')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .in('status', ['paid', 'partial'])
      .gte('created_at', date_from + 'T00:00:00')
      .lte('created_at', date_to + 'T23:59:59'),
  ])

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

  const wh = data.working_hours as Record<string, any> | null
  if (!wh) return { success: true, data: { calisma_saatleri: null, not: 'Henüz ayarlanmamış' } }

  const hours: Record<string, string> = {}
  for (const [key, label] of Object.entries(DAY_NAMES)) {
    const day = wh[key]
    hours[label] = (!day || day.closed) ? 'Kapalı' : `${day.open} - ${day.close}`
  }

  return { success: true, data: { calisma_saatleri: hours } }
}

// ── Read Handlers (Mesaj & Audit) ──

async function handleListPendingMessages(
  admin: SupabaseAdmin, businessId: string, args: Record<string, any>,
) {
  const limit = Math.min(args.limit || 20, 50)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await admin
    .from('messages')
    .select('id, content, channel, created_at, customer_id, customers(id, name, phone)')
    .eq('business_id', businessId)
    .eq('direction', 'inbound')
    .gte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { success: false, error: error.message }

  return {
    success: true,
    data: {
      toplam: (data || []).length,
      mesajlar: (data || []).map((m: any) => ({
        id: m.id,
        musteri_id: m.customer_id,
        musteri: m.customers?.name || 'Bilinmiyor',
        telefon: m.customers?.phone || null,
        kanal: m.channel,
        icerik: m.content,
        tarih: m.created_at,
      })),
    },
  }
}

async function handleGetRecentMessages(
  admin: SupabaseAdmin, businessId: string, args: Record<string, any>,
) {
  const limit = Math.min(args.limit || 10, 25)

  const { data, error } = await admin
    .from('messages')
    .select('id, content, direction, channel, status, staff_name, created_at')
    .eq('business_id', businessId)
    .eq('customer_id', args.customer_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { success: false, error: error.message }

  return {
    success: true,
    data: {
      toplam: (data || []).length,
      mesajlar: ((data || []).reverse()).map((m: any) => ({
        id: m.id,
        yon: m.direction === 'inbound' ? 'müşteriden' : 'bize',
        icerik: m.content,
        kanal: m.channel,
        personel: m.staff_name || null,
        tarih: m.created_at,
      })),
    },
  }
}

async function handleSearchAuditLogs(
  admin: SupabaseAdmin, businessId: string, args: Record<string, any>,
) {
  const limit = Math.min(args.limit || 30, 100)
  let q = admin
    .from('audit_logs')
    .select('action, resource, resource_id, staff_name, details, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (args.date_from) q = q.gte('created_at', args.date_from + 'T00:00:00')
  if (args.date_to) q = q.lte('created_at', args.date_to + 'T23:59:59')
  if (args.staff_id) q = q.eq('staff_id', args.staff_id)
  if (args.resource) q = q.eq('resource', args.resource)
  if (args.action) q = q.eq('action', args.action)

  const { data, error } = await q
  if (error) return { success: false, error: error.message }

  return {
    success: true,
    data: {
      toplam: (data || []).length,
      kayitlar: (data || []).map((a: any) => ({
        tarih: a.created_at,
        personel: a.staff_name || 'Sistem',
        eylem: a.action,
        kaynak: a.resource,
        kaynak_id: a.resource_id,
        detay: a.details,
      })),
    },
  }
}

// ── Write Handlers (→ createPendingAction) ──

async function handleCreateAppointment(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  // Resolve service duration + names for preview
  const [{ data: svc }, { data: cust }, { data: bizWH }] = await Promise.all([
    admin.from('services').select('name, duration_minutes, price').eq('id', args.service_id).eq('business_id', ctx.businessId).single(),
    admin.from('customers').select('name, phone').eq('id', args.customer_id).eq('business_id', ctx.businessId).single(),
    admin.from('businesses').select('working_hours').eq('id', ctx.businessId).single(),
  ])

  if (!svc) return { success: false, error: 'Hizmet bulunamadı' }
  if (!cust) return { success: false, error: 'Müşteri bulunamadı' }

  const endMin = timeToMinutes(args.start_time) + (svc.duration_minutes || 30)
  const end_time = minutesToTime(endMin)

  // Working hours validation
  if (bizWH?.working_hours) {
    const dayHours = getDayHours(bizWH.working_hours, args.date)
    if (!dayHours) {
      return { success: false, error: `${args.date} tarihi işletme için kapalı bir gün` }
    }
    if (timeToMinutes(args.start_time) < timeToMinutes(dayHours.open) || endMin > timeToMinutes(dayHours.close)) {
      return { success: false, error: `Bu saat çalışma saatleri (${dayHours.open}-${dayHours.close}) dışında` }
    }
  }

  // Conflict pre-check (also re-checked on execute)
  const staffIdToUse = args.staff_id || ctx.staffId
  const { data: conflicts } = await admin
    .from('appointments')
    .select('id, start_time, end_time')
    .eq('business_id', ctx.businessId)
    .eq('staff_id', staffIdToUse)
    .eq('appointment_date', args.date)
    .is('deleted_at', null)
    .in('status', ['pending', 'confirmed'])

  const hasConflict = (conflicts || []).some((c: any) =>
    timeToMinutes(args.start_time) < timeToMinutes(c.end_time) &&
    endMin > timeToMinutes(c.start_time)
  )
  if (hasConflict) return { success: false, error: 'Bu saatte çakışan randevu var' }

  const payload = {
    customer_id: args.customer_id,
    service_id: args.service_id,
    staff_id: staffIdToUse,
    date: args.date,
    start_time: args.start_time,
    end_time,
    notes: args.notes || null,
  }
  const preview = `📅 ${cust.name} — ${svc.name} (${svc.duration_minutes}dk, ${svc.price ? svc.price + '₺' : 'fiyatsız'})\n🗓️ ${args.date} ${args.start_time}-${end_time}`
  return await createPendingAction(admin, ctx, 'create_appointment', payload, preview, { customer: cust.name, service: svc.name, date: args.date, time: args.start_time })
}

async function handleCancelAppointment(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  const { data: appt } = await admin
    .from('appointments')
    .select('appointment_date, start_time, customers(name), services(name)')
    .eq('id', args.appointment_id)
    .eq('business_id', ctx.businessId)
    .single()

  if (!appt) return { success: false, error: 'Randevu bulunamadı' }

  const custName = (appt as any).customers?.name || 'Bilinmiyor'
  const svcName = (appt as any).services?.name || 'Hizmet'
  const preview = `❌ İptal: ${custName} — ${svcName}\n🗓️ ${appt.appointment_date} ${appt.start_time}`
  return await createPendingAction(
    admin, ctx, 'cancel_appointment',
    { appointment_id: args.appointment_id, reason: args.reason || null },
    preview,
    { customer: custName, service: svcName },
  )
}

async function handleUpdateAppointmentStatus(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  const statusLabels: Record<string, string> = {
    pending: 'Beklemede', confirmed: 'Onaylandı', completed: 'Tamamlandı',
    cancelled: 'İptal', no_show: 'Gelmedi',
  }
  const preview = `🔄 Durum değişikliği: ${statusLabels[args.status] || args.status}`
  return await createPendingAction(
    admin, ctx, 'update_appointment_status',
    { appointment_id: args.appointment_id, status: args.status },
    preview,
    { new_status: args.status },
  )
}

async function handleRescheduleAppointment(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  const { data: appt } = await admin
    .from('appointments')
    .select('appointment_date, start_time, end_time, services(duration_minutes), customers(name), services(name)')
    .eq('id', args.appointment_id)
    .eq('business_id', ctx.businessId)
    .single()

  if (!appt) return { success: false, error: 'Randevu bulunamadı' }

  const duration = (appt as any).services?.duration_minutes ||
    (timeToMinutes(appt.end_time) - timeToMinutes(appt.start_time))
  const new_end_time = minutesToTime(timeToMinutes(args.new_start_time) + duration)

  const custName = (appt as any).customers?.name || 'Müşteri'
  const preview = `📆 Erteleme: ${custName}\n${appt.appointment_date} ${appt.start_time} → ${args.new_date} ${args.new_start_time}`
  return await createPendingAction(
    admin, ctx, 'reschedule_appointment',
    {
      appointment_id: args.appointment_id,
      new_date: args.new_date,
      new_start_time: args.new_start_time,
      new_end_time,
    },
    preview,
    { customer: custName, from: `${appt.appointment_date} ${appt.start_time}`, to: `${args.new_date} ${args.new_start_time}` },
  )
}

async function handleCreateCustomer(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  // Duplicate phone check
  const { data: existing } = await admin
    .from('customers')
    .select('id, name')
    .eq('business_id', ctx.businessId)
    .eq('phone', args.phone)
    .eq('is_active', true)
    .maybeSingle()

  if (existing) {
    return { success: false, error: `Bu telefon zaten ${existing.name} adına kayıtlı` }
  }

  const preview = `👤 Yeni müşteri: ${args.name}\n📞 ${args.phone}${args.email ? '\n✉️ ' + args.email : ''}`
  return await createPendingAction(
    admin, ctx, 'create_customer',
    {
      name: args.name, phone: args.phone, email: args.email || null,
      birthday: args.birthday || null, notes: args.notes || null,
    },
    preview,
    { name: args.name, phone: args.phone },
  )
}

async function handleUpdateCustomer(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  const { data: cust } = await admin
    .from('customers')
    .select('name')
    .eq('id', args.customer_id)
    .eq('business_id', ctx.businessId)
    .single()

  if (!cust) return { success: false, error: 'Müşteri bulunamadı' }

  const fields = Object.entries(args)
    .filter(([k, v]) => k !== 'customer_id' && v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ')

  const preview = `✏️ ${cust.name} güncelleme:\n${fields}`
  return await createPendingAction(admin, ctx, 'update_customer', args, preview, { customer: cust.name })
}

async function handleDeleteCustomer(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  const { data: cust } = await admin
    .from('customers')
    .select('name, phone')
    .eq('id', args.customer_id)
    .eq('business_id', ctx.businessId)
    .single()

  if (!cust) return { success: false, error: 'Müşteri bulunamadı' }

  const preview = `🗑️ Müşteri pasifleştirme: ${cust.name} (${cust.phone})\nGeçmiş kayıtlar saklanır.`
  return await createPendingAction(admin, ctx, 'delete_customer', { customer_id: args.customer_id }, preview, { customer: cust.name })
}

async function handleCreateService(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  const preview = `💼 Yeni hizmet: ${args.name}\n⏱️ ${args.duration_minutes} dk${args.price ? `\n💰 ${args.price}₺` : ''}`
  return await createPendingAction(
    admin, ctx, 'create_service',
    {
      name: args.name,
      duration_minutes: args.duration_minutes,
      price: args.price ?? null,
      description: args.description || null,
    },
    preview,
    { name: args.name },
  )
}

async function handleUpdateService(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  const { data: svc } = await admin
    .from('services')
    .select('name')
    .eq('id', args.service_id)
    .eq('business_id', ctx.businessId)
    .single()

  if (!svc) return { success: false, error: 'Hizmet bulunamadı' }

  const fields = Object.entries(args)
    .filter(([k, v]) => k !== 'service_id' && v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ')

  const preview = `✏️ ${svc.name} güncelleme:\n${fields}`
  return await createPendingAction(admin, ctx, 'update_service', args, preview, { service: svc.name })
}

async function handleSendMessage(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  const { data: cust } = await admin
    .from('customers')
    .select('name, phone, preferred_channel')
    .eq('id', args.customer_id)
    .eq('business_id', ctx.businessId)
    .single()

  if (!cust) return { success: false, error: 'Müşteri bulunamadı' }
  if (!cust.phone) return { success: false, error: 'Müşterinin telefon numarası yok' }

  const channel = args.channel || cust.preferred_channel || 'sms'
  const preview = `💬 ${cust.name} (${cust.phone}) — ${channel.toUpperCase()}\n"${args.content}"`
  return await createPendingAction(
    admin, ctx, 'send_message',
    { customer_id: args.customer_id, content: args.content, channel },
    preview,
    { customer: cust.name, channel },
  )
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
