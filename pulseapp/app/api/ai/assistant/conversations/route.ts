import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { withAuth } from '@/lib/api/with-permission'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { validateBody } from '@/lib/api/validate'
import { aiConversationCreateSchema } from '@/lib/schemas'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/ai/assistant/conversations' })

// 30 günden eski sohbetler otomatik silinir (onboarding hariç).
const CONVERSATION_RETENTION_DAYS = 30

// GET — Sohbet listesi
export const GET = withAuth(async (req: NextRequest, ctx) => {
  const rl = checkRateLimit(req, RATE_LIMITS.aiAssistant)
  if (rl.limited) return rl.response

  const admin = createAdminClient()

  // Eski sohbetleri temizle (fire-and-forget — hata listeyi etkilemesin)
  const cutoff = new Date(Date.now() - CONVERSATION_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  admin
    .from('ai_conversations')
    .delete()
    .eq('business_id', ctx.businessId)
    .eq('staff_id', ctx.staffId)
    .eq('is_onboarding', false)
    .lt('updated_at', cutoff)
    .then(({ error }) => {
      if (error) log.error({ err: error }, 'Eski sohbet temizleme hatası')
    })

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
  const rl = checkRateLimit(req, RATE_LIMITS.aiAssistant)
  if (rl.limited) return rl.response

  const parsed = await validateBody(req, aiConversationCreateSchema)
  if (!parsed.ok) return parsed.response
  const { title, isOnboarding } = parsed.data

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
