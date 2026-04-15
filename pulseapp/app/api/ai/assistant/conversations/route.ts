import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withAuth } from '@/lib/api/with-permission'

// GET — Sohbet listesi
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ai_conversations')
    .select('id, title, is_onboarding, created_at, updated_at')
    .eq('business_id', ctx.businessId)
    .eq('staff_id', ctx.staffId)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ conversations: data || [] })
})

// POST — Yeni sohbet oluştur
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json()
  const { title, isOnboarding } = body as { title?: string; isOnboarding?: boolean }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('ai_conversations')
    .insert({
      business_id: ctx.businessId,
      staff_id: ctx.staffId,
      title: title || 'Yeni Sohbet',
      is_onboarding: isOnboarding || false,
    })
    .select('id, title, is_onboarding, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ conversation: data }, { status: 201 })
})
