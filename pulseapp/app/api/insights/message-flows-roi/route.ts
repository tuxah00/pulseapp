import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDateRange } from '@/lib/insights/date-range'
import { generateInsight } from '@/lib/insights/generate'
import type { MessageFlowItem } from '@/lib/insights/templates'
import { TEMPLATE_META } from '@/lib/whatsapp/templates'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/insights/message-flows-roi' })

/**
 * GET /api/insights/message-flows-roi?businessId=&days=30
 *
 * Otomatik mesaj akışlarının (hatırlatma, doğum günü, winback, yorum isteği vb.)
 * ROI ölçümü. `messages.template_name` ile gruplanır; attribution için
 * `related_appointment_id` kullanılır. Migration henüz uygulanmadıysa
 * attribution 0 kalır — panel bunun şablonu var.
 */
function labelFor(templateName: string): string {
  const known = TEMPLATE_META[templateName as keyof typeof TEMPLATE_META]
  if (known) return known.label
  // Snake_case → Baş Harf Büyük
  return templateName
    .split(/[_\-\s]+/)
    .map((w) => w.charAt(0).toLocaleUpperCase('tr-TR') + w.slice(1))
    .join(' ')
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const range = resolveDateRange(searchParams)
  const admin = createAdminClient()

  try {
    const messagesRes = await admin
      .from('messages')
      .select('id, template_name, created_at, direction')
      .eq('business_id', businessId)
      .eq('direction', 'outbound')
      .not('template_name', 'is', null)
      .gte('created_at', range.fromIso)
      .lte('created_at', range.toIso)

    if (messagesRes.error) throw messagesRes.error

    type Bucket = {
      template_name: string
      sentCount: number
      attributedAppointments: number
      attributedRevenue: number
      attributedAppointmentIds: string[]
    }
    const buckets = new Map<string, Bucket>()

    for (const m of messagesRes.data ?? []) {
      const tn = (m as { template_name?: string }).template_name
      if (!tn) continue
      const b = buckets.get(tn) ?? {
        template_name: tn,
        sentCount: 0,
        attributedAppointments: 0,
        attributedRevenue: 0,
        attributedAppointmentIds: [],
      }
      b.sentCount += 1
      buckets.set(tn, b)
    }

    // Attribution: related_appointment_id → gerçekleşmiş randevular.
    try {
      const attMsgsRes = await admin
        .from('messages')
        .select('template_name, related_appointment_id, created_at')
        .eq('business_id', businessId)
        .eq('direction', 'outbound')
        .not('template_name', 'is', null)
        .not('related_appointment_id', 'is', null)
        .gte('created_at', range.fromIso)
        .lte('created_at', range.toIso)

      if (attMsgsRes.error) throw attMsgsRes.error

      const appointmentIds: string[] = []
      for (const row of attMsgsRes.data ?? []) {
        const aptId = (row as { related_appointment_id?: string }).related_appointment_id
        if (aptId) appointmentIds.push(aptId)
      }

      if (appointmentIds.length > 0) {
        const aptRes = await admin
          .from('appointments')
          .select('id, status')
          .in('id', appointmentIds)
          .is('deleted_at', null)
          .in('status', ['completed', 'confirmed'])

        if (aptRes.error) throw aptRes.error
        const validAppointments = new Set<string>(
          (aptRes.data ?? []).map((a) => a.id as string),
        )

        const validAppointmentIds: string[] = []
        for (const row of attMsgsRes.data ?? []) {
          const tn = (row as { template_name?: string }).template_name
          const aptId = (row as { related_appointment_id?: string }).related_appointment_id
          if (!tn || !aptId || !validAppointments.has(aptId)) continue
          const b = buckets.get(tn)
          if (!b) continue
          b.attributedAppointments += 1
          b.attributedAppointmentIds.push(aptId)
          validAppointmentIds.push(aptId)
        }

        if (validAppointmentIds.length > 0) {
          const invRes = await admin
            .from('invoices')
            .select('appointment_id, paid_amount, total')
            .in('appointment_id', validAppointmentIds)
            .is('deleted_at', null)
            .in('status', ['paid', 'partial'])

          if (invRes.error) throw invRes.error

          const aptRevenue = new Map<string, number>()
          for (const inv of invRes.data ?? []) {
            const aptId = inv.appointment_id as string | null
            if (!aptId) continue
            const amount = Number(inv.paid_amount ?? inv.total ?? 0)
            if (!Number.isFinite(amount) || amount <= 0) continue
            aptRevenue.set(aptId, (aptRevenue.get(aptId) ?? 0) + amount)
          }
          for (const b of buckets.values()) {
            for (const aptId of b.attributedAppointmentIds) {
              b.attributedRevenue += aptRevenue.get(aptId) ?? 0
            }
          }
        }
      }
    } catch (err) {
      log.warn({ err: String(err) }, 'related_appointment_id attribution unavailable')
      // Attribution kolonu yoksa zaten 0 kalacak.
    }

    const flows: MessageFlowItem[] = Array.from(buckets.values())
      .map((b) => ({
        template_name: b.template_name,
        label: labelFor(b.template_name),
        sentCount: b.sentCount,
        attributedAppointments: b.attributedAppointments,
        attributedRevenue: Math.round(b.attributedRevenue),
        conversionRate:
          b.sentCount > 0 ? b.attributedAppointments / b.sentCount : 0,
      }))
      .sort((a, b) => b.attributedRevenue - a.attributedRevenue || b.sentCount - a.sentCount)

    const totals = flows.reduce(
      (s, f) => ({
        sent: s.sent + f.sentCount,
        appointments: s.appointments + f.attributedAppointments,
        revenue: s.revenue + f.attributedRevenue,
      }),
      { sent: 0, appointments: 0, revenue: 0 }
    )
    const insight = generateInsight('message', { flows })

    return NextResponse.json({
      range: { from: range.from, to: range.to, days: range.days },
      totals,
      flows,
      insight,
    })
  } catch (err) {
    log.error({ err, businessId }, 'message-flows-roi error')
    return NextResponse.json(
      { error: 'Mesaj akışı ROI hesaplanamadı' },
      { status: 500 },
    )
  }
}
