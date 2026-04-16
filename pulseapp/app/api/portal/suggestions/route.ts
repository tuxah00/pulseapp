import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'

export interface PortalSuggestion {
  kind: 'recheck' | 'follow_up' | 'package_complete' | 'protocol_next'
  title: string
  subtitle: string
  priority: number // yüksek öncelik = yukarı
  meta?: Record<string, any>
}

/**
 * Akıllı öneriler — kural tabanlı kontrol önerileri + follow_up_queue birleşik.
 * Hedef: müşteri kendi isteğiyle geri dönmesi için somut sebepler sun.
 */
export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const admin = createAdminClient()
  const suggestions: PortalSuggestion[] = []

  const today = new Date()
  const todayIso = today.toISOString().split('T')[0]

  // 1) Follow-up queue — doktor/personel tarafından planlanmış kontroller
  try {
    const { data: followUps } = await admin
      .from('follow_up_queue')
      .select('id, type, scheduled_for, message, protocol_id')
      .eq('business_id', businessId)
      .eq('customer_id', customerId)
      .eq('status', 'pending')
      .order('scheduled_for', { ascending: true })
      .limit(5)

    for (const f of followUps || []) {
      const d = new Date(f.scheduled_for)
      const days = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      const subtitle = days <= 0
        ? 'Bugün için planlanmış kontrol'
        : days <= 7
        ? `${days} gün içinde kontrol önerildi`
        : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) + ' için planlandı'

      const typeLabel: Record<string, string> = {
        post_session: 'Seans Sonrası Kontrol',
        next_session_reminder: 'Sonraki Seans',
        protocol_completion: 'Protokol Tamamlama',
      }

      suggestions.push({
        kind: 'follow_up',
        title: typeLabel[f.type] || 'Kontrol Önerildi',
        subtitle: f.message || subtitle,
        priority: days <= 0 ? 100 : days <= 7 ? 90 : 60,
        meta: { scheduled_for: f.scheduled_for, type: f.type },
      })
    }
  } catch (e) {
    // tablo yoksa veya hata — sessizce atla
  }

  // 2) Kural tabanlı: services.recommended_interval_days
  // Her hizmet için bu müşterinin son tamamlanan randevusunu bul; aralık geçmişse öneri üret.
  try {
    const { data: completedAppts } = await admin
      .from('appointments')
      .select('id, appointment_date, service_id, services(id, name, recommended_interval_days)')
      .eq('business_id', businessId)
      .eq('customer_id', customerId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .not('service_id', 'is', null)
      .order('appointment_date', { ascending: false })
      .limit(50)

    // Hizmet bazında son tarih eşlemesi
    const lastByService: Record<string, { date: string; name: string; intervalDays: number }> = {}
    for (const apt of completedAppts || []) {
      const svc: any = Array.isArray(apt.services) ? apt.services[0] : apt.services
      if (!svc || !svc.recommended_interval_days || svc.recommended_interval_days <= 0) continue
      const key = svc.id
      if (lastByService[key]) continue // zaten sonuncu alındı (order desc)
      lastByService[key] = {
        date: apt.appointment_date,
        name: svc.name,
        intervalDays: svc.recommended_interval_days,
      }
    }

    for (const [, info] of Object.entries(lastByService)) {
      const last = new Date(info.date + 'T00:00:00')
      const daysSince = Math.round((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24))
      if (daysSince >= info.intervalDays) {
        const overdue = daysSince - info.intervalDays
        suggestions.push({
          kind: 'recheck',
          title: `${info.name} için zaman geldi`,
          subtitle: overdue > 0
            ? `Son ziyaretinden ${daysSince} gün geçti · önerilen aralık ${info.intervalDays} gün`
            : `Son ziyaretinden ${daysSince} gün geçti`,
          priority: Math.min(80, 40 + Math.round(overdue / 7) * 10),
          meta: { serviceName: info.name, daysSince, intervalDays: info.intervalDays },
        })
      }
    }
  } catch (e) {
    // sessizce atla
  }

  // 3) Paket tamamlandı — yeni paket veya randevu çağrısı
  try {
    const { data: packages } = await admin
      .from('customer_packages')
      .select('id, package_name, sessions_total, sessions_used, status')
      .eq('business_id', businessId)
      .eq('customer_id', customerId)
      .order('purchase_date', { ascending: false })
      .limit(10)

    for (const pkg of packages || []) {
      if (pkg.status === 'active' && pkg.sessions_used >= pkg.sessions_total) {
        suggestions.push({
          kind: 'package_complete',
          title: `${pkg.package_name} paketin tamamlandı`,
          subtitle: 'Devam etmek ister misin? Yeni paket için görüşelim.',
          priority: 70,
          meta: { packageId: pkg.id },
        })
      }
    }
  } catch (e) {
    // sessizce atla
  }

  // 4) Aktif protokolde sonraki seans — protocol_sessions planned
  try {
    const { data: nextSessions } = await admin
      .from('protocol_sessions')
      .select('id, session_number, planned_date, status, protocol:treatment_protocols(id, name, customer_id, business_id, status)')
      .eq('status', 'planned')
      .order('planned_date', { ascending: true })
      .limit(20)

    for (const s of nextSessions || []) {
      const p: any = Array.isArray(s.protocol) ? s.protocol[0] : s.protocol
      if (!p || p.business_id !== businessId || p.customer_id !== customerId || p.status !== 'active') continue
      if (!s.planned_date) continue
      const plan = new Date(s.planned_date + 'T00:00:00')
      const days = Math.round((plan.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      if (days < -1 || days > 14) continue // çok geçmiş veya çok uzak olanları atla
      suggestions.push({
        kind: 'protocol_next',
        title: `${p.name} — ${s.session_number}. seans`,
        subtitle: days <= 0
          ? 'Planlanan seans bugün'
          : days === 1
          ? 'Yarın için planlandı'
          : `${days} gün içinde planlandı`,
        priority: days <= 1 ? 85 : 55,
        meta: { protocolId: p.id, sessionNumber: s.session_number },
      })
      // sadece en yakın olanı al, tekrar etmesin
      break
    }
  } catch (e) {
    // sessizce atla
  }

  // Önceliğe göre sırala — yüksek öncelik üstte
  suggestions.sort((a, b) => b.priority - a.priority)

  // En fazla 5 öneri göster
  const top = suggestions.slice(0, 5)

  // Milestone — kutlama bilgisi (kontrol önerileriyle birlikte döner)
  const milestones: Array<{ kind: string; title: string; subtitle: string }> = []
  try {
    const { data: customer } = await admin
      .from('customers')
      .select('total_visits, birthday, name')
      .eq('id', customerId)
      .eq('business_id', businessId)
      .single()

    if (customer) {
      // 5., 10., 20., 50., 100. ziyaret kutlaması
      const visits = customer.total_visits || 0
      const milestonePoints = [5, 10, 20, 50, 100]
      if (milestonePoints.includes(visits)) {
        milestones.push({
          kind: 'visit',
          title: `🎉 ${visits}. ziyaretini kutluyoruz`,
          subtitle: 'Sadakatin için teşekkürler — seni ağırlamak bizim için bir keyif.',
        })
      }
      // Doğum günü — MM-DD eşleşmesi
      if (customer.birthday) {
        const bd = String(customer.birthday).slice(5, 10)
        const tdStr = todayIso.slice(5, 10)
        if (bd === tdStr) {
          milestones.push({
            kind: 'birthday',
            title: '🎂 Doğum günün kutlu olsun!',
            subtitle: 'Bugünü özel kılalım — küçük bir sürpriz için bizi arayabilirsin.',
          })
        }
      }
    }
  } catch (e) {
    // sessizce atla
  }

  return NextResponse.json({ suggestions: top, milestones })
}
