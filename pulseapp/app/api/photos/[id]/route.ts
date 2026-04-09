import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// DELETE: Fotoğraf sil
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })

  const { data: staff } = await supabase
    .from('staff_members')
    .select('id, business_id')
    .eq('user_id', user.id)
    .eq('business_id', businessId)
    .single()
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  // Fotoğrafın URL'sini al (Storage'dan silmek için)
  const { data: photo } = await supabase
    .from('customer_photos')
    .select('photo_url')
    .eq('id', params.id)
    .eq('business_id', businessId)
    .single()

  if (!photo) return NextResponse.json({ error: 'Fotoğraf bulunamadı' }, { status: 404 })

  // DB kaydını sil
  const { error } = await supabase
    .from('customer_photos')
    .delete()
    .eq('id', params.id)
    .eq('business_id', businessId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Storage'dan da sil (hata olursa sessiz geç)
  try {
    const url = new URL(photo.photo_url)
    const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/(.+)/)
    if (pathMatch) {
      await supabase.storage.from('customer-photos').remove([pathMatch[1].replace('customer-photos/', '')])
    }
  } catch {
    // Storage silme hatası kritik değil
  }

  return NextResponse.json({ success: true })
}
