import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { parsePaginationParams } from '@/lib/api/validate'

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

    const { data: staff } = await supabase
      .from('staff_members')
      .select('business_id')
      .eq('user_id', user.id)
      .single()
    if (!staff) return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const { page, pageSize, from, to } = parsePaginationParams(searchParams)

    let query = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .eq('business_id', staff.business_id)
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error, count } = await query.range(from, to)
    if (error) throw error

    return NextResponse.json({ orders: data || [], total: count || 0 })
  } catch (err) {
    console.error('Orders GET error:', err)
    return NextResponse.json({ error: 'Siparişler alınamadı' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

    const { data: staff } = await supabase
      .from('staff_members')
      .select('business_id')
      .eq('user_id', user.id)
      .single()
    if (!staff) return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })

    const body = await req.json()
    const { customer_name, table_number, items, total_amount, notes, reservation_id } = body

    const { data, error } = await supabase
      .from('orders')
      .insert({
        business_id: staff.business_id,
        customer_name: customer_name || null,
        table_number: table_number || null,
        items: items || [],
        total_amount: total_amount || 0,
        notes: notes || null,
        reservation_id: reservation_id || null,
      })
      .select()
      .single()

    if (error) throw error

    // Decrease stock for each item
    for (const item of (items || [])) {
      if (item.product_id && item.quantity) {
        try {
          const { data: product } = await supabase
            .from('products')
            .select('stock_count')
            .eq('id', item.product_id)
            .single()
          if (product) {
            await supabase
              .from('products')
              .update({ stock_count: Math.max(0, (product.stock_count || 0) - item.quantity) })
              .eq('id', item.product_id)
          }
        } catch {
          // Stock update failed, continue
        }
      }
    }

    return NextResponse.json({ order: data })
  } catch (err) {
    console.error('Orders POST error:', err)
    return NextResponse.json({ error: 'Sipariş oluşturulamadı' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

    const { data: staff } = await supabase
      .from('staff_members')
      .select('business_id')
      .eq('user_id', user.id)
      .single()
    if (!staff) return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })

    const body = await req.json()
    const { id, status, notes, items, total_amount } = body

    if (!id) return NextResponse.json({ error: 'ID gerekli' }, { status: 400 })

    const updates: Record<string, any> = {}
    if (status) updates.status = status
    if (notes !== undefined) updates.notes = notes
    if (items) updates.items = items
    if (total_amount !== undefined) updates.total_amount = total_amount

    const { data, error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .eq('business_id', staff.business_id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ order: data })
  } catch (err) {
    console.error('Orders PATCH error:', err)
    return NextResponse.json({ error: 'Güncelleme başarısız' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

    const { data: staff } = await supabase
      .from('staff_members')
      .select('business_id')
      .eq('user_id', user.id)
      .single()
    if (!staff) return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID gerekli' }, { status: 400 })

    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id)
      .eq('business_id', staff.business_id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Orders DELETE error:', err)
    return NextResponse.json({ error: 'Silme başarısız' }, { status: 500 })
  }
}
