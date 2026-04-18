import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })

  // Kullanıcının bu işletmeye ait personel olduğunu doğrula
  const { data: staffCheck } = await supabase
    .from('staff_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('business_id', businessId)
    .eq('is_active', true)
    .single()

  if (!staffCheck) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  const { data, error } = await supabase
    .from('waitlist_entries')
    .select('*, services(name), staff_members(name)')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ waitlist: data })
}
