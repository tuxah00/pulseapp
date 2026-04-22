import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { parsePaginationParams } from '@/lib/api/validate'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/orders' })

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
    log.error({ err }, 'Orders GET error')
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

    // Decrease stock for items that have a product_id — single batch SELECT then parallel UPDATEs
    const stockItems = (items || []).filter((item: { product_id?: string; quantity?: number }) => item.product_id && item.quantity)
    if (stockItems.length > 0) {
      const productIds = stockItems.map((item: { product_id: string }) => item.product_id)
      const { data: products } = await supabase
        .from('products')
        .select('id, stock_count')
        .in('id', productIds)
        .eq('business_id', staff.business_id)

      if (products && products.length > 0) {
        const stockMap = new Map(products.map((p: { id: string; stock_count: number }) => [p.id, p.stock_count || 0]))
        await Promise.all(
          stockItems.map((item: { product_id: string; quantity: number }) => {
            const current = stockMap.get(item.product_id)
            if (current === undefined) return Promise.resolve()
            return supabase
              .from('products')
              .update({ stock_count: Math.max(0, current - item.quantity) })
              .eq('id', item.product_id)
              .eq('business_id', staff.business_id)
          })
        )
      }
    }

    return NextResponse.json({ order: data })
  } catch (err) {
    log.error({ err }, 'Orders POST error')
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
    log.error({ err }, 'Orders PATCH error')
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
    log.error({ err }, 'Orders DELETE error')
    return NextResponse.json({ error: 'Silme başarısız' }, { status: 500 })
  }
}
