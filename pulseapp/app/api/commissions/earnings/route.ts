import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH — Kazanç kaydını güncelle (status toggle paid/pending, notes)
export async function PATCH(request: NextRequest) {
  const auth = await requirePermission(request, 'settings')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const body = await request.json()
  const { id, status, notes } = body

  if (!id) return NextResponse.json({ error: 'id zorunludur' }, { status: 400 })
  if (status && !['pending', 'paid'].includes(status)) {
    return NextResponse.json({ error: 'Geçersiz durum' }, { status: 400 })
  }

  const admin = createAdminClient()

  const updateData: Record<string, unknown> = {}
  if (status !== undefined) {
    updateData.status = status
    updateData.paid_at = status === 'paid' ? new Date().toISOString() : null
  }
  if (notes !== undefined) updateData.notes = notes

  const { data, error } = await admin
    .from('commission_earnings')
    .update(updateData)
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ earning: data })
}

// GET — Belirli bir dönem veya personel için kazançları getir
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'settings')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period')
  const staffId = searchParams.get('staffId')

  const admin = createAdminClient()

  let query = admin
    .from('commission_earnings')
    .select('*, staff_members(id, name)')
    .eq('business_id', businessId)

  if (period) query = query.eq('period', period)
  if (staffId) query = query.eq('staff_id', staffId)

  const { data, error } = await query.order('period', { ascending: false }).order('commission_total', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ earnings: data || [] })
}
