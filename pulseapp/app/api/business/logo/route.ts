import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET_NAME = 'business-logos'

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const admin = createAdminClient()

  // Kullanıcının business_id'sini al
  const { data: staff } = await supabase
    .from('staff_members')
    .select('business_id, role')
    .eq('user_id', user.id)
    .single()

  if (!staff || !['owner', 'manager'].includes(staff.role)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'Dosya gerekli' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return NextResponse.json({ error: 'Sadece JPG, PNG veya WebP yüklenebilir' }, { status: 400 })
  }

  // Bucket oluştur (yoksa)
  const { data: buckets } = await admin.storage.listBuckets()
  if (!buckets?.some(b => b.name === BUCKET_NAME)) {
    await admin.storage.createBucket(BUCKET_NAME, { public: true, fileSizeLimit: 5242880 })
  }

  const path = `${staff.business_id}/logo.${ext}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await admin.storage
    .from(BUCKET_NAME)
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from(BUCKET_NAME).getPublicUrl(path)

  // Settings'e kaydet
  const { data: business } = await admin
    .from('businesses')
    .select('settings')
    .eq('id', staff.business_id)
    .single()

  const newSettings = { ...(business?.settings || {}), logo_url: publicUrl }

  await admin.from('businesses').update({ settings: newSettings }).eq('id', staff.business_id)

  return NextResponse.json({ logo_url: publicUrl })
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const admin = createAdminClient()

  const { data: staff } = await supabase
    .from('staff_members')
    .select('business_id, role')
    .eq('user_id', user.id)
    .single()

  if (!staff || !['owner', 'manager'].includes(staff.role)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { data: business } = await admin
    .from('businesses')
    .select('settings')
    .eq('id', staff.business_id)
    .single()

  const newSettings = { ...(business?.settings || {}), logo_url: null }
  await admin.from('businesses').update({ settings: newSettings }).eq('id', staff.business_id)

  return NextResponse.json({ ok: true })
}
