import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/api/with-permission'

// GET: Protokol listesi
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'protocols')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get('customerId')
  const status = searchParams.get('status')

  const admin = createAdminClient()
  let query = admin
    .from('treatment_protocols')
    .select(`
      *,
      customer:customers(id, name, phone),
      service:services(id, name),
      staff:staff_members!treatment_protocols_created_by_fkey(id, name),
      sessions:protocol_sessions(*)
    `)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (customerId) query = query.eq('customer_id', customerId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ protocols: data })
}

// POST: Yeni protokol oluştur
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'protocols')
  if (!auth.ok) return auth.response
  const { businessId, staffId } = auth.ctx

  const body = await request.json()
  const { customerId, serviceId, name, totalSessions, intervalDays, notes } = body

  if (!customerId || !name || !totalSessions) {
    return NextResponse.json({ error: 'customerId, name, totalSessions zorunlu' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Protokolü oluştur
  const { data: protocol, error: protocolError } = await admin
    .from('treatment_protocols')
    .insert({
      business_id: businessId,
      customer_id: customerId,
      service_id: serviceId || null,
      name,
      total_sessions: totalSessions,
      interval_days: intervalDays || 14,
      notes: notes || null,
      created_by: staffId,
    })
    .select()
    .single()

  if (protocolError) return NextResponse.json({ error: protocolError.message }, { status: 500 })

  // Seansları otomatik oluştur (planned_date hesapla)
  const sessions = []
  const startDate = new Date()
  for (let i = 1; i <= totalSessions; i++) {
    const plannedDate = new Date(startDate)
    plannedDate.setDate(plannedDate.getDate() + (i - 1) * (intervalDays || 14))
    sessions.push({
      protocol_id: protocol.id,
      business_id: businessId,
      session_number: i,
      planned_date: plannedDate.toISOString().split('T')[0],
      status: 'planned',
    })
  }

  const { error: sessionsError } = await admin
    .from('protocol_sessions')
    .insert(sessions)

  if (sessionsError) {
    // Protokolü geri sil
    await admin.from('treatment_protocols').delete().eq('id', protocol.id)
    return NextResponse.json({ error: sessionsError.message }, { status: 500 })
  }

  // Oluşturulan protokolü seanslarıyla birlikte getir
  const { data: fullProtocol } = await admin
    .from('treatment_protocols')
    .select(`
      *,
      customer:customers(id, name, phone),
      service:services(id, name),
      sessions:protocol_sessions(*)
    `)
    .eq('id', protocol.id)
    .single()

  return NextResponse.json({ protocol: fullProtocol }, { status: 201 })
}
