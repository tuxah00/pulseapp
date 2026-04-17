import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { verifyBusinessAccess } from '@/lib/utils/auth-guard'

// GET: Gider listesi
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const category = searchParams.get('category')

  if (!businessId) return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })

  const staff = await verifyBusinessAccess(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  let query = supabase
    .from('expenses')
    .select('*')
    .eq('business_id', businessId)
    .order('expense_date', { ascending: false })

  if (from) query = query.gte('expense_date', from)
  if (to) query = query.lte('expense_date', to)
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expenses: data })
}

// POST: Yeni gider ekle
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json()
  const { business_id, category, description, amount, expense_date, is_recurring, recurring_period, custom_interval_days } = body

  if (!business_id || !category || amount === undefined || !expense_date) {
    return NextResponse.json({ error: 'business_id, category, amount, expense_date gerekli' }, { status: 400 })
  }

  // Sayısal doğrulama
  const amt = Number(amount)
  if (!Number.isFinite(amt) || amt < 0) {
    return NextResponse.json({ error: 'Geçersiz tutar' }, { status: 400 })
  }

  const staff = await verifyBusinessAccess(supabase, user.id, business_id)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      business_id,
      category,
      description: description || null,
      amount: amt,
      expense_date,
      is_recurring: is_recurring || false,
      recurring_period: recurring_period || null,
      custom_interval_days: custom_interval_days || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expense })
}

// PATCH: Gider güncelle
export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 })

  // Kaydın hangi işletmeye ait olduğunu önce doğrula
  const { data: existing } = await supabase
    .from('expenses')
    .select('business_id')
    .eq('id', id)
    .single()
  if (!existing) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 })

  const staff = await verifyBusinessAccess(supabase, user.id, existing.business_id)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const body = await req.json()
  const updateObj: Record<string, unknown> = {}

  if (body.category !== undefined) updateObj.category = body.category
  if (body.description !== undefined) updateObj.description = body.description
  if (body.amount !== undefined) {
    const amt = Number(body.amount)
    if (!Number.isFinite(amt) || amt < 0) {
      return NextResponse.json({ error: 'Geçersiz tutar' }, { status: 400 })
    }
    updateObj.amount = amt
  }
  if (body.expense_date !== undefined) updateObj.expense_date = body.expense_date
  if (body.is_recurring !== undefined) updateObj.is_recurring = body.is_recurring
  if (body.recurring_period !== undefined) updateObj.recurring_period = body.recurring_period
  if (body.custom_interval_days !== undefined) updateObj.custom_interval_days = body.custom_interval_days

  const { data: expense, error } = await supabase
    .from('expenses')
    .update(updateObj)
    .eq('id', id)
    .eq('business_id', existing.business_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ expense })
}

// DELETE: Gider sil
export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 })

  const { data: existing } = await supabase
    .from('expenses')
    .select('business_id')
    .eq('id', id)
    .single()
  if (!existing) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 })

  const staff = await verifyBusinessAccess(supabase, user.id, existing.business_id)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('business_id', existing.business_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
