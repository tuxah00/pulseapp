import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — Prim kurallarını listele (personel + hizmet adları ile birlikte)
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'settings')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('commission_rules')
    .select(`
      id,
      staff_id,
      service_id,
      rate_percent,
      rate_fixed,
      created_at,
      staff_members(id, name),
      services(id, name)
    `)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ rules: data || [] })
}

// POST — Yeni kural ekle
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'settings')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const body = await request.json()
  const { staffId, serviceId, ratePercent, rateFixed } = body

  if (!ratePercent && !rateFixed) {
    return NextResponse.json({ error: 'Yüzde oranı veya sabit tutar zorunludur' }, { status: 400 })
  }
  if (ratePercent && (ratePercent <= 0 || ratePercent > 100)) {
    return NextResponse.json({ error: 'Yüzde oranı 0-100 arasında olmalıdır' }, { status: 400 })
  }
  if (rateFixed && rateFixed <= 0) {
    return NextResponse.json({ error: 'Sabit tutar 0\'dan büyük olmalıdır' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('commission_rules')
    .insert({
      business_id: businessId,
      staff_id: staffId || null,
      service_id: serviceId || null,
      rate_percent: ratePercent ? Number(ratePercent) : null,
      rate_fixed: rateFixed ? Number(rateFixed) : null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ rule: data }, { status: 201 })
}

// DELETE — Kural sil (?id=)
export async function DELETE(request: NextRequest) {
  const auth = await requirePermission(request, 'settings')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id zorunludur' }, { status: 400 })

  const admin = createAdminClient()

  const { error } = await admin
    .from('commission_rules')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
