import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { withAuth } from '@/lib/api/with-permission'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'

// GET — Tekil sohbet + mesajları (RLS staff_id'yi filtreler, ctx gerekmez)
export const GET = withAuth(async (req: NextRequest, _ctx) => {
  const rl = checkRateLimit(req, RATE_LIMITS.aiAssistant)
  if (rl.limited) return rl.response

  const id = req.nextUrl.pathname.split('/').pop()
  if (!id) return NextResponse.json({ error: 'ID gerekli' }, { status: 400 })

  // RLS: ai_conversations_staff_access + ai_messages_via_conversation — başka staff'ın sohbeti "bulunamadı" olarak döner
  const supabase = createServerSupabaseClient()

  const { data: conv } = await supabase
    .from('ai_conversations')
    .select('id, title, is_onboarding, metadata, created_at')
    .eq('id', id)
    .single()

  if (!conv) {
    return NextResponse.json({ error: 'Sohbet bulunamadı' }, { status: 404 })
  }

  // Get messages
  const { data: messages } = await supabase
    .from('ai_messages')
    .select('id, role, content, tool_calls, tool_name, tool_result, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ conversation: conv, messages: messages || [] })
})

// DELETE — Sohbeti sil (RLS staff_id'yi filtreler, ctx gerekmez)
export const DELETE = withAuth(async (req: NextRequest, _ctx) => {
  const rl = checkRateLimit(req, RATE_LIMITS.aiAssistant)
  if (rl.limited) return rl.response

  const id = req.nextUrl.pathname.split('/').pop()
  if (!id) return NextResponse.json({ error: 'ID gerekli' }, { status: 400 })

  // RLS: ai_conversations_staff_access — başka staff'ın sohbetini DELETE eşleşmeden döner
  const supabase = createServerSupabaseClient()

  const { data: deleted, error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!deleted) {
    return NextResponse.json({ error: 'Sohbet bulunamadı' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
})
