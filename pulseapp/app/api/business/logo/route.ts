import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const BUCKET_NAME = 'business-logos'

async function getAuthorizedStaff() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Yetkisiz' }, { status: 401 }) }

  const { data: staff } = await supabase
    .from('staff_members')
    .select('business_id, role')
    .eq('user_id', user.id)
    .single()

  if (!staff || !['owner', 'manager'].includes(staff.role)) {
    return { error: NextResponse.json({ error: 'Yetkisiz' }, { status: 403 }) }
  }

  return { staff, supabase }
}

export async function POST(req: NextRequest) {
  const { staff, supabase, error } = await getAuthorizedStaff()
  if (error || !supabase) return error

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'Dosya gerekli' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return NextResponse.json({ error: 'Sadece JPG, PNG veya WebP yüklenebilir' }, { status: 400 })
  }

  const path = `${staff!.business_id}/logo.${ext}`
  const bytes = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(path)

  const { data: business } = await supabase
    .from('businesses')
    .select('settings')
    .eq('id', staff!.business_id)
    .single()

  await supabase.from('businesses')
    .update({ settings: { ...(business?.settings || {}), logo_url: publicUrl } })
    .eq('id', staff!.business_id)

  return NextResponse.json({ logo_url: publicUrl })
}

export async function DELETE(_req: NextRequest) {
  const { staff, supabase, error } = await getAuthorizedStaff()
  if (error || !supabase) return error

  const { data: business } = await supabase
    .from('businesses')
    .select('settings')
    .eq('id', staff!.business_id)
    .single()

  await supabase.from('businesses')
    .update({ settings: { ...(business?.settings || {}), logo_url: null } })
    .eq('id', staff!.business_id)

  return NextResponse.json({ ok: true })
}
