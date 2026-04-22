import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/notifications' })

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
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('business_id', staff.business_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (type && type !== 'all') {
      query = query.eq('type', type)
    }

    const { data, count, error } = await query
    if (error) throw error

    return NextResponse.json({ notifications: data || [], total: count || 0 })
  } catch (err) {
    log.error({ err }, 'Notifications GET error')
    return NextResponse.json({ error: 'Bildirimler alınamadı' }, { status: 500 })
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
    const { action, ids } = body

    if (action === 'mark_all_read') {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('business_id', staff.business_id)
        .eq('is_read', false)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'mark_read' && Array.isArray(ids)) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('business_id', staff.business_id)
        .in('id', ids)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === 'toggle_read' && Array.isArray(ids) && ids.length === 1) {
      const { data: notif } = await supabase
        .from('notifications')
        .select('is_read')
        .eq('id', ids[0])
        .eq('business_id', staff.business_id)
        .single()
      if (notif) {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: !notif.is_read })
          .eq('id', ids[0])
        if (error) throw error
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 })
  } catch (err) {
    log.error({ err }, 'Notifications PATCH error')
    return NextResponse.json({ error: 'İşlem başarısız' }, { status: 500 })
  }
}
