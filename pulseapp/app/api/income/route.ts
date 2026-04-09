import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET: Gelir listesi
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

  let query = supabase
    .from('income')
    .select('*')
    .eq('business_id', businessId)
    .order('income_date', { ascending: false })

  if (from) query = query.gte('income_date', from)
  if (to) query = query.lte('income_date', to)
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ income: data })
}

// POST: Yeni gelir ekle
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json()
  const { business_id, category, description, amount, income_date, is_recurring, recurring_period, custom_interval_days } = body

  if (!business_id || !category || amount === undefined || !income_date) {
    return NextResponse.json({ error: 'business_id, category, amount, income_date gerekli' }, { status: 400 })
  }

  const { data: income, error } = await supabase
    .from('income')
    .insert({
      business_id,
      category,
      description: description || null,
      amount,
      income_date,
      is_recurring: is_recurring || false,
      recurring_period: recurring_period || null,
      custom_interval_days: custom_interval_days || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ income })
}

// DELETE: Gelir sil
export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 })

  const { error } = await supabase.from('income').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
