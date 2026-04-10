import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

async function getStaffBusiness() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: staff } = await supabase
    .from('staff_members')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()
  return staff ? { supabase, businessId: staff.business_id } : null
}

// GET — Ödül şablonları + müşteriye atanmış ödüller
export async function GET(req: NextRequest) {
  const ctx = await getStaffBusiness()
  if (!ctx) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const type = req.nextUrl.searchParams.get('type') // 'templates' | 'assigned'
  const customerId = req.nextUrl.searchParams.get('customer_id')
  const status = req.nextUrl.searchParams.get('status')

  if (type === 'assigned') {
    let query = ctx.supabase
      .from('customer_rewards')
      .select('*, rewards(name, type, value, description), customers(name, phone)')
      .eq('business_id', ctx.businessId)
      .order('given_at', { ascending: false })

    if (customerId) query = query.eq('customer_id', customerId)
    if (status) query = query.eq('status', status)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ rewards: data ?? [] })
  }

  // Default: reward templates
  const { data, error } = await ctx.supabase
    .from('rewards')
    .select('*')
    .eq('business_id', ctx.businessId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rewards: data ?? [] })
}

// POST — Yeni ödül şablonu oluştur VEYA müşteriye ödül ata
export async function POST(req: NextRequest) {
  const ctx = await getStaffBusiness()
  if (!ctx) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json()

  // Müşteriye ödül ata
  if (body.action === 'assign') {
    const { customerId, rewardId, notes } = body
    if (!customerId || !rewardId) {
      return NextResponse.json({ error: 'customerId ve rewardId zorunlu' }, { status: 400 })
    }

    // Ödül bilgisini al (valid_days)
    const { data: reward } = await ctx.supabase
      .from('rewards')
      .select('valid_days')
      .eq('id', rewardId)
      .single()

    const expiresAt = reward?.valid_days
      ? new Date(Date.now() + reward.valid_days * 86400000).toISOString()
      : null

    const { data, error } = await ctx.supabase
      .from('customer_rewards')
      .insert({
        business_id: ctx.businessId,
        customer_id: customerId,
        reward_id: rewardId,
        status: 'pending',
        expires_at: expiresAt,
        notes: notes || null,
      })
      .select('*, rewards(name, type, value, description), customers(name, phone)')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ reward: data })
  }

  // Yeni ödül şablonu oluştur
  const { name, type, value, description, validDays } = body
  if (!name || !type) {
    return NextResponse.json({ error: 'name ve type zorunlu' }, { status: 400 })
  }

  const { data, error } = await ctx.supabase
    .from('rewards')
    .insert({
      business_id: ctx.businessId,
      name,
      type,
      value: value || null,
      description: description || null,
      valid_days: validDays ?? 30,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reward: data })
}

// PATCH — Ödül güncelle (şablon veya atanmış ödül durumu)
export async function PATCH(req: NextRequest) {
  const ctx = await getStaffBusiness()
  if (!ctx) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json()
  const { id, table } = body

  if (!id) return NextResponse.json({ error: 'id zorunlu' }, { status: 400 })

  if (table === 'customer_rewards') {
    const updates: Record<string, unknown> = {}
    if (body.status) {
      updates.status = body.status
      if (body.status === 'used') updates.used_at = new Date().toISOString()
    }
    const { error } = await ctx.supabase
      .from('customer_rewards')
      .update(updates)
      .eq('id', id)
      .eq('business_id', ctx.businessId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // Reward template update
  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.type !== undefined) updates.type = body.type
  if (body.value !== undefined) updates.value = body.value
  if (body.description !== undefined) updates.description = body.description
  if (body.validDays !== undefined) updates.valid_days = body.validDays
  if (body.isActive !== undefined) updates.is_active = body.isActive

  const { error } = await ctx.supabase
    .from('rewards')
    .update(updates)
    .eq('id', id)
    .eq('business_id', ctx.businessId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — Ödül şablonu sil
export async function DELETE(req: NextRequest) {
  const ctx = await getStaffBusiness()
  if (!ctx) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id zorunlu' }, { status: 400 })

  const { error } = await ctx.supabase
    .from('rewards')
    .delete()
    .eq('id', id)
    .eq('business_id', ctx.businessId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
