import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withAuth } from '@/lib/api/with-permission'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'

// GET — Tekil sohbet + mesajları
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const rl = checkRateLimit(req, RATE_LIMITS.aiAssistant)
  if (rl.limited) return rl.response

  const id = req.nextUrl.pathname.split('/').pop()
  if (!id) return NextResponse.json({ error: 'ID gerekli' }, { status: 400 })

  const admin = createAdminClient()

  // Verify ownership
  const { data: conv } = await admin
    .from('ai_conversations')
    .select('id, title, is_onboarding, metadata, created_at')
    .eq('id', id)
    .eq('staff_id', ctx.staffId)
    .single()

  if (!conv) {
    return NextResponse.json({ error: 'Sohbet bulunamadı' }, { status: 404 })
  }

  // Get messages
  const { data: messages } = await admin
    .from('ai_messages')
    .select('id, role, content, tool_calls, tool_name, tool_result, created_at')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ conversation: conv, messages: messages || [] })
})

// DELETE — Sohbeti sil
export const DELETE = withAuth(async (req: NextRequest, ctx) => {
  const rl = checkRateLimit(req, RATE_LIMITS.aiAssistant)
  if (rl.limited) return rl.response

  const id = req.nextUrl.pathname.split('/').pop()
  if (!id) return NextResponse.json({ error: 'ID gerekli' }, { status: 400 })

  const admin = createAdminClient()

  // Verify ownership before delete
  const { data: conv } = await admin
    .from('ai_conversations')
    .select('id')
    .eq('id', id)
    .eq('staff_id', ctx.staffId)
    .single()

  if (!conv) {
    return NextResponse.json({ error: 'Sohbet bulunamadı' }, { status: 404 })
  }

  // Messages cascade deleted via FK
  await admin.from('ai_conversations').delete().eq('id', id)

  return NextResponse.json({ success: true })
})
