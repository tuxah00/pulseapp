import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { AuthContext } from '@/lib/api/with-permission'
import type { StaffPermissions, CampaignSegmentFilter } from '@/types'
import { createPendingAction, cancelPendingAction } from '@/lib/ai/assistant-actions'
import { matchesCampaignFilter } from '@/lib/utils/campaign-filters'

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
  {
    type: 'function',
    function: {
      name: 'get_revenue_breakdown',
      description: 'Gelir dökümü — ödenmiş/kısmi faturalara göre hizmet, personel, dönem veya müşteri segmenti bazında kırılım verir.',
      parameters: {
        type: 'object',
        properties: {
          group_by: { type: 'string', enum: ['service', 'staff', 'period', 'customer_type'], description: 'Gruplama kriteri (varsayılan: service)' },
          date_from: { type: 'string', description: 'Başlangıç (YYYY-MM-DD). Varsayılan: bu ayın başı' },
          date_to: { type: 'string', description: 'Bitiş (YYYY-MM-DD). Varsayılan: bugün' },
          limit: { type: 'number', description: 'Sonuç sayısı. Varsayılan: 10' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_customer_lifetime_value',
      description: 'Müşteri Yaşam Boyu Değeri (CLV) — belirli müşterinin veya en değerli Top N müşterinin toplam harcama, ziyaret sıklığı, tahmini yıllık değer analizi.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string', description: 'Tekil müşteri CLV\'si (opsiyonel). Verilmezse Top N listelenir.' },
          limit: { type: 'number', description: 'Top liste boyutu. Varsayılan: 10' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_occupancy_stats',
      description: 'Doluluk oranı ve verimlilik — randevu yoğunluğu, günlük doluluk %, personel bazında doluluk, tamamlanma/iptal/no-show oranları.',
      parameters: {
        type: 'object',
        properties: {
          staff_id: { type: 'string', description: 'Personel filtresi (opsiyonel)' },
          date_from: { type: 'string', description: 'Başlangıç (YYYY-MM-DD). Varsayılan: bu ayın başı' },
          date_to: { type: 'string', description: 'Bitiş (YYYY-MM-DD). Varsayılan: bugün' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_staff_performance',
      description: 'Personel performans karnesi — her personelin randevu sayısı, tamamlanma oranı, toplam geliri, no-show oranı.',
      parameters: {
        type: 'object',
        properties: {
          staff_id: { type: 'string', description: 'Tekil personel (opsiyonel). Verilmezse tüm personel listelenir.' },
          date_from: { type: 'string', description: 'Başlangıç (YYYY-MM-DD). Varsayılan: bu ayın başı' },
          date_to: { type: 'string', description: 'Bitiş (YYYY-MM-DD). Varsayılan: bugün' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_expense_breakdown',
      description: 'Gider dökümü — kategori bazında toplam gider, dönem filtresi.',
      parameters: {
        type: 'object',
        properties: {
          date_from: { type: 'string', description: 'Başlangıç (YYYY-MM-DD). Varsayılan: bu ayın başı' },
          date_to: { type: 'string', description: 'Bitiş (YYYY-MM-DD). Varsayılan: bugün' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_profit_loss',
      description: 'Kâr-zarar raporu — dönem bazında toplam gelir (fatura + manuel gelir), toplam gider, net kâr/zarar ve kâr marjı.',
      parameters: {
        type: 'object',
        properties: {
          date_from: { type: 'string', description: 'Başlangıç (YYYY-MM-DD). Varsayılan: bu ayın başı' },
          date_to: { type: 'string', description: 'Bitiş (YYYY-MM-DD). Varsayılan: bugün' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_periods',
      description: 'İki dönemi karşılaştırır — gelir, gider, randevu sayısı, yeni müşteri, tamamlanma oranı metriklerinde % değişim verir.',
      parameters: {
        type: 'object',
        properties: {
          current_from: { type: 'string', description: 'Mevcut dönem başlangıç (YYYY-MM-DD)' },
          current_to: { type: 'string', description: 'Mevcut dönem bitiş (YYYY-MM-DD)' },
          previous_from: { type: 'string', description: 'Karşılaştırma dönemi başlangıç (YYYY-MM-DD)' },
          previous_to: { type: 'string', description: 'Karşılaştırma dönemi bitiş (YYYY-MM-DD)' },
        },
        required: ['current_from', 'current_to', 'previous_from', 'previous_to'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'detect_risk_customers',
      description: 'Risk altındaki müşterileri tespit eder — uzun süredir gelmeyenler, yüksek no-show skoru olanlar, VIP/regular iken kaybolanlar.',
      parameters: {
        type: 'object',
        properties: {
          min_days_since_visit: { type: 'number', description: 'Son ziyaretten bu yana minimum gün (varsayılan: 60)' },
          min_no_show_score: { type: 'number', description: 'Minimum no-show skoru 0-100 (varsayılan: 30)' },
          limit: { type: 'number', description: 'Sonuç sayısı (varsayılan: 20, maks 50)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'detect_anomalies',
      description: 'Son 7 güne göre anomali tespiti — geçen haftaya kıyasla gelir düşüşü, no-show artışı, yeni müşteri düşüşü, boş slot artışı gibi dikkat çekici değişimleri listeler.',
      parameters: { type: 'object', properties: {} },
    },
  },
  // Grup 10: Zamanlanmış Eylemler (Faz 5)
  {
    type: 'function',
    function: {
      name: 'schedule_action',
      description: 'Mevcut bir yazma aracı sonucunu (örn. send_message, create_appointment) ileri tarihli çalışacak şekilde zamanlar. Önce ilgili yazma aracını çağır, dönen action_id ile bu tool\'u kullan.',
      parameters: {
        type: 'object',
        properties: {
          action_id: { type: 'string', description: 'Zamanlanacak pending action ID' },
          scheduled_for: { type: 'string', description: 'ISO tarih-saat (YYYY-MM-DDTHH:mm veya tam ISO). İşletme yerel saatiyle girilebilir.' },
        },
        required: ['action_id', 'scheduled_for'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_scheduled_actions',
      description: 'Bekleyen (zamanlanmış) eylemleri listeler.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Maksimum sonuç sayısı (varsayılan 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_scheduled_action',
      description: 'Zamanlanmış bir eylemi iptal eder.',
      parameters: {
        type: 'object',
        properties: {
          action_id: { type: 'string', description: 'İptal edilecek pending/scheduled action ID' },
        },
        required: ['action_id'],
      },
    },
  },
  // Grup 11: Kampanya & İş Akışı (Faz 6)
  {
    type: 'function',
    function: {
      name: 'list_campaigns',
      description: 'Kampanyaları listeler. Durum filtresi opsiyonel.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['draft', 'scheduled', 'sending', 'completed', 'cancelled'] },
          limit: { type: 'number', description: 'Maks. sonuç (varsayılan 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'estimate_campaign_audience',
      description: 'Verilen segment filtresine göre mesaj gönderilecek tahmini müşteri sayısını hesaplar.',
      parameters: {
        type: 'object',
        properties: {
          segments: { type: 'array', items: { type: 'string', enum: ['new', 'regular', 'vip', 'risk', 'lost'] } },
          lastVisitDaysMin: { type: 'number', description: 'Son ziyaretten bu yana minimum gün' },
          lastVisitDaysMax: { type: 'number', description: 'Son ziyaretten bu yana maksimum gün' },
          birthdayMonth: { type: 'number', description: 'Doğum ayı (1-12)' },
          minTotalVisits: { type: 'number' },
          minTotalRevenue: { type: 'number' },
          createdDaysAgoMax: { type: 'number' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_campaign',
      description: 'Draft/scheduled kampanya oluşturur. Mesajda {name} ve {businessName} değişkenleri kullanılabilir.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Kampanya adı' },
          description: { type: 'string' },
          message_template: { type: 'string', description: 'Mesaj şablonu ({name}, {businessName} değişkenleriyle)' },
          channel: { type: 'string', enum: ['auto', 'sms', 'whatsapp'] },
          scheduled_at: { type: 'string', description: 'ISO tarih-saat (opsiyonel, verilirse zamanlanır)' },
          segment_filter: {
            type: 'object',
            properties: {
              segments: { type: 'array', items: { type: 'string', enum: ['new', 'regular', 'vip', 'risk', 'lost'] } },
              lastVisitDaysMin: { type: 'number' },
              lastVisitDaysMax: { type: 'number' },
              birthdayMonth: { type: 'number' },
              minTotalVisits: { type: 'number' },
              minTotalRevenue: { type: 'number' },
              createdDaysAgoMax: { type: 'number' },
            },
          },
        },
        required: ['name', 'message_template'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_campaign',
      description: 'Draft/scheduled durumdaki bir kampanyayı başlatır.',
      parameters: {
        type: 'object',
        properties: {
          campaign_id: { type: 'string' },
        },
        required: ['campaign_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_workflows',
      description: 'Otomatik iş akışlarını listeler.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_workflow',
      description: 'Yeni otomatik iş akışı oluşturur (tetikleyici + adımlar).',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          trigger_type: { type: 'string', enum: ['appointment_completed', 'appointment_cancelled', 'customer_created', 'no_show', 'birthday'] },
          steps: {
            type: 'array',
            description: 'Adımlar: her biri {delay_hours, message}',
            items: {
              type: 'object',
              properties: {
                delay_hours: { type: 'number', description: 'Tetiklemeden sonra bekleme (saat)' },
                message: { type: 'string', description: 'Gönderilecek mesaj ({name}, {businessName})' },
              },
              required: ['delay_hours', 'message'],
            },
          },
        },
        required: ['name', 'trigger_type', 'steps'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'toggle_workflow',
      description: 'Bir iş akışını aktifleştirir veya pasifleştirir.',
      parameters: {
        type: 'object',
        properties: {
          workflow_id: { type: 'string' },
          is_active: { type: 'boolean' },
        },
        required: ['workflow_id', 'is_active'],
      },
    },
  },
  // ── Faz 7: Sistem Yönetimi ─────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'update_working_hours',
      description: 'İşletmenin çalışma saatlerini günlük bazda günceller. Onay ister.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'array',
            description: 'Güncellenecek günler. Sadece belirtilenler değişir; kapatmak için closed=true.',
            items: {
              type: 'object',
              properties: {
                day: { type: 'string', enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
                closed: { type: 'boolean', description: 'true ise bu gün kapalı olur' },
                open: { type: 'string', description: 'HH:MM (ör. 09:00)' },
                close: { type: 'string', description: 'HH:MM (ör. 18:00)' },
              },
              required: ['day'],
            },
          },
        },
        required: ['days'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_blocked_slots',
      description: 'Belirli bir aralıkta randevu alınamayacak bloklanmış zaman dilimlerini listeler.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'YYYY-MM-DD (varsayılan: bugün)' },
          to: { type: 'string', description: 'YYYY-MM-DD (varsayılan: 30 gün sonra)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_blocked_slot',
      description: 'Belirli tarih ve saat aralığını randevuya kapatır (izin, toplantı vb.). Onay ister.',
      parameters: {
        type: 'object',
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          start_time: { type: 'string', description: 'HH:MM' },
          end_time: { type: 'string', description: 'HH:MM' },
          staff_id: { type: 'string', description: 'Sadece belirli personeli blokla (opsiyonel)' },
          reason: { type: 'string' },
        },
        required: ['date', 'start_time', 'end_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_blocked_slot',
      description: 'Bir bloklanmış zaman dilimini kaldırır. Onay ister.',
      parameters: {
        type: 'object',
        properties: {
          blocked_slot_id: { type: 'string' },
        },
        required: ['blocked_slot_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_shifts',
      description: 'Belirli bir hafta için personel vardiyalarını listeler.',
      parameters: {
        type: 'object',
        properties: {
          week_start: { type: 'string', description: 'YYYY-MM-DD (Pazartesi)' },
          week_end: { type: 'string', description: 'YYYY-MM-DD (Pazar)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'assign_shift',
      description: 'Bir personele belirli gün için vardiya atar. Onay ister.',
      parameters: {
        type: 'object',
        properties: {
          staff_id: { type: 'string' },
          shift_date: { type: 'string', description: 'YYYY-MM-DD' },
          shift_type: { type: 'string', enum: ['regular', 'off'], description: 'off = izinli' },
          start_time: { type: 'string', description: 'HH:MM (regular için zorunlu)' },
          end_time: { type: 'string', description: 'HH:MM (regular için zorunlu)' },
          notes: { type: 'string' },
        },
        required: ['staff_id', 'shift_date', 'shift_type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_shift_definition',
      description: 'İşletme ayarlarına mesai tanımı ekler (ör. "Sabahçı 08:00-14:00"). Onay ister.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Mesai adı (Sabahçı/Öğlenci vb.)' },
          start: { type: 'string', description: 'HH:MM' },
          end: { type: 'string', description: 'HH:MM' },
        },
        required: ['name', 'start', 'end'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'invite_staff',
      description: 'Yeni personel için davet linki oluşturur. Onay ister. Sadece owner.',
      parameters: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Personelin e-postası (opsiyonel)' },
          role: { type: 'string', enum: ['staff', 'manager'], description: 'Varsayılan: staff' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_staff_permissions',
      description: 'Bir personelin yetkilerini günceller. Onay ister. Sadece owner.',
      parameters: {
        type: 'object',
        properties: {
          staff_id: { type: 'string' },
          permissions: {
            type: 'object',
            description: 'StaffPermissions objesi (değiştirilecek anahtarlar)',
            additionalProperties: { type: 'boolean' },
          },
        },
        required: ['staff_id', 'permissions'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_business_settings',
      description: 'İşletme ayarlarını günceller (hatırlatmalar, WhatsApp, sadakat vb.). Onay ister.',
      parameters: {
        type: 'object',
        properties: {
          settings: {
            type: 'object',
            description: 'BusinessSettings partial. Örnek anahtarlar: reminder_24h, reminder_2h, auto_review_request, whatsapp_enabled, default_channel, birthday_sms_enabled, loyalty_enabled, points_per_currency, periodic_reminder_enabled.',
            additionalProperties: true,
          },
        },
        required: ['settings'],
      },
    },
  },
  // ── Faz 8: Finans (Fatura, Ödeme, POS, Gider, Gelir) ────────────────
  {
    type: 'function',
    function: {
      name: 'list_unpaid_invoices',
      description: 'Ödenmemiş (pending/partial/overdue) faturaları listeler.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string', description: 'Sadece belirli müşterinin faturaları (opsiyonel)' },
          limit: { type: 'number', description: 'Maks. kayıt sayısı (varsayılan 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_invoice',
      description: 'Yeni bir fatura oluşturur (draft durumunda). Onay ister.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string' },
          items: {
            type: 'array',
            description: 'Fatura kalemleri',
            items: {
              type: 'object',
              properties: {
                service_name: { type: 'string' },
                quantity: { type: 'number' },
                unit_price: { type: 'number' },
                type: { type: 'string', enum: ['service', 'product'] },
                product_id: { type: 'string' },
              },
              required: ['service_name', 'quantity', 'unit_price'],
            },
          },
          tax_rate: { type: 'number', description: 'KDV oranı (%). Varsayılan 0.' },
          discount_amount: { type: 'number', description: 'İndirim tutarı' },
          discount_type: { type: 'string', enum: ['percentage', 'fixed'] },
          due_date: { type: 'string', description: 'YYYY-MM-DD' },
          notes: { type: 'string' },
        },
        required: ['customer_id', 'items'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'record_invoice_payment',
      description: 'Bir faturaya ödeme kaydeder (tam, kısmi, taksit veya kapora). Onay ister.',
      parameters: {
        type: 'object',
        properties: {
          invoice_id: { type: 'string' },
          amount: { type: 'number' },
          method: { type: 'string', enum: ['cash', 'card', 'transfer', 'online'] },
          payment_type: { type: 'string', enum: ['payment', 'deposit', 'installment', 'refund'] },
          installment_number: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['invoice_id', 'amount', 'method'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_invoice_from_appointment',
      description: 'Tamamlanmış bir randevudan otomatik fatura oluşturur (hizmet adı + fiyatı). Onay ister.',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: { type: 'string' },
          tax_rate: { type: 'number' },
        },
        required: ['appointment_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_pos_transaction',
      description: 'Kasada (POS) satış işlemi oluşturur. Onay ister.',
      parameters: {
        type: 'object',
        properties: {
          customer_id: { type: 'string' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                qty: { type: 'number' },
                price: { type: 'number' },
              },
              required: ['name', 'qty', 'price'],
            },
          },
          payment_method: { type: 'string', enum: ['cash', 'card', 'transfer', 'online'] },
          discount_amount: { type: 'number' },
          notes: { type: 'string' },
        },
        required: ['items', 'payment_method'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'record_expense',
      description: 'Yeni bir gider kaydı oluşturur. Onay ister.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Ör: Kira, Elektrik, Personel, Malzeme, Diğer' },
          amount: { type: 'number' },
          expense_date: { type: 'string', description: 'YYYY-MM-DD (varsayılan bugün)' },
          description: { type: 'string' },
          is_recurring: { type: 'boolean' },
          recurring_period: { type: 'string', enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom'] },
          custom_interval_days: { type: 'number' },
        },
        required: ['category', 'amount'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'record_manual_income',
      description: 'Randevu/fatura dışı manuel gelir kaydı (komisyon, ürün satışı, kira vb.). Onay ister.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Ör: Hizmet Geliri, Ürün Satışı, Komisyon, Kira Geliri, Paket/Üyelik, Diğer' },
          amount: { type: 'number' },
          income_date: { type: 'string', description: 'YYYY-MM-DD' },
          description: { type: 'string' },
          is_recurring: { type: 'boolean' },
          recurring_period: { type: 'string', enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'custom'] },
          custom_interval_days: { type: 'number' },
        },
        required: ['category', 'amount'],
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
  get_revenue_breakdown: 'Gelir dökümü hesaplanıyor...',
  get_customer_lifetime_value: 'Müşteri değeri hesaplanıyor...',
  get_occupancy_stats: 'Doluluk analizi yapılıyor...',
  get_staff_performance: 'Personel performansı hesaplanıyor...',
  get_expense_breakdown: 'Gider dökümü hesaplanıyor...',
  get_profit_loss: 'Kâr-zarar raporu hazırlanıyor...',
  compare_periods: 'Dönemler karşılaştırılıyor...',
  detect_risk_customers: 'Risk altındaki müşteriler tespit ediliyor...',
  detect_anomalies: 'Anomali taraması yapılıyor...',
  schedule_action: 'Eylem zamanlanıyor...',
  list_scheduled_actions: 'Planlı eylemler listeleniyor...',
  cancel_scheduled_action: 'Zamanlanmış eylem iptal ediliyor...',
  list_campaigns: 'Kampanyalar listeleniyor...',
  estimate_campaign_audience: 'Hedef kitle hesaplanıyor...',
  create_campaign: 'Kampanya önizlemesi hazırlanıyor...',
  send_campaign: 'Kampanya gönderim önizlemesi hazırlanıyor...',
  list_workflows: 'İş akışları listeleniyor...',
  create_workflow: 'İş akışı önizlemesi hazırlanıyor...',
  toggle_workflow: 'İş akışı durumu değiştiriliyor...',
  update_working_hours: 'Çalışma saatleri önizlemesi hazırlanıyor...',
  list_blocked_slots: 'Bloklanmış saatler listeleniyor...',
  create_blocked_slot: 'Blok önizlemesi hazırlanıyor...',
  delete_blocked_slot: 'Blok kaldırma önizlemesi hazırlanıyor...',
  list_shifts: 'Vardiyalar listeleniyor...',
  assign_shift: 'Vardiya önizlemesi hazırlanıyor...',
  create_shift_definition: 'Mesai tanımı önizlemesi hazırlanıyor...',
  invite_staff: 'Davet linki önizlemesi hazırlanıyor...',
  update_staff_permissions: 'Yetki güncellemesi hazırlanıyor...',
  update_business_settings: 'Ayar güncellemesi hazırlanıyor...',
  list_unpaid_invoices: 'Ödenmemiş faturalar listeleniyor...',
  create_invoice: 'Fatura önizlemesi hazırlanıyor...',
  record_invoice_payment: 'Ödeme önizlemesi hazırlanıyor...',
  generate_invoice_from_appointment: 'Randevudan fatura hazırlanıyor...',
  create_pos_transaction: 'POS satış önizlemesi hazırlanıyor...',
  record_expense: 'Gider önizlemesi hazırlanıyor...',
  record_manual_income: 'Gelir önizlemesi hazırlanıyor...',
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
  get_revenue_breakdown: 'analytics',
  get_customer_lifetime_value: 'analytics',
  get_occupancy_stats: 'analytics',
  get_staff_performance: 'analytics',
  get_expense_breakdown: 'analytics',
  get_profit_loss: 'analytics',
  compare_periods: 'analytics',
  detect_risk_customers: 'customers',
  detect_anomalies: 'analytics',
  schedule_action: 'dashboard',
  list_scheduled_actions: 'dashboard',
  cancel_scheduled_action: 'dashboard',
  list_campaigns: 'campaigns',
  estimate_campaign_audience: 'campaigns',
  create_campaign: 'campaigns',
  send_campaign: 'campaigns',
  list_workflows: 'workflows',
  create_workflow: 'workflows',
  toggle_workflow: 'workflows',
  update_working_hours: 'settings',
  list_blocked_slots: 'appointments',
  create_blocked_slot: 'appointments',
  delete_blocked_slot: 'appointments',
  list_shifts: 'shifts',
  assign_shift: 'shifts',
  create_shift_definition: 'shifts',
  invite_staff: 'staff',
  update_staff_permissions: 'staff',
  update_business_settings: 'settings',
  list_unpaid_invoices: 'invoices',
  create_invoice: 'invoices',
  record_invoice_payment: 'invoices',
  generate_invoice_from_appointment: 'invoices',
  create_pos_transaction: 'pos',
  record_expense: 'analytics',
  record_manual_income: 'analytics',
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
      case 'get_revenue_breakdown':
        return await handleGetRevenueBreakdown(admin, businessId, args)
      case 'get_customer_lifetime_value':
        return await handleGetCLV(admin, businessId, args)
      case 'get_occupancy_stats':
        return await handleGetOccupancyStats(admin, businessId, args)
      case 'get_staff_performance':
        return await handleGetStaffPerformance(admin, businessId, args)
      case 'get_expense_breakdown':
        return await handleGetExpenseBreakdown(admin, businessId, args)
      case 'get_profit_loss':
        return await handleGetProfitLoss(admin, businessId, args)
      case 'compare_periods':
        return await handleComparePeriods(admin, businessId, args)
      case 'detect_risk_customers':
        return await handleDetectRiskCustomers(admin, businessId, args)
      case 'detect_anomalies':
        return await handleDetectAnomalies(admin, businessId)
      case 'schedule_action':
        return await handleScheduleAction(admin, ctx, args)
      case 'list_scheduled_actions':
        return await handleListScheduledActions(admin, ctx, args)
      case 'cancel_scheduled_action':
        return await handleCancelScheduledAction(admin, ctx, args)
      case 'list_campaigns':
        return await handleListCampaigns(admin, ctx, args)
      case 'estimate_campaign_audience':
        return await handleEstimateCampaignAudience(admin, ctx, args)
      case 'create_campaign':
        return await handleCreateCampaign(admin, ctx, args)
      case 'send_campaign':
        return await handleSendCampaign(admin, ctx, args)
      case 'list_workflows':
        return await handleListWorkflows(admin, ctx)
      case 'create_workflow':
        return await handleCreateWorkflow(admin, ctx, args)
      case 'toggle_workflow':
        return await handleToggleWorkflow(admin, ctx, args)
      case 'update_working_hours':
        return await handleUpdateWorkingHours(admin, ctx, args)
      case 'list_blocked_slots':
        return await handleListBlockedSlots(admin, ctx, args)
      case 'create_blocked_slot':
        return await handleCreateBlockedSlot(admin, ctx, args)
      case 'delete_blocked_slot':
        return await handleDeleteBlockedSlot(admin, ctx, args)
      case 'list_shifts':
        return await handleListShifts(admin, ctx, args)
      case 'assign_shift':
        return await handleAssignShift(admin, ctx, args)
      case 'create_shift_definition':
        return await handleCreateShiftDefinition(admin, ctx, args)
      case 'invite_staff':
        return await handleInviteStaff(admin, ctx, args)
      case 'update_staff_permissions':
        return await handleUpdateStaffPermissions(admin, ctx, args)
      case 'update_business_settings':
        return await handleUpdateBusinessSettings(admin, ctx, args)
      case 'list_unpaid_invoices':
        return await handleListUnpaidInvoices(admin, ctx, args)
      case 'create_invoice':
        return await handleCreateInvoice(admin, ctx, args)
      case 'record_invoice_payment':
        return await handleRecordInvoicePayment(admin, ctx, args)
      case 'generate_invoice_from_appointment':
        return await handleGenerateInvoiceFromAppointment(admin, ctx, args)
      case 'create_pos_transaction':
        return await handleCreatePosTransaction(admin, ctx, args)
      case 'record_expense':
        return await handleRecordExpense(admin, ctx, args)
      case 'record_manual_income':
        return await handleRecordManualIncome(admin, ctx, args)
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

const PAID_STATUSES = ['paid', 'partial'] as const
const ANALYTICS_QUERY_LIMIT = 5000

const round2 = (n: number): number => Math.round(n * 100) / 100
const round1 = (n: number): number => Math.round(n * 10) / 10
const paidAmount = (inv: { paid_amount?: number | null; total?: number | null }): number =>
  inv.paid_amount || inv.total || 0

function defaultMonthStart(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function defaultToday(): string {
  return new Date().toISOString().split('T')[0]
}

async function handleGetRevenueBreakdown(
  admin: SupabaseAdmin, businessId: string, args: Record<string, any>,
) {
  const groupBy = (args.group_by as string) || 'service'
  const from = (args.date_from as string) || defaultMonthStart()
  const to = (args.date_to as string) || defaultToday()
  const limit = Math.min(args.limit || 10, 25)

  const selectCols = groupBy === 'customer_type'
    ? 'id, total, paid_amount, status, staff_name, created_at, items, customer_id, customers(segment)'
    : 'id, total, paid_amount, status, staff_name, created_at, items'

  const { data: invoices, error } = await admin
    .from('invoices')
    .select(selectCols)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .in('status', PAID_STATUSES as unknown as string[])
    .gte('created_at', from)
    .lte('created_at', to + 'T23:59:59')
    .limit(ANALYTICS_QUERY_LIMIT)

  if (error) return { success: false, error: error.message }
  if (!invoices || invoices.length === 0) {
    return { success: true, data: { group_by: groupBy, from, to, breakdown: [], totals: { revenue: 0, count: 0, avg_ticket: 0 } } }
  }

  const totalRevenue = invoices.reduce((s, inv: any) => s + paidAmount(inv), 0)
  const bucket = new Map<string, { revenue: number; count: number }>()
  const bump = (key: string, revenue: number) => {
    const cur = bucket.get(key) || { revenue: 0, count: 0 }
    cur.revenue += revenue
    cur.count += 1
    bucket.set(key, cur)
  }

  for (const inv of invoices as any[]) {
    if (groupBy === 'service') {
      const items = (inv.items || []) as { service_name?: string; total?: number }[]
      for (const it of items) bump(it.service_name || 'Diğer', it.total || 0)
    } else if (groupBy === 'staff') {
      bump(inv.staff_name || 'Belirtilmemiş', paidAmount(inv))
    } else if (groupBy === 'customer_type') {
      const cust = Array.isArray(inv.customers) ? inv.customers[0] : inv.customers
      bump(cust?.segment || 'unknown', paidAmount(inv))
    } else if (groupBy === 'period') {
      const d = new Date(inv.created_at)
      bump(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, paidAmount(inv))
    }
  }

  const breakdown = Array.from(bucket.entries())
    .map(([label, d]) => ({
      label,
      revenue: round2(d.revenue),
      count: d.count,
      percentage: totalRevenue > 0 ? round1((d.revenue / totalRevenue) * 100) : 0,
    }))
    .sort((a, b) => groupBy === 'period' ? a.label.localeCompare(b.label) : b.revenue - a.revenue)
    .slice(0, limit)

  return {
    success: true,
    data: {
      group_by: groupBy, from, to, breakdown,
      totals: {
        revenue: round2(totalRevenue),
        count: invoices.length,
        avg_ticket: round2(totalRevenue / invoices.length),
      },
    },
  }
}

async function handleGetCLV(
  admin: SupabaseAdmin, businessId: string, args: Record<string, any>,
) {
  const limit = Math.min(args.limit || 10, 25)

  let q = admin
    .from('customers')
    .select('id, name, phone, segment, total_visits, total_revenue, last_visit_at, created_at')
    .eq('business_id', businessId)
    .eq('is_active', true)

  if (args.customer_id) q = q.eq('id', args.customer_id)
  else q = q.order('total_revenue', { ascending: false }).limit(limit)

  const { data: customers, error } = await q
  if (error) return { success: false, error: error.message }
  if (!customers || customers.length === 0) return { success: true, data: { clv: [] } }

  const now = Date.now()
  const clv = customers.map((c: any) => {
    const totalSpend = c.total_revenue || 0
    const visits = c.total_visits || 0
    const avgSpend = visits > 0 ? totalSpend / visits : 0
    const ageMonths = c.created_at
      ? Math.max(1, Math.floor((now - new Date(c.created_at).getTime()) / (30 * 24 * 60 * 60 * 1000)))
      : 1
    const monthlyFreq = visits / ageMonths
    const annualValue = monthlyFreq * avgSpend * 12
    const daysSinceLast = c.last_visit_at
      ? Math.floor((now - new Date(c.last_visit_at).getTime()) / (24 * 60 * 60 * 1000))
      : null
    return {
      customer_id: c.id,
      name: c.name,
      phone: c.phone,
      segment: c.segment,
      total_spend: round2(totalSpend),
      visit_count: visits,
      avg_spend: round2(avgSpend),
      monthly_frequency: round2(monthlyFreq),
      estimated_annual_value: round2(annualValue),
      days_since_last_visit: daysSinceLast,
      customer_age_months: ageMonths,
    }
  })

  return { success: true, data: { clv } }
}

async function handleGetOccupancyStats(
  admin: SupabaseAdmin, businessId: string, args: Record<string, any>,
) {
  const from = (args.date_from as string) || defaultMonthStart()
  const to = (args.date_to as string) || defaultToday()
  const staffId = args.staff_id as string | undefined

  const { data: business } = await admin
    .from('businesses')
    .select('working_hours')
    .eq('id', businessId)
    .single()

  let q = admin
    .from('appointments')
    .select('id, appointment_date, start_time, end_time, status, staff_id, staff_members(name)')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .gte('appointment_date', from)
    .lte('appointment_date', to)
    .limit(ANALYTICS_QUERY_LIMIT)
  if (staffId) q = q.eq('staff_id', staffId)

  const { data: apts, error } = await q
  if (error) return { success: false, error: error.message }
  if (!apts || apts.length === 0) {
    return {
      success: true,
      data: {
        from, to,
        overall_occupancy: 0,
        stats: { total: 0, completed: 0, cancelled: 0, no_show: 0, completion_rate: 0, cancel_rate: 0, no_show_rate: 0 },
        by_staff: [],
        by_day: [],
      },
    }
  }

  const total = apts.length
  const completed = apts.filter((a: any) => a.status === 'completed').length
  const cancelled = apts.filter((a: any) => a.status === 'cancelled').length
  const noShow = apts.filter((a: any) => a.status === 'no_show').length

  const defaultDayMinutes = 9 * 60
  const wh = (business as any)?.working_hours || {}
  const getWorkMinutes = (dayIdx: number): number => {
    const dk = DAY_KEYS[dayIdx]
    const dh = wh[dk]
    if (!dh || dh.closed || !dh.open || !dh.close) return 0
    const [oh, om] = dh.open.split(':').map(Number)
    const [ch, cm] = dh.close.split(':').map(Number)
    return (ch * 60 + cm) - (oh * 60 + om)
  }

  const dayMap = new Map<string, { booked: number; count: number }>()
  const staffMap = new Map<string, { booked: number; count: number; name: string }>()

  for (const a of apts as any[]) {
    if (a.status === 'cancelled') continue
    let dur = 30
    if (a.start_time && a.end_time) {
      const [sh, sm] = a.start_time.split(':').map(Number)
      const [eh, em] = a.end_time.split(':').map(Number)
      dur = (eh * 60 + em) - (sh * 60 + sm)
      if (dur <= 0) dur = 30
    }
    const dayData = dayMap.get(a.appointment_date) || { booked: 0, count: 0 }
    dayData.booked += dur
    dayData.count += 1
    dayMap.set(a.appointment_date, dayData)

    const sName = Array.isArray(a.staff_members) ? a.staff_members[0]?.name : a.staff_members?.name
    const sKey = a.staff_id || 'unassigned'
    const sData = staffMap.get(sKey) || { booked: 0, count: 0, name: sName || 'Atanmamış' }
    sData.booked += dur
    sData.count += 1
    staffMap.set(sKey, sData)
  }

  const byDay = Array.from(dayMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, d]) => {
      const dayIdx = new Date(date + 'T00:00:00').getDay()
      const available = getWorkMinutes(dayIdx) || defaultDayMinutes
      return {
        date,
        booked_minutes: d.booked,
        available_minutes: available,
        occupancy_rate: Math.min(100, Math.round((d.booked / available) * 100)),
        appointment_count: d.count,
      }
    })

  const totalDays = Math.max(1, dayMap.size)
  const totalBooked = Array.from(dayMap.values()).reduce((s, d) => s + d.booked, 0)
  const overall = Math.min(100, Math.round((totalBooked / (totalDays * defaultDayMinutes)) * 100))

  const byStaff = Array.from(staffMap.entries()).map(([id, d]) => ({
    staff_id: id,
    name: d.name,
    booked_minutes: d.booked,
    appointment_count: d.count,
    occupancy_rate: Math.min(100, Math.round((d.booked / (totalDays * defaultDayMinutes)) * 100)),
  }))

  return {
    success: true,
    data: {
      from, to,
      overall_occupancy: overall,
      stats: {
        total, completed, cancelled, no_show: noShow,
        completion_rate: Math.round((completed / total) * 100),
        cancel_rate: Math.round((cancelled / total) * 100),
        no_show_rate: Math.round((noShow / total) * 100),
      },
      by_staff: byStaff,
      by_day: byDay,
    },
  }
}

async function handleGetStaffPerformance(
  admin: SupabaseAdmin, businessId: string, args: Record<string, any>,
) {
  const from = (args.date_from as string) || defaultMonthStart()
  const to = (args.date_to as string) || defaultToday()
  const staffId = args.staff_id as string | undefined

  let sq = admin
    .from('staff_members')
    .select('id, name, role')
    .eq('business_id', businessId)
    .eq('is_active', true)
  if (staffId) sq = sq.eq('id', staffId)

  const { data: staffList, error: sErr } = await sq
  if (sErr) return { success: false, error: sErr.message }
  if (!staffList || staffList.length === 0) return { success: true, data: { performance: [] } }

  let aq = admin
    .from('appointments')
    .select('staff_id, status')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .gte('appointment_date', from)
    .lte('appointment_date', to)
    .limit(ANALYTICS_QUERY_LIMIT)
  if (staffId) aq = aq.eq('staff_id', staffId)

  let iq = admin
    .from('invoices')
    .select('staff_id, total, paid_amount')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .in('status', PAID_STATUSES as unknown as string[])
    .gte('created_at', from)
    .lte('created_at', to + 'T23:59:59')
    .limit(ANALYTICS_QUERY_LIMIT)
  if (staffId) iq = iq.eq('staff_id', staffId)

  const [{ data: apts }, { data: invoices }] = await Promise.all([aq, iq])

  type AgRow = { total: number; completed: number; cancelled: number; no_show: number; revenue: number }
  const empty = (): AgRow => ({ total: 0, completed: 0, cancelled: 0, no_show: 0, revenue: 0 })
  const byStaff = new Map<string, AgRow>()

  for (const a of (apts || []) as any[]) {
    if (!a.staff_id) continue
    const row = byStaff.get(a.staff_id) || empty()
    row.total += 1
    if (a.status === 'completed') row.completed += 1
    else if (a.status === 'cancelled') row.cancelled += 1
    else if (a.status === 'no_show') row.no_show += 1
    byStaff.set(a.staff_id, row)
  }
  for (const i of (invoices || []) as any[]) {
    if (!i.staff_id) continue
    const row = byStaff.get(i.staff_id) || empty()
    row.revenue += paidAmount(i)
    byStaff.set(i.staff_id, row)
  }

  const performance = staffList.map((s: any) => {
    const row = byStaff.get(s.id) || empty()
    return {
      staff_id: s.id,
      name: s.name,
      role: s.role,
      total_appointments: row.total,
      completed_appointments: row.completed,
      cancelled_appointments: row.cancelled,
      no_show_appointments: row.no_show,
      completion_rate: row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0,
      no_show_rate: row.total > 0 ? Math.round((row.no_show / row.total) * 100) : 0,
      total_revenue: round2(row.revenue),
      avg_revenue_per_appointment: row.completed > 0 ? round2(row.revenue / row.completed) : 0,
    }
  })

  performance.sort((a, b) => b.total_revenue - a.total_revenue)
  return { success: true, data: { from, to, performance } }
}

async function handleGetExpenseBreakdown(
  admin: SupabaseAdmin, businessId: string, args: Record<string, any>,
) {
  const from = (args.date_from as string) || defaultMonthStart()
  const to = (args.date_to as string) || defaultToday()

  const { data: expenses, error } = await admin
    .from('expenses')
    .select('category, amount, expense_date, description')
    .eq('business_id', businessId)
    .gte('expense_date', from)
    .lte('expense_date', to)
    .limit(ANALYTICS_QUERY_LIMIT)

  if (error) return { success: false, error: error.message }
  if (!expenses || expenses.length === 0) {
    return { success: true, data: { from, to, breakdown: [], total: 0 } }
  }

  const total = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
  const catMap = new Map<string, { amount: number; count: number }>()
  for (const e of expenses as any[]) {
    const key = e.category || 'Diğer'
    const cur = catMap.get(key) || { amount: 0, count: 0 }
    cur.amount += Number(e.amount || 0)
    cur.count += 1
    catMap.set(key, cur)
  }
  const breakdown = Array.from(catMap.entries())
    .map(([category, d]) => ({
      category,
      amount: round2(d.amount),
      count: d.count,
      percentage: total > 0 ? round1((d.amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  return { success: true, data: { from, to, total: round2(total), breakdown } }
}

async function sumRevenue(admin: SupabaseAdmin, businessId: string, from: string, to: string): Promise<number> {
  const [{ data: invoices }, { data: income }] = await Promise.all([
    admin
      .from('invoices')
      .select('total, paid_amount, status')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .in('status', PAID_STATUSES as unknown as string[])
      .gte('created_at', from)
      .lte('created_at', to + 'T23:59:59')
      .limit(ANALYTICS_QUERY_LIMIT),
    admin
      .from('income')
      .select('amount')
      .eq('business_id', businessId)
      .gte('income_date', from)
      .lte('income_date', to)
      .limit(ANALYTICS_QUERY_LIMIT),
  ])
  const invSum = (invoices || []).reduce((s: number, i: any) => s + paidAmount(i), 0)
  const incSum = (income || []).reduce((s: number, i: any) => s + Number(i.amount || 0), 0)
  return invSum + incSum
}

async function sumExpenses(admin: SupabaseAdmin, businessId: string, from: string, to: string): Promise<number> {
  const { data } = await admin
    .from('expenses')
    .select('amount')
    .eq('business_id', businessId)
    .gte('expense_date', from)
    .lte('expense_date', to)
    .limit(ANALYTICS_QUERY_LIMIT)
  return (data || []).reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
}

async function countAppointments(admin: SupabaseAdmin, businessId: string, from: string, to: string) {
  const { data } = await admin
    .from('appointments')
    .select('status')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .gte('appointment_date', from)
    .lte('appointment_date', to)
    .limit(ANALYTICS_QUERY_LIMIT)
  const arr = data || []
  return {
    total: arr.length,
    completed: arr.filter((a: any) => a.status === 'completed').length,
  }
}

async function countNewCustomers(admin: SupabaseAdmin, businessId: string, from: string, to: string): Promise<number> {
  const { count } = await admin
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('created_at', from)
    .lte('created_at', to + 'T23:59:59')
  return count || 0
}

async function handleGetProfitLoss(
  admin: SupabaseAdmin, businessId: string, args: Record<string, any>,
) {
  const from = (args.date_from as string) || defaultMonthStart()
  const to = (args.date_to as string) || defaultToday()

  const [revenue, expenses] = await Promise.all([
    sumRevenue(admin, businessId, from, to),
    sumExpenses(admin, businessId, from, to),
  ])

  const net = revenue - expenses
  const margin = revenue > 0 ? (net / revenue) * 100 : 0

  return {
    success: true,
    data: {
      from, to,
      revenue: round2(revenue),
      expenses: round2(expenses),
      net_profit: round2(net),
      margin_percentage: round1(margin),
    },
  }
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return round1(((current - previous) / previous) * 100)
}

async function handleComparePeriods(
  admin: SupabaseAdmin, businessId: string, args: Record<string, any>,
) {
  const cf = args.current_from as string
  const ct = args.current_to as string
  const pf = args.previous_from as string
  const pt = args.previous_to as string
  if (!cf || !ct || !pf || !pt) {
    return { success: false, error: 'Her iki dönem için başlangıç ve bitiş tarihi zorunludur' }
  }

  const [curRev, prevRev, curExp, prevExp, curApts, prevApts, curNew, prevNew] = await Promise.all([
    sumRevenue(admin, businessId, cf, ct),
    sumRevenue(admin, businessId, pf, pt),
    sumExpenses(admin, businessId, cf, ct),
    sumExpenses(admin, businessId, pf, pt),
    countAppointments(admin, businessId, cf, ct),
    countAppointments(admin, businessId, pf, pt),
    countNewCustomers(admin, businessId, cf, ct),
    countNewCustomers(admin, businessId, pf, pt),
  ])

  const curCompletionRate = curApts.total > 0 ? (curApts.completed / curApts.total) * 100 : 0
  const prevCompletionRate = prevApts.total > 0 ? (prevApts.completed / prevApts.total) * 100 : 0

  return {
    success: true,
    data: {
      current: { from: cf, to: ct },
      previous: { from: pf, to: pt },
      revenue: { current: round2(curRev), previous: round2(prevRev), change_pct: pctChange(curRev, prevRev) },
      expenses: { current: round2(curExp), previous: round2(prevExp), change_pct: pctChange(curExp, prevExp) },
      net_profit: {
        current: round2(curRev - curExp),
        previous: round2(prevRev - prevExp),
        change_pct: pctChange(curRev - curExp, prevRev - prevExp),
      },
      appointments: { current: curApts.total, previous: prevApts.total, change_pct: pctChange(curApts.total, prevApts.total) },
      new_customers: { current: curNew, previous: prevNew, change_pct: pctChange(curNew, prevNew) },
      completion_rate: { current: round1(curCompletionRate), previous: round1(prevCompletionRate), change_pct: pctChange(curCompletionRate, prevCompletionRate) },
    },
  }
}

const RISK_DEFAULT_DAYS = 60
const RISK_DEFAULT_NO_SHOW_SCORE = 30
const RISK_DEFAULT_LIMIT = 20
const RISK_MAX_LIMIT = 50
const MS_PER_DAY = 24 * 60 * 60 * 1000

export async function handleDetectRiskCustomers(
  admin: SupabaseAdmin, businessId: string, args: Record<string, any>,
) {
  const minDays = Math.max(0, Number(args.min_days_since_visit) || RISK_DEFAULT_DAYS)
  const minScore = Math.max(0, Number(args.min_no_show_score) || RISK_DEFAULT_NO_SHOW_SCORE)
  const limit = Math.min(Number(args.limit) || RISK_DEFAULT_LIMIT, RISK_MAX_LIMIT)
  const cutoff = new Date(Date.now() - minDays * MS_PER_DAY).toISOString().split('T')[0]

  const { data, error } = await admin
    .from('customers')
    .select('id, name, phone, segment, total_visits, total_revenue, last_visit_at, no_show_score')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .or(`last_visit_at.lte.${cutoff},no_show_score.gte.${minScore}`)
    .order('total_revenue', { ascending: false })
    .limit(limit)

  if (error) return { success: false, error: error.message }
  const customers = (data || []).map((c: any) => {
    const daysSince = c.last_visit_at
      ? Math.floor((Date.now() - new Date(c.last_visit_at).getTime()) / MS_PER_DAY)
      : null
    const reasons: string[] = []
    if (daysSince != null && daysSince >= minDays) reasons.push(`${daysSince} gündür gelmedi`)
    if ((c.no_show_score || 0) >= minScore) reasons.push(`no-show skoru %${c.no_show_score}`)
    if (c.segment === 'vip' || c.segment === 'regular') reasons.push(`segment: ${c.segment}`)
    return {
      customer_id: c.id,
      name: c.name,
      phone: c.phone,
      segment: c.segment,
      total_visits: c.total_visits,
      total_revenue: round2(c.total_revenue || 0),
      days_since_last_visit: daysSince,
      no_show_score: c.no_show_score || 0,
      reasons,
    }
  })
  return { success: true, data: { toplam: customers.length, customers } }
}

export async function handleDetectAnomalies(admin: SupabaseAdmin, businessId: string) {
  const today = new Date()
  const toISO = (d: Date) => d.toISOString().split('T')[0]
  const thisEnd = toISO(today)
  const thisStart = toISO(new Date(today.getTime() - 6 * MS_PER_DAY))
  const prevEnd = toISO(new Date(today.getTime() - 7 * MS_PER_DAY))
  const prevStart = toISO(new Date(today.getTime() - 13 * MS_PER_DAY))

  const [curRev, prevRev, curApts, prevApts, curNew, prevNew] = await Promise.all([
    sumRevenue(admin, businessId, thisStart, thisEnd),
    sumRevenue(admin, businessId, prevStart, prevEnd),
    countAppointmentsDetailed(admin, businessId, thisStart, thisEnd),
    countAppointmentsDetailed(admin, businessId, prevStart, prevEnd),
    countNewCustomers(admin, businessId, thisStart, thisEnd),
    countNewCustomers(admin, businessId, prevStart, prevEnd),
  ])

  const anomalies: Array<{ type: string; severity: 'info' | 'warning' | 'alert'; message: string; change_pct: number | null }> = []
  const revChange = pctChange(curRev, prevRev)
  if (revChange != null && revChange <= -20) {
    anomalies.push({ type: 'revenue_drop', severity: revChange <= -40 ? 'alert' : 'warning', message: `Haftalık gelir %${Math.abs(revChange)} düştü`, change_pct: revChange })
  }
  const aptChange = pctChange(curApts.total, prevApts.total)
  if (aptChange != null && aptChange <= -20) {
    anomalies.push({ type: 'appointment_drop', severity: 'warning', message: `Randevu sayısı %${Math.abs(aptChange)} düştü`, change_pct: aptChange })
  }
  const noShowChange = pctChange(curApts.no_show, prevApts.no_show)
  if (curApts.no_show > prevApts.no_show && curApts.no_show >= 3) {
    anomalies.push({ type: 'no_show_spike', severity: 'warning', message: `Bu hafta ${curApts.no_show} no-show (geçen hafta ${prevApts.no_show})`, change_pct: noShowChange })
  }
  const newChange = pctChange(curNew, prevNew)
  if (newChange != null && newChange <= -30) {
    anomalies.push({ type: 'new_customer_drop', severity: 'info', message: `Yeni müşteri kazanımı %${Math.abs(newChange)} düştü`, change_pct: newChange })
  }

  return {
    success: true,
    data: {
      period: { current: { from: thisStart, to: thisEnd }, previous: { from: prevStart, to: prevEnd } },
      metrics: {
        revenue: { current: round2(curRev), previous: round2(prevRev), change_pct: revChange },
        appointments: { current: curApts.total, previous: prevApts.total, change_pct: aptChange },
        no_show: { current: curApts.no_show, previous: prevApts.no_show, change_pct: noShowChange },
        new_customers: { current: curNew, previous: prevNew, change_pct: newChange },
      },
      anomalies,
    },
  }
}

async function countAppointmentsDetailed(
  admin: SupabaseAdmin, businessId: string, from: string, to: string,
) {
  const { data } = await admin
    .from('appointments')
    .select('status')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .gte('appointment_date', from)
    .lte('appointment_date', to)
    .limit(ANALYTICS_QUERY_LIMIT)
  const arr = data || []
  return {
    total: arr.length,
    completed: arr.filter((a: any) => a.status === 'completed').length,
    cancelled: arr.filter((a: any) => a.status === 'cancelled').length,
    no_show: arr.filter((a: any) => a.status === 'no_show').length,
  }
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

// ── Faz 5: Scheduled Actions Handlers ──

function parseScheduledFor(raw: string): string | null {
  if (!raw) return null
  // Accept YYYY-MM-DDTHH:mm (local) or full ISO. Interpret naïve as Turkey local (+03:00).
  const hasTz = /Z|[+-]\d{2}:?\d{2}$/.test(raw)
  let d: Date
  if (hasTz) {
    d = new Date(raw)
  } else {
    // Treat as Turkey local (UTC+3, no DST)
    d = new Date(raw + '+03:00')
  }
  if (isNaN(d.getTime())) return null
  return d.toISOString()
}

async function handleScheduleAction(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  const actionId = args.action_id as string
  const scheduledForIso = parseScheduledFor(args.scheduled_for as string)
  if (!scheduledForIso) return { success: false, error: 'Geçersiz tarih/saat formatı' }
  if (new Date(scheduledForIso).getTime() <= Date.now()) {
    return { success: false, error: 'Zamanlanan an gelecekte olmalı' }
  }

  const { data: action, error } = await admin
    .from('ai_pending_actions')
    .select('id, staff_id, business_id, status, preview')
    .eq('id', actionId)
    .single()

  if (error || !action) return { success: false, error: 'Eylem bulunamadı' }
  if (action.business_id !== ctx.businessId) return { success: false, error: 'Yetkisiz' }
  if (action.staff_id !== ctx.staffId) return { success: false, error: 'Yetkisiz' }
  if (action.status !== 'pending' && action.status !== 'scheduled') {
    return { success: false, error: 'Bu eylem zaten işlenmiş' }
  }

  const { error: updErr } = await admin
    .from('ai_pending_actions')
    .update({ status: 'scheduled', scheduled_for: scheduledForIso })
    .eq('id', actionId)

  if (updErr) return { success: false, error: 'Zamanlama kaydedilemedi' }

  return {
    success: true,
    data: {
      action_id: actionId,
      scheduled_for: scheduledForIso,
      preview: action.preview,
      message: `✓ Planlandı: ${new Date(scheduledForIso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })}`,
    },
  }
}

async function handleListScheduledActions(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  const limit = Math.min(args.limit || 20, 50)
  const { data, error } = await admin
    .from('ai_pending_actions')
    .select('id, action_type, preview, scheduled_for, created_at')
    .eq('business_id', ctx.businessId)
    .eq('status', 'scheduled')
    .order('scheduled_for', { ascending: true })
    .limit(limit)

  if (error) return { success: false, error: 'Listelenemedi' }

  return {
    success: true,
    data: {
      count: (data || []).length,
      actions: (data || []).map((a: any) => ({
        action_id: a.id,
        action_type: a.action_type,
        preview: a.preview,
        scheduled_for: a.scheduled_for,
        scheduled_for_local: a.scheduled_for
          ? new Date(a.scheduled_for).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' })
          : null,
      })),
    },
  }
}

async function handleCancelScheduledAction(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  const res = await cancelPendingAction(admin, args.action_id, ctx.staffId, ctx.businessId)
  if (!res.ok) return { success: false, error: res.message }
  return { success: true, data: { message: '✓ Zamanlanmış eylem iptal edildi' } }
}

// ── Faz 6: Campaign & Workflow Handlers ──

const VALID_TRIGGERS = ['appointment_completed', 'appointment_cancelled', 'customer_created', 'no_show', 'birthday'] as const

async function handleListCampaigns(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  let query = admin
    .from('campaigns')
    .select('id, name, description, status, channel, scheduled_at, stats, created_at')
    .eq('business_id', ctx.businessId)
    .order('created_at', { ascending: false })
    .limit(Math.min(args.limit || 20, 50))

  if (args.status) query = query.eq('status', args.status)

  const { data, error } = await query
  if (error) return { success: false, error: 'Listelenemedi' }

  return {
    success: true,
    data: {
      toplam: (data || []).length,
      kampanyalar: (data || []).map((c: any) => ({
        id: c.id,
        ad: c.name,
        durum: c.status,
        kanal: c.channel,
        alici_sayisi: c.stats?.total_recipients ?? 0,
        gonderilen: c.stats?.sent ?? 0,
        olusturma: c.created_at,
      })),
    },
  }
}

async function estimateAudience(
  admin: SupabaseAdmin, businessId: string, filter: CampaignSegmentFilter,
): Promise<number> {
  let query = admin
    .from('customers')
    .select('id, last_visit_at, birthday, total_visits, total_revenue, created_at, phone')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .not('phone', 'is', null)

  if (filter.segments?.length) query = query.in('segment', filter.segments)

  const { data } = await query
  if (!data) return 0
  const now = new Date()
  return data.filter((c: any) => c.phone && matchesCampaignFilter(c, filter, now)).length
}

async function handleEstimateCampaignAudience(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  const filter = args as CampaignSegmentFilter
  const count = await estimateAudience(admin, ctx.businessId, filter)
  return { success: true, data: { count, filter } }
}

async function handleCreateCampaign(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  if (!args.name || !args.message_template) {
    return { success: false, error: 'Ad ve mesaj şablonu zorunludur' }
  }
  const filter = (args.segment_filter || {}) as CampaignSegmentFilter
  const audience = await estimateAudience(admin, ctx.businessId, filter)
  const scheduleNote = args.scheduled_at ? ` (${args.scheduled_at} tarihinde planlanacak)` : ''
  const preview = `📣 Kampanya: "${args.name}"${scheduleNote}\nHedef kitle: ~${audience} kişi\nMesaj: ${args.message_template}`

  return await createPendingAction(
    admin, ctx, 'create_campaign',
    {
      name: args.name,
      description: args.description,
      message_template: args.message_template,
      channel: args.channel || 'auto',
      scheduled_at: args.scheduled_at || null,
      segment_filter: filter,
    },
    preview,
    { name: args.name, audience },
  )
}

async function handleSendCampaign(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  const { data: camp } = await admin
    .from('campaigns')
    .select('id, name, status, segment_filter, message_template')
    .eq('id', args.campaign_id)
    .eq('business_id', ctx.businessId)
    .single()

  if (!camp) return { success: false, error: 'Kampanya bulunamadı' }
  if (!['draft', 'scheduled'].includes(camp.status)) {
    return { success: false, error: `Kampanya durumu uygun değil: ${camp.status}` }
  }

  const audience = await estimateAudience(admin, ctx.businessId, (camp.segment_filter || {}) as CampaignSegmentFilter)
  const preview = `🚀 "${camp.name}" kampanyası şimdi gönderilecek.\nHedef kitle: ~${audience} kişi\nMesaj: ${camp.message_template}`

  return await createPendingAction(
    admin, ctx, 'send_campaign',
    { campaign_id: camp.id },
    preview,
    { name: camp.name, audience },
  )
}

async function handleListWorkflows(admin: SupabaseAdmin, ctx: ToolCtx) {
  const { data, error } = await admin
    .from('workflows')
    .select('id, name, trigger_type, is_active, steps, created_at')
    .eq('business_id', ctx.businessId)
    .order('created_at', { ascending: false })

  if (error) return { success: false, error: 'Listelenemedi' }
  return {
    success: true,
    data: {
      toplam: (data || []).length,
      is_akislari: (data || []).map((w: any) => ({
        id: w.id,
        ad: w.name,
        tetikleyici: w.trigger_type,
        aktif: w.is_active,
        adim_sayisi: Array.isArray(w.steps) ? w.steps.length : 0,
      })),
    },
  }
}

async function handleCreateWorkflow(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  if (!args.name || !args.trigger_type || !Array.isArray(args.steps) || args.steps.length === 0) {
    return { success: false, error: 'Ad, tetikleyici türü ve en az bir adım zorunludur' }
  }
  if (!VALID_TRIGGERS.includes(args.trigger_type)) {
    return { success: false, error: 'Geçersiz tetikleyici türü' }
  }
  for (const step of args.steps) {
    if (typeof step.delay_hours !== 'number' || step.delay_hours < 0) {
      return { success: false, error: 'Her adımda geçerli bir bekleme süresi zorunludur' }
    }
    if (!step.message || typeof step.message !== 'string') {
      return { success: false, error: 'Her adımda mesaj zorunludur' }
    }
  }

  const stepsSummary = args.steps
    .map((s: any, i: number) => `  ${i + 1}. +${s.delay_hours}s → "${s.message.slice(0, 60)}${s.message.length > 60 ? '…' : ''}"`)
    .join('\n')
  const preview = `⚡ İş akışı: "${args.name}"\nTetikleyici: ${args.trigger_type}\nAdımlar:\n${stepsSummary}`

  return await createPendingAction(
    admin, ctx, 'create_workflow',
    { name: args.name, trigger_type: args.trigger_type, steps: args.steps },
    preview,
    { name: args.name, trigger_type: args.trigger_type },
  )
}

async function handleToggleWorkflow(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  const { data: wf } = await admin
    .from('workflows')
    .select('id, name, is_active')
    .eq('id', args.workflow_id)
    .eq('business_id', ctx.businessId)
    .single()

  if (!wf) return { success: false, error: 'İş akışı bulunamadı' }

  const preview = `${args.is_active ? '✓ Aktifleştir' : '⏸ Pasifleştir'}: "${wf.name}"`
  return await createPendingAction(
    admin, ctx, 'toggle_workflow',
    { workflow_id: wf.id, is_active: !!args.is_active },
    preview,
    { name: wf.name, is_active: !!args.is_active },
  )
}

// ── Faz 7: Sistem Yönetimi Handlers ──────────────────────────────────

const VALID_DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function validateHHMM(s: any): s is string {
  return typeof s === 'string' && HHMM_RE.test(s)
}

async function handleUpdateWorkingHours(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  if (!Array.isArray(args.days) || args.days.length === 0) {
    return { success: false, error: 'En az bir gün belirtin' }
  }

  const { data: biz } = await admin
    .from('businesses').select('working_hours').eq('id', ctx.businessId).single()

  const current = (biz?.working_hours || {}) as Record<string, any>
  const next = { ...current }
  const summary: string[] = []

  for (const d of args.days) {
    if (!VALID_DAY_KEYS.includes(d.day)) {
      return { success: false, error: `Geçersiz gün: ${d.day}` }
    }
    if (d.closed) {
      next[d.day] = null
      summary.push(`${DAY_NAMES[d.day]}: Kapalı`)
    } else {
      if (!validateHHMM(d.open) || !validateHHMM(d.close)) {
        return { success: false, error: `${DAY_NAMES[d.day]} için HH:MM formatında saat gerekli` }
      }
      next[d.day] = { open: d.open, close: d.close }
      summary.push(`${DAY_NAMES[d.day]}: ${d.open} - ${d.close}`)
    }
  }

  const preview = `🕑 Çalışma saatleri güncellenecek:\n${summary.join('\n')}`
  return await createPendingAction(
    admin, ctx, 'update_working_hours',
    { working_hours: next },
    preview,
    { changes: summary },
  )
}

async function handleListBlockedSlots(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  const today = new Date().toISOString().split('T')[0]
  const from = args.from || today
  const to = args.to || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

  const { data, error } = await admin
    .from('blocked_slots')
    .select('id, date, start_time, end_time, reason, staff_id, room_id')
    .eq('business_id', ctx.businessId)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })

  if (error) return { success: false, error: 'Listelenemedi' }
  return {
    success: true,
    data: {
      toplam: (data || []).length,
      bloklar: (data || []).map((b: any) => ({
        id: b.id,
        tarih: b.date,
        saat: `${b.start_time?.slice(0, 5)} - ${b.end_time?.slice(0, 5)}`,
        sebep: b.reason || '-',
        personel_id: b.staff_id,
      })),
    },
  }
}

async function handleCreateBlockedSlot(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  if (!args.date || !validateHHMM(args.start_time) || !validateHHMM(args.end_time)) {
    return { success: false, error: 'Tarih ve HH:MM formatında başlangıç/bitiş saati zorunludur' }
  }
  if (args.start_time >= args.end_time) {
    return { success: false, error: 'Bitiş saati başlangıçtan sonra olmalı' }
  }

  let staffLabel = 'Tüm personel'
  if (args.staff_id) {
    const { data: staff } = await admin
      .from('staff_members').select('name').eq('id', args.staff_id).eq('business_id', ctx.businessId).single()
    if (!staff) return { success: false, error: 'Personel bulunamadı' }
    staffLabel = staff.name
  }

  const preview = `🚫 ${args.date} ${args.start_time}-${args.end_time} blokları\nKapsam: ${staffLabel}${args.reason ? `\nSebep: ${args.reason}` : ''}`
  return await createPendingAction(
    admin, ctx, 'create_blocked_slot',
    {
      date: args.date,
      start_time: args.start_time,
      end_time: args.end_time,
      staff_id: args.staff_id || null,
      reason: args.reason || null,
    },
    preview,
    { date: args.date },
  )
}

async function handleDeleteBlockedSlot(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  const { data: slot } = await admin
    .from('blocked_slots')
    .select('id, date, start_time, end_time, reason')
    .eq('id', args.blocked_slot_id)
    .eq('business_id', ctx.businessId)
    .single()

  if (!slot) return { success: false, error: 'Blok bulunamadı' }

  const preview = `♻️ Blok kaldırılacak: ${slot.date} ${slot.start_time?.slice(0, 5)}-${slot.end_time?.slice(0, 5)}${slot.reason ? ` (${slot.reason})` : ''}`
  return await createPendingAction(
    admin, ctx, 'delete_blocked_slot',
    { blocked_slot_id: slot.id },
    preview,
  )
}

async function handleListShifts(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  const weekStart = args.week_start || new Date().toISOString().split('T')[0]
  const weekEnd = args.week_end || new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0]

  const { data, error } = await admin
    .from('shifts')
    .select('id, staff_id, shift_date, start_time, end_time, shift_type, notes, staff_members(name)')
    .eq('business_id', ctx.businessId)
    .gte('shift_date', weekStart)
    .lte('shift_date', weekEnd)
    .order('shift_date', { ascending: true })

  if (error) return { success: false, error: 'Listelenemedi' }
  return {
    success: true,
    data: {
      toplam: (data || []).length,
      vardiyalar: (data || []).map((s: any) => ({
        id: s.id,
        personel: s.staff_members?.name,
        tarih: s.shift_date,
        saat: s.shift_type === 'off' ? 'İzinli' : `${s.start_time?.slice(0, 5)} - ${s.end_time?.slice(0, 5)}`,
        tip: s.shift_type,
        not: s.notes,
      })),
    },
  }
}

async function handleAssignShift(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  if (!args.staff_id || !args.shift_date) {
    return { success: false, error: 'Personel ve tarih zorunludur' }
  }
  if (!['regular', 'off'].includes(args.shift_type)) {
    return { success: false, error: 'Geçersiz vardiya türü' }
  }
  if (args.shift_type === 'regular') {
    if (!validateHHMM(args.start_time) || !validateHHMM(args.end_time)) {
      return { success: false, error: 'Düzenli vardiya için HH:MM formatında başlangıç/bitiş zorunludur' }
    }
    if (args.start_time >= args.end_time) {
      return { success: false, error: 'Bitiş saati başlangıçtan sonra olmalı' }
    }
  }

  const { data: staff } = await admin
    .from('staff_members').select('name').eq('id', args.staff_id).eq('business_id', ctx.businessId).single()
  if (!staff) return { success: false, error: 'Personel bulunamadı' }

  const timeStr = args.shift_type === 'off' ? 'İzinli' : `${args.start_time}-${args.end_time}`
  const preview = `📅 ${staff.name} — ${args.shift_date} — ${timeStr}${args.notes ? `\nNot: ${args.notes}` : ''}`
  return await createPendingAction(
    admin, ctx, 'assign_shift',
    {
      staff_id: args.staff_id,
      shift_date: args.shift_date,
      shift_type: args.shift_type,
      start_time: args.shift_type === 'regular' ? args.start_time : null,
      end_time: args.shift_type === 'regular' ? args.end_time : null,
      notes: args.notes || null,
    },
    preview,
    { staff_name: staff.name },
  )
}

async function handleCreateShiftDefinition(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  if (!args.name || !validateHHMM(args.start) || !validateHHMM(args.end)) {
    return { success: false, error: 'Ad ve HH:MM formatında başlangıç/bitiş zorunludur' }
  }
  if (args.start >= args.end) {
    return { success: false, error: 'Bitiş saati başlangıçtan sonra olmalı' }
  }

  const preview = `⚙️ Mesai tanımı eklenecek: "${args.name}" — ${args.start}-${args.end}`
  return await createPendingAction(
    admin, ctx, 'create_shift_definition',
    { name: args.name, start: args.start, end: args.end },
    preview,
  )
}

async function handleInviteStaff(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  if (ctx.role !== 'owner') {
    return { success: false, error: 'Sadece işletme sahibi davet oluşturabilir' }
  }
  const role = args.role || 'staff'
  if (!['staff', 'manager'].includes(role)) {
    return { success: false, error: 'Geçersiz rol (staff veya manager olmalı)' }
  }

  const preview = `👥 Davet linki oluşturulacak\nRol: ${role}${args.email ? `\nE-posta: ${args.email}` : ''}`
  return await createPendingAction(
    admin, ctx, 'invite_staff',
    { email: args.email || null, role },
    preview,
    { role },
  )
}

async function handleUpdateStaffPermissions(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  if (ctx.role !== 'owner') {
    return { success: false, error: 'Sadece işletme sahibi yetki değiştirebilir' }
  }
  if (!args.staff_id || !args.permissions || typeof args.permissions !== 'object') {
    return { success: false, error: 'Personel ID ve permissions objesi zorunludur' }
  }

  const { data: target } = await admin
    .from('staff_members')
    .select('id, name, role, permissions')
    .eq('id', args.staff_id)
    .eq('business_id', ctx.businessId)
    .single()

  if (!target) return { success: false, error: 'Personel bulunamadı' }
  if (target.role === 'owner') return { success: false, error: 'Sahibin yetkileri değiştirilemez' }

  const changes = Object.entries(args.permissions)
    .map(([k, v]) => `${k}: ${v ? 'açık' : 'kapalı'}`)
    .join(', ')
  const preview = `🔒 ${target.name} yetkileri güncellenecek\n${changes}`

  return await createPendingAction(
    admin, ctx, 'update_staff_permissions',
    { staff_id: target.id, permissions: args.permissions, current: target.permissions || {} },
    preview,
    { staff_name: target.name },
  )
}

async function handleUpdateBusinessSettings(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  if (!args.settings || typeof args.settings !== 'object' || Object.keys(args.settings).length === 0) {
    return { success: false, error: 'Güncellenecek en az bir ayar belirtin' }
  }

  const changes = Object.entries(args.settings)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n')
  const preview = `⚙️ İşletme ayarları güncellenecek:\n${changes}`

  return await createPendingAction(
    admin, ctx, 'update_business_settings',
    { settings: args.settings },
    preview,
  )
}

// ─── Faz 8: Finans (Fatura, Ödeme, POS, Gider, Gelir) ─────────────────

async function handleListUnpaidInvoices(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  const limit = Math.min(args.limit || 20, 50)
  let query = admin
    .from('invoices')
    .select('id, invoice_number, customer_id, total, paid_amount, status, due_date, created_at, customers(name)')
    .eq('business_id', ctx.businessId)
    .is('deleted_at', null)
    .in('status', ['pending', 'partial', 'overdue'])
    .order('created_at', { ascending: false })
    .limit(limit)

  if (args.customer_id) query = query.eq('customer_id', args.customer_id)

  const { data, error } = await query
  if (error) return { success: false, error: 'Faturalar alınamadı' }

  const rows = (data || []).map((inv: any) => ({
    id: inv.id,
    fatura_no: inv.invoice_number,
    musteri: inv.customers?.name || '—',
    toplam: inv.total,
    odenen: inv.paid_amount || 0,
    kalan: Math.max(0, (inv.total || 0) - (inv.paid_amount || 0)),
    durum: inv.status,
    vade: inv.due_date,
  }))

  return {
    success: true,
    data: {
      toplam: rows.length,
      toplam_bakiye: round2(rows.reduce((s, r) => s + r.kalan, 0)),
      faturalar: rows,
    },
  }
}

function normalizeInvoiceItems(rawItems: any[]): {
  items: Array<{ service_name: string; quantity: number; unit_price: number; total: number; type?: string; product_id?: string }>
  subtotal: number
} {
  const items = rawItems.map((it: any) => {
    const quantity = Number(it.quantity) || 1
    const unit_price = Number(it.unit_price) || 0
    const total = round2(quantity * unit_price)
    return {
      service_name: String(it.service_name || ''),
      quantity,
      unit_price,
      total,
      ...(it.type ? { type: it.type } : {}),
      ...(it.product_id ? { product_id: it.product_id } : {}),
    }
  })
  const subtotal = round2(items.reduce((s, it) => s + it.total, 0))
  return { items, subtotal }
}

async function handleCreateInvoice(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  if (!args.customer_id) return { success: false, error: 'Müşteri zorunlu' }
  if (!Array.isArray(args.items) || args.items.length === 0) {
    return { success: false, error: 'En az bir fatura kalemi gerekli' }
  }

  const { data: cust } = await admin
    .from('customers')
    .select('name')
    .eq('id', args.customer_id)
    .eq('business_id', ctx.businessId)
    .single()
  if (!cust) return { success: false, error: 'Müşteri bulunamadı' }

  const { items, subtotal } = normalizeInvoiceItems(args.items)
  const taxRate = Number(args.tax_rate) || 0
  const discountInput = Number(args.discount_amount) || 0
  const discountValue = args.discount_type === 'percentage'
    ? round2(subtotal * discountInput / 100)
    : discountInput
  const taxableAmount = subtotal - discountValue
  const taxAmount = round2(taxableAmount * taxRate / 100)
  const total = round2(taxableAmount + taxAmount)

  const itemsList = items.slice(0, 5).map(i => `• ${i.service_name} x${i.quantity} = ${i.total}₺`).join('\n')
  const more = items.length > 5 ? `\n… ve ${items.length - 5} kalem daha` : ''
  const preview = `🧾 Fatura oluşturulacak — ${cust.name}\n${itemsList}${more}\nAra toplam: ${subtotal}₺${discountValue ? `\nİndirim: -${discountValue}₺` : ''}${taxAmount ? `\nKDV: ${taxAmount}₺` : ''}\n**Toplam: ${total}₺**`

  return await createPendingAction(
    admin, ctx, 'create_invoice',
    {
      customer_id: args.customer_id,
      items,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      discount_amount: discountValue,
      discount_type: args.discount_type || null,
      total,
      due_date: args.due_date || null,
      notes: args.notes || null,
    },
    preview,
    { customer: cust.name, total },
  )
}

async function handleRecordInvoicePayment(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  if (!args.invoice_id) return { success: false, error: 'Fatura zorunlu' }
  const amount = Number(args.amount)
  if (!amount || amount <= 0) return { success: false, error: 'Tutar geçersiz' }
  if (!args.method) return { success: false, error: 'Ödeme yöntemi zorunlu' }

  const { data: inv } = await admin
    .from('invoices')
    .select('id, invoice_number, total, paid_amount, status, customers(name)')
    .eq('id', args.invoice_id)
    .eq('business_id', ctx.businessId)
    .is('deleted_at', null)
    .single()

  if (!inv) return { success: false, error: 'Fatura bulunamadı' }
  const remaining = Math.max(0, (inv.total || 0) - (inv.paid_amount || 0))
  const paymentType = args.payment_type || 'payment'
  if (paymentType !== 'refund' && amount > remaining + 0.01) {
    return { success: false, error: `Ödeme tutarı kalan bakiyeyi (${remaining}₺) aşıyor` }
  }

  const custName = (inv as any).customers?.name || '—'
  const preview = `💰 Fatura ödemesi — ${(inv as any).invoice_number} (${custName})\n${args.method.toUpperCase()} • ${amount}₺${paymentType !== 'payment' ? ` (${paymentType})` : ''}\nKalan: ${remaining}₺ → ${Math.max(0, remaining - amount)}₺`

  return await createPendingAction(
    admin, ctx, 'record_invoice_payment',
    {
      invoice_id: args.invoice_id,
      amount,
      method: args.method,
      payment_type: paymentType,
      installment_number: args.installment_number || null,
      notes: args.notes || null,
    },
    preview,
    { invoice_number: (inv as any).invoice_number, amount },
  )
}

async function handleGenerateInvoiceFromAppointment(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  if (!args.appointment_id) return { success: false, error: 'Randevu zorunlu' }

  const { data: apt } = await admin
    .from('appointments')
    .select('id, customer_id, status, appointment_date, customers(name), services(name, price)')
    .eq('id', args.appointment_id)
    .eq('business_id', ctx.businessId)
    .is('deleted_at', null)
    .single()

  if (!apt) return { success: false, error: 'Randevu bulunamadı' }
  const service = (apt as any).services
  const customer = (apt as any).customers
  if (!service?.price) return { success: false, error: 'Hizmet fiyatı tanımlı değil, elle fatura oluşturun' }
  if (!apt.customer_id) return { success: false, error: 'Randevuda müşteri yok' }

  const items = [{
    service_name: service.name,
    quantity: 1,
    unit_price: service.price,
    total: service.price,
    type: 'service',
  }]
  const taxRate = Number(args.tax_rate) || 0
  const subtotal = service.price
  const taxAmount = round2(subtotal * taxRate / 100)
  const total = round2(subtotal + taxAmount)

  const preview = `🧾 Randevudan fatura — ${customer?.name || '—'}\n• ${service.name} = ${service.price}₺${taxAmount ? `\nKDV: ${taxAmount}₺` : ''}\n**Toplam: ${total}₺**`

  return await createPendingAction(
    admin, ctx, 'generate_invoice_from_appointment',
    {
      appointment_id: args.appointment_id,
      customer_id: apt.customer_id,
      items,
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
    },
    preview,
    { customer: customer?.name, total },
  )
}

async function handleCreatePosTransaction(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  if (!Array.isArray(args.items) || args.items.length === 0) {
    return { success: false, error: 'En az bir kalem gerekli' }
  }
  if (!args.payment_method) return { success: false, error: 'Ödeme yöntemi zorunlu' }

  const items = args.items.map((it: any) => {
    const qty = Number(it.qty) || 1
    const unit_price = Number(it.price) || 0
    const total = round2(qty * unit_price)
    return { name: String(it.name || ''), quantity: qty, unit_price, total }
  })
  const subtotal = round2(items.reduce((s: number, it: any) => s + it.total, 0))
  const discount = Number(args.discount_amount) || 0
  const total = round2(subtotal - discount)

  let customerName = '—'
  if (args.customer_id) {
    const { data: c } = await admin
      .from('customers')
      .select('name')
      .eq('id', args.customer_id)
      .eq('business_id', ctx.businessId)
      .single()
    customerName = c?.name || '—'
  }

  const itemsList = items.slice(0, 4).map((i: any) => `• ${i.name} x${i.quantity} = ${i.total}₺`).join('\n')
  const more = items.length > 4 ? `\n… ve ${items.length - 4} kalem daha` : ''
  const preview = `🛒 POS satışı — ${customerName}\n${itemsList}${more}${discount ? `\nİndirim: -${discount}₺` : ''}\n${args.payment_method.toUpperCase()} • **Toplam: ${total}₺**`

  return await createPendingAction(
    admin, ctx, 'create_pos_transaction',
    {
      customer_id: args.customer_id || null,
      items,
      subtotal,
      discount_amount: discount,
      total,
      payment_method: args.payment_method,
      notes: args.notes || null,
    },
    preview,
    { customer: customerName, total },
  )
}

async function handleLedgerEntry(
  admin: SupabaseAdmin,
  ctx: ToolCtx,
  args: Record<string, any>,
  kind: 'expense' | 'income',
) {
  const amount = Number(args.amount)
  if (!args.category) return { success: false, error: 'Kategori zorunlu' }
  if (!amount || amount <= 0) return { success: false, error: 'Tutar geçersiz' }

  const today = new Date().toISOString().slice(0, 10)
  const date = (kind === 'expense' ? args.expense_date : args.income_date) || today
  const recurring = args.is_recurring ? `\n🔁 Tekrar: ${args.recurring_period || '—'}` : ''
  const label = kind === 'expense' ? '💸 Gider kaydı' : '💵 Gelir kaydı'
  const preview = `${label} — ${args.category}\nTutar: ${amount}₺ • Tarih: ${date}${args.description ? `\n${args.description}` : ''}${recurring}`

  return await createPendingAction(
    admin, ctx,
    kind === 'expense' ? 'record_expense' : 'record_manual_income',
    {
      category: args.category,
      amount,
      date,
      description: args.description || null,
      is_recurring: !!args.is_recurring,
      recurring_period: args.recurring_period || null,
      custom_interval_days: args.custom_interval_days || null,
    },
    preview,
    { category: args.category, amount },
  )
}

async function handleRecordExpense(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  return handleLedgerEntry(admin, ctx, args, 'expense')
}

async function handleRecordManualIncome(
  admin: SupabaseAdmin, ctx: ToolCtx, args: Record<string, any>,
) {
  return handleLedgerEntry(admin, ctx, args, 'income')
}
