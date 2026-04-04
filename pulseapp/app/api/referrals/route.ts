import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyMembership(supabase: ReturnType<typeof createServerSupabaseClient>, userId: string, businessId: string) {
  const { data } = await supabase
    .from('staff_members')
    .select('id, business_id')
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .single()
  return data
}

// GET: Referans listesi
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const status = searchParams.get('status')
  const referrerId = searchParams.get('referrerId')

  if (!businessId) return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const admin = createAdminClient()
  let query = admin
    .from('referrals')
    .select(`
      *,
      referrer:customers!referrals_referrer_customer_id_fkey(id, name, phone),
      referred:customers!referrals_referred_customer_id_fkey(id, name, phone)
    `)
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (referrerId) query = query.eq('referrer_customer_id', referrerId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ referrals: data })
}

// POST: Yeni referans oluştur
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await request.json()
  const { businessId, referrerCustomerId, referredName, referredPhone, rewardType, rewardValue, expiresAt } = body

  if (!businessId || !referrerCustomerId) {
    return NextResponse.json({ error: 'businessId ve referrerCustomerId zorunlu' }, { status: 400 })
  }

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const admin = createAdminClient()

  // Referred kişi zaten müşteri mi kontrol et
  let referredCustomerId = null
  if (referredPhone) {
    const { data: existing } = await admin
      .from('customers')
      .select('id')
      .eq('business_id', businessId)
      .eq('phone', referredPhone)
      .single()
    if (existing) referredCustomerId = existing.id
  }

  const { data, error } = await admin
    .from('referrals')
    .insert({
      business_id: businessId,
      referrer_customer_id: referrerCustomerId,
      referred_customer_id: referredCustomerId,
      referred_name: referredName || null,
      referred_phone: referredPhone || null,
      reward_type: rewardType || null,
      reward_value: rewardValue || null,
      expires_at: expiresAt || null,
    })
    .select(`
      *,
      referrer:customers!referrals_referrer_customer_id_fkey(id, name, phone)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ referral: data }, { status: 201 })
}

// PATCH: Referans güncelle (dönüştür, ödül işaretle)
export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await request.json()
  const { businessId, id, status, referredCustomerId, rewardClaimed } = body

  if (!businessId || !id) return NextResponse.json({ error: 'businessId ve id zorunlu' }, { status: 400 })

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const admin = createAdminClient()
  const updateData: Record<string, unknown> = {}

  if (status) {
    updateData.status = status
    if (status === 'converted') updateData.converted_at = new Date().toISOString()
  }
  if (referredCustomerId) updateData.referred_customer_id = referredCustomerId
  if (rewardClaimed !== undefined) updateData.reward_claimed = rewardClaimed

  const { data, error } = await admin
    .from('referrals')
    .update(updateData)
    .eq('id', id)
    .eq('business_id', businessId)
    .select(`
      *,
      referrer:customers!referrals_referrer_customer_id_fkey(id, name, phone),
      referred:customers!referrals_referred_customer_id_fkey(id, name, phone)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ referral: data })
}
