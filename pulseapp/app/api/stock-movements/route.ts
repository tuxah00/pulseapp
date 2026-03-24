import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET: Stok hareket geçmişi
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('productId')
  const businessId = searchParams.get('businessId')

  if (!productId && !businessId) {
    return NextResponse.json({ error: 'productId veya businessId gerekli' }, { status: 400 })
  }

  const admin = createAdminClient()
  let query = admin
    .from('stock_movements')
    .select('*, staff_members(name)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (productId) query = query.eq('product_id', productId)
  if (businessId) query = query.eq('business_id', businessId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ movements: data })
}

// POST: Stok hareketi kaydet + ürün stok miktarını güncelle
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json()
  const { businessId, productId, quantity, type, notes, staffId, referenceId } = body

  if (!businessId || !productId || quantity === undefined || !type) {
    return NextResponse.json({ error: 'businessId, productId, quantity, type gerekli' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Mevcut stok miktarını al
  const { data: product, error: productError } = await admin
    .from('products')
    .select('stock_count, min_stock_level, name')
    .eq('id', productId)
    .single()

  if (productError || !product) {
    return NextResponse.json({ error: 'Ürün bulunamadı' }, { status: 404 })
  }

  // Yeni stok miktarını hesapla
  const delta = type === 'in' ? Math.abs(quantity) : -Math.abs(quantity)
  const newCount = Math.max(0, product.stock_count + delta)

  // Stok güncelle
  const { error: updateError } = await admin
    .from('products')
    .update({ stock_count: newCount })
    .eq('id', productId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Hareket kaydı oluştur
  const { data: movement, error: movementError } = await admin
    .from('stock_movements')
    .insert({
      business_id: businessId,
      product_id: productId,
      quantity: type === 'in' ? Math.abs(quantity) : -Math.abs(quantity),
      type,
      notes: notes || null,
      staff_id: staffId || null,
      reference_id: referenceId || null,
    })
    .select()
    .single()

  if (movementError) return NextResponse.json({ error: movementError.message }, { status: 500 })

  // Düşük stok uyarısı bildirimi
  if (newCount <= product.min_stock_level) {
    // staff_members'dan owner'ı bul
    const { data: owner } = await admin
      .from('staff_members')
      .select('id')
      .eq('business_id', businessId)
      .eq('role', 'owner')
      .single()

    if (owner) {
      await admin
        .from('notifications')
        .insert({
          business_id: businessId,
          staff_id: owner.id,
          type: 'stock_alert',
          title: 'Düşük Stok Uyarısı',
          message: `"${product.name}" ürününde stok ${newCount} ${newCount === 0 ? '— tükendi!' : `${product.min_stock_level} minimum seviyesinde.`}`,
          is_read: false,
        })
        .then(() => {}) // fire and forget
    }
  }

  return NextResponse.json({ movement, newStock: newCount })
}
