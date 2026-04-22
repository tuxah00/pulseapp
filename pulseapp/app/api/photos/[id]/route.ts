import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireWritePermission } from '@/lib/api/with-permission'

const BUCKET_NAME = 'customer-photos'

// PATCH: is_public / ai_analysis / notes / tags güncelle
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWritePermission(request, 'customers')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Geçersiz body' }, { status: 400 })
  }

  const allowed: Record<string, unknown> = {}
  if (typeof body.is_public === 'boolean') allowed.is_public = body.is_public
  if (body.ai_analysis !== undefined) allowed.ai_analysis = body.ai_analysis
  if (typeof body.notes === 'string' || body.notes === null) allowed.notes = body.notes
  if (Array.isArray(body.tags)) allowed.tags = body.tags

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('customer_photos')
    .update(allowed)
    .eq('id', params.id)
    .eq('business_id', businessId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Fotoğraf bulunamadı' }, { status: 404 })

  return NextResponse.json({ photo: data })
}

// DELETE: Fotoğraf sil (DB + Storage)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWritePermission(request, 'customers')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createAdminClient()

  // Tek round-trip: silinen satırın photo_url'sini dönüşte al (Storage temizliği için)
  const { data: photo, error } = await supabase
    .from('customer_photos')
    .delete()
    .eq('id', params.id)
    .eq('business_id', businessId)
    .select('photo_url')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!photo) return NextResponse.json({ error: 'Fotoğraf bulunamadı' }, { status: 404 })

  // Storage'dan da sil — hata olursa sessiz geç (DB kaydı zaten silindi)
  try {
    const url = new URL(photo.photo_url)
    const marker = `/storage/v1/object/public/${BUCKET_NAME}/`
    const idx = url.pathname.indexOf(marker)
    if (idx >= 0) {
      const storagePath = url.pathname.slice(idx + marker.length)
      await supabase.storage.from(BUCKET_NAME).remove([storagePath])
    }
  } catch {
    // Storage silme hatası kritik değil
  }

  return NextResponse.json({ success: true })
}
