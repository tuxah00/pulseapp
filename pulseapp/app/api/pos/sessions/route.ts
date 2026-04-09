import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET: Oturum listesi (açık oturum + geçmiş)
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })

  // Açık oturum
  const { data: openSession } = await supabase
    .from('pos_sessions')
    .select('*, staff_members(name)')
    .eq('business_id', businessId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Son 30 kapalı oturum
  const { data: history } = await supabase
    .from('pos_sessions')
    .select('*, staff_members(name)')
    .eq('business_id', businessId)
    .eq('status', 'closed')
    .order('closed_at', { ascending: false })
    .limit(30)

  return NextResponse.json({ openSession, history: history || [] })
}

// POST: Kasa aç
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json()
  const { business_id, staff_id, opening_cash = 0 } = body

  if (!business_id || !staff_id) {
    return NextResponse.json({ error: 'business_id ve staff_id gerekli' }, { status: 400 })
  }

  // Zaten açık oturum var mı kontrol et
  const { data: existing } = await supabase
    .from('pos_sessions')
    .select('id')
    .eq('business_id', business_id)
    .eq('status', 'open')
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Zaten açık bir kasa oturumu var' }, { status: 409 })
  }

  const { data: session, error } = await supabase
    .from('pos_sessions')
    .insert({
      business_id,
      staff_id,
      opening_cash,
      status: 'open',
    })
    .select('*, staff_members(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session })
}

// PATCH: Kasa kapat
export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 })

  const body = await req.json()
  const { actual_cash, notes } = body

  // Kullanıcının business_id'sini al ve oturumun sahipliğini doğrula
  const { data: staff } = await supabase
    .from('staff_members')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { data: session } = await supabase
    .from('pos_sessions')
    .select('*')
    .eq('id', id)
    .eq('business_id', staff.business_id)
    .eq('status', 'open')
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Açık oturum bulunamadı' }, { status: 404 })
  }

  const { data: transactions } = await supabase
    .from('pos_transactions')
    .select('payments, total, transaction_type')
    .eq('business_id', session.business_id)
    .gte('created_at', session.opened_at)
    .limit(2000)

  let totalCash = 0
  let totalCard = 0
  let totalTransfer = 0
  let totalSales = 0
  let totalRefunds = 0

  for (const tx of transactions || []) {
    const txTotal = Number(tx.total) || 0

    if (tx.transaction_type === 'refund') {
      totalRefunds += txTotal
    } else {
      totalSales += txTotal
    }

    const payments = tx.payments as Array<{ method: string; amount: number }> || []
    for (const p of payments) {
      const amount = Number(p.amount) || 0
      if (tx.transaction_type === 'refund') {
        if (p.method === 'cash') totalCash -= amount
        else if (p.method === 'card') totalCard -= amount
        else if (p.method === 'transfer') totalTransfer -= amount
      } else {
        if (p.method === 'cash') totalCash += amount
        else if (p.method === 'card') totalCard += amount
        else if (p.method === 'transfer') totalTransfer += amount
      }
    }
  }

  const openingCash = Number(session.opening_cash) || 0
  const expectedCash = openingCash + totalCash
  const actualCashNum = actual_cash != null ? Number(actual_cash) : null
  const difference = actualCashNum != null ? actualCashNum - expectedCash : null

  const { data: updated, error } = await supabase
    .from('pos_sessions')
    .update({
      closed_at: new Date().toISOString(),
      total_cash: totalCash,
      total_card: totalCard,
      total_transfer: totalTransfer,
      total_sales: totalSales,
      total_refunds: totalRefunds,
      expected_cash: expectedCash,
      actual_cash: actualCashNum,
      difference,
      notes: notes || null,
      status: 'closed',
    })
    .eq('id', id)
    .select('*, staff_members(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ session: updated })
}
