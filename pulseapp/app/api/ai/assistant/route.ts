import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEffectivePermissions, type StaffRole } from '@/types'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { getOpenAIClient, ASSISTANT_MODEL, ASSISTANT_MAX_TOKENS } from '@/lib/ai/openai-client'
import { buildAssistantSystemPrompt, buildOnboardingSystemPrompt, buildPageTutorialPrompt } from '@/lib/ai/assistant-prompts'
import { findTopicByKey } from '@/lib/ai/tutorial-content'
import { ASSISTANT_TOOLS, TOOL_LABELS, executeAssistantTool } from '@/lib/ai/assistant-tools'
import { filterAssistantTools } from '@/lib/ai/tool-categories'
import { deriveBlocksFromToolResult } from '@/lib/ai/assistant-blocks'
import { AI_LIMITS } from '@/lib/ai/assistant-limits'
import type { AuthContext } from '@/lib/api/with-permission'
import type { PlanType } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  // 1. Rate limit
  const rl = checkRateLimit(req, RATE_LIMITS.aiAssistant)
  if (rl.limited) return rl.response

  // 2. Auth
  const supabase = createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Oturum bulunamadı' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: staff } = await admin
    .from('staff_members')
    .select('id, business_id, role, permissions, name, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!staff) {
    return Response.json({ error: 'Personel kaydı bulunamadı' }, { status: 403 })
  }

  const role = staff.role as StaffRole
  const permissions = getEffectivePermissions(role, staff.permissions)
  const ctx: AuthContext = {
    userId: user.id,
    staffId: staff.id,
    businessId: staff.business_id,
    role,
    permissions,
  }

  // 3. Parse request
  const body = await req.json()
  const { conversationId, message, isOnboarding, origin, tutorialTopic } = body as {
    conversationId: string | null
    message: string
    isOnboarding?: boolean
    origin?: string
    tutorialTopic?: string
  }

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return Response.json({ error: 'Mesaj boş olamaz' }, { status: 400 })
  }

  // 4. Plan limit check (parallel: business info + usage)
  const currentMonth = new Date().toISOString().slice(0, 7) // '2026-04'

  const [{ data: biz }, { data: usage }] = await Promise.all([
    admin
      .from('businesses')
      .select('subscription_plan, working_hours, name, sector, settings')
      .eq('id', staff.business_id)
      .single(),
    admin
      .from('ai_usage')
      .select('message_count, total_input_tokens, total_output_tokens')
      .eq('business_id', staff.business_id)
      .eq('staff_id', staff.id)
      .eq('month', currentMonth)
      .single(),
  ])

  const plan = (biz?.subscription_plan || 'starter') as PlanType
  const limits = AI_LIMITS[plan]

  const currentCount = usage?.message_count || 0
  if (currentCount >= limits.monthlyMessages) {
    return sseResponse([
      { type: 'limit' as const, error: `Aylık mesaj limitinize ulaştınız (${limits.monthlyMessages}). Planınızı yükselterek daha fazla kullanabilirsiniz.` },
      { type: 'done' as const },
    ])
  }

  // 5. Load or create conversation
  let convId = conversationId
  if (!convId) {
    const { data: conv, error: convErr } = await admin
      .from('ai_conversations')
      .insert({
        business_id: staff.business_id,
        staff_id: staff.id,
        title: message.slice(0, 100),
        is_onboarding: isOnboarding || false,
      })
      .select('id')
      .single()

    if (convErr || !conv) {
      return Response.json({ error: 'Sohbet oluşturulamadı' }, { status: 500 })
    }
    convId = conv.id
  }

  // 6. Load history
  const { data: historyRows } = await admin
    .from('ai_messages')
    .select('role, content, tool_calls, tool_name, tool_call_id, tool_result')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true })
    .limit(limits.maxHistory)

  const history: Array<any> = (historyRows || []).map(row => {
    if (row.role === 'user') {
      return { role: 'user', content: row.content }
    }
    if (row.role === 'assistant' && row.tool_calls) {
      return { role: 'assistant', content: row.content || null, tool_calls: row.tool_calls }
    }
    if (row.role === 'tool') {
      return { role: 'tool', tool_call_id: row.tool_call_id, content: JSON.stringify(row.tool_result) }
    }
    return { role: row.role, content: row.content }
  })

  // 7. Build system prompt
  const services = await getBusinessServices(admin, staff.business_id)

  const sectorValue = biz?.sector || 'other'
  const tutorialTopicObj = tutorialTopic ? findTopicByKey(tutorialTopic, sectorValue) : null
  const isTutorialMode = !!tutorialTopicObj

  let systemPrompt: string
  if (isTutorialMode && tutorialTopicObj) {
    systemPrompt = buildPageTutorialPrompt({
      topic: tutorialTopicObj,
      sector: sectorValue,
      staffName: staff.name,
      aiPreferences: biz?.settings?.ai_preferences,
    })
  } else if (isOnboarding) {
    systemPrompt = buildOnboardingSystemPrompt(biz?.name || '', sectorValue, staff.name)
  } else {
    systemPrompt = buildAssistantSystemPrompt({
      businessName: biz?.name || '',
      sector: sectorValue,
      staffName: staff.name,
      staffRole: role,
      permissions,
      workingHours: biz?.working_hours,
      services,
      aiPreferences: biz?.settings?.ai_preferences,
      origin,
    })
  }

  // 8. Save user message
  await admin.from('ai_messages').insert({
    conversation_id: convId,
    role: 'user',
    content: message,
  })

  // 9. Stream response
  const openai = getOpenAIClient()
  const allowedTools = filterAssistantTools(
    ASSISTANT_TOOLS,
    biz?.settings?.ai_permissions ?? null,
    permissions,
  )
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history,
    { role: 'user' as const, content: message },
  ]

  const encoder = new TextEncoder()
  let totalInputTokens = 0
  let totalOutputTokens = 0

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        let currentMessages = [...messages]
        let continueLoop = true

        while (continueLoop) {
          continueLoop = false

          const response = await openai.chat.completions.create({
            model: ASSISTANT_MODEL,
            max_tokens: ASSISTANT_MAX_TOKENS,
            messages: currentMessages,
            // Tutorial modunda tool çağrısı istenmez — kısa açıklama yanıtı beklenir
            ...(isTutorialMode || allowedTools.length === 0 ? {} : { tools: allowedTools }),
            stream: true,
          })

          let accumulatedContent = ''
          let accumulatedToolCalls: any[] = []
          let currentToolCall: { index: number; id: string; name: string; arguments: string } | null = null

          for await (const chunk of response) {
            const choice = chunk.choices[0]
            if (!choice) continue

            const delta = choice.delta

            // Text content
            if (delta?.content) {
              accumulatedContent += delta.content
              send({ type: 'text', content: delta.content })
            }

            // Tool calls
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.id) {
                  // New tool call
                  if (currentToolCall) {
                    accumulatedToolCalls.push({ ...currentToolCall })
                  }
                  currentToolCall = {
                    index: tc.index,
                    id: tc.id,
                    name: tc.function?.name || '',
                    arguments: tc.function?.arguments || '',
                  }
                } else if (currentToolCall) {
                  // Append to current
                  if (tc.function?.name) currentToolCall.name += tc.function.name
                  if (tc.function?.arguments) currentToolCall.arguments += tc.function.arguments
                }
              }
            }

            // Usage tracking
            if (chunk.usage) {
              totalInputTokens += chunk.usage.prompt_tokens || 0
              totalOutputTokens += chunk.usage.completion_tokens || 0
            }

            // Finish
            if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
              if (currentToolCall) {
                accumulatedToolCalls.push({ ...currentToolCall })
                currentToolCall = null
              }
            }
          }

          // Process tool calls if any
          if (accumulatedToolCalls.length > 0) {
            // Save assistant message with tool_calls
            const toolCallsFormatted = accumulatedToolCalls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: tc.arguments },
            }))

            await admin.from('ai_messages').insert({
              conversation_id: convId,
              role: 'assistant',
              content: accumulatedContent || null,
              tool_calls: toolCallsFormatted,
            })

            // Add assistant message to context
            currentMessages.push({
              role: 'assistant' as any,
              content: accumulatedContent || null,
              tool_calls: toolCallsFormatted,
            } as any)

            // Execute each tool
            for (const tc of accumulatedToolCalls) {
              const toolLabel = TOOL_LABELS[tc.name] || `${tc.name} çalışıyor...`
              send({ type: 'tool_start', name: tc.name, label: toolLabel })

              let parsedArgs: Record<string, any> = {}
              try {
                parsedArgs = JSON.parse(tc.arguments || '{}')
              } catch {}

              const result = await executeAssistantTool(tc.name, parsedArgs, { ...ctx, staffName: staff.name, conversationId: convId }, admin)

              const summary = result.success
                ? (result.requires_confirmation ? 'Onay bekliyor' : summarizeToolResult(tc.name, result.data))
                : result.error || 'Hata oluştu'
              send({ type: 'tool_end', name: tc.name, summary })

              // Emit rich UI blocks (Faz 9) for read-only tool results
              if (result.success && !result.requires_confirmation && result.data) {
                for (const block of deriveBlocksFromToolResult(tc.name, result.data)) {
                  send({ type: 'block', block })
                }
              }

              // If pending action, emit confirmation event to client (UI renders Onayla/İptal buttons)
              if (result.success && result.requires_confirmation) {
                send({
                  type: 'confirmation_required',
                  action_id: result.action_id,
                  action_type: result.action_type,
                  preview: result.preview,
                  details: result.details,
                })
              }

              // Save tool result
              await admin.from('ai_messages').insert({
                conversation_id: convId,
                role: 'tool',
                tool_name: tc.name,
                tool_call_id: tc.id,
                tool_result: result,
              })

              // Add tool result to context
              currentMessages.push({
                role: 'tool' as any,
                tool_call_id: tc.id,
                content: JSON.stringify(result),
              } as any)
            }

            // Continue the loop to get the final text response
            continueLoop = true
          } else {
            // Save final assistant message
            if (accumulatedContent) {
              await admin.from('ai_messages').insert({
                conversation_id: convId,
                role: 'assistant',
                content: accumulatedContent,
                tokens_used: totalOutputTokens,
              })
            }
          }
        }

        // 10. Update usage (usage row fetched in step 4 — sequential per user)
        if (usage) {
          await admin.from('ai_usage').update({
            message_count: (usage as any).message_count + 1,
            total_input_tokens: ((usage as any).total_input_tokens || 0) + totalInputTokens,
            total_output_tokens: ((usage as any).total_output_tokens || 0) + totalOutputTokens,
            updated_at: new Date().toISOString(),
          })
            .eq('business_id', staff.business_id)
            .eq('staff_id', staff.id)
            .eq('month', currentMonth)
        } else {
          await admin.from('ai_usage').insert({
            business_id: staff.business_id,
            staff_id: staff.id,
            month: currentMonth,
            message_count: 1,
            total_input_tokens: totalInputTokens,
            total_output_tokens: totalOutputTokens,
          })
        }

        send({ type: 'done', conversationId: convId })
        controller.close()
      } catch (err: any) {
        console.error('AI Assistant stream error:', err)
        send({ type: 'error', error: 'Bir hata oluştu. Lütfen tekrar deneyin.' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// ── Helpers ──

function sseResponse(events: any[]): Response {
  const encoder = new TextEncoder()
  const body = events.map(e => `data: ${JSON.stringify(e)}\n\n`).join('')
  return new Response(encoder.encode(body), {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  })
}

async function getBusinessServices(admin: ReturnType<typeof createAdminClient>, businessId: string) {
  const { data } = await admin
    .from('services')
    .select('name, duration_minutes, price')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(30)

  return (data || []) as Array<{ name: string; duration_minutes: number; price: number | null }>
}

function summarizeToolResult(toolName: string, data: any): string {
  if (!data) return 'Veri bulunamadı'

  switch (toolName) {
    case 'list_appointments':
      return `${data.toplam || 0} randevu bulundu`
    case 'get_available_slots':
      return `${(data.musait_saatler || []).length} müsait saat bulundu`
    case 'search_customers':
      return `${data.toplam || 0} müşteri bulundu`
    case 'get_customer_details':
      return `${data.isim} bilgileri getirildi`
    case 'list_services':
      return `${data.toplam || 0} hizmet listelendi`
    case 'list_packages':
      return `${data.toplam || 0} paket listelendi`
    case 'list_staff':
      return `${data.toplam || 0} personel listelendi`
    case 'get_staff_schedule':
      return `${data.personel} programı getirildi`
    case 'get_appointment_stats':
      return `${data.toplam || 0} randevu analiz edildi`
    case 'get_revenue_stats':
      return 'Gelir istatistikleri hesaplandı'
    case 'get_customer_stats':
      return `${data.toplam_musteri || 0} müşteri analiz edildi`
    case 'get_business_info':
      return 'İşletme bilgileri getirildi'
    case 'get_working_hours':
      return 'Çalışma saatleri getirildi'
    case 'list_pending_messages':
      return `${data.toplam || 0} bekleyen mesaj`
    case 'get_recent_messages':
      return `${data.toplam || 0} mesaj getirildi`
    case 'search_audit_logs':
      return `${data.toplam || 0} kayıt bulundu`
    case 'get_revenue_breakdown':
      return `${(data.breakdown || []).length} kalem, toplam ${data.totals?.revenue ?? 0}₺`
    case 'get_customer_lifetime_value':
      return `${(data.clv || []).length} müşteri analiz edildi`
    case 'get_occupancy_stats':
      return `Doluluk: %${data.overall_occupancy ?? 0}`
    case 'get_staff_performance':
      return `${(data.performance || []).length} personel analiz edildi`
    case 'get_expense_breakdown':
      return `${(data.breakdown || []).length} kategori, toplam ${data.total ?? 0}₺`
    case 'get_profit_loss':
      return `Net kâr: ${data.net_profit ?? 0}₺ (%${data.margin_percentage ?? 0})`
    case 'compare_periods':
      return `Dönem karşılaştırması hazırlandı`
    case 'detect_risk_customers':
      return `${data.toplam || 0} risk altında müşteri bulundu`
    case 'detect_anomalies':
      return `${(data.anomalies || []).length} anomali tespit edildi`
    case 'schedule_action':
      return data.message || '✓ Planlandı'
    case 'list_scheduled_actions':
      return `${data.count || 0} planlı eylem`
    case 'cancel_scheduled_action':
      return data.message || '✓ İptal edildi'
    case 'list_campaigns':
      return `${data.toplam || 0} kampanya listelendi`
    case 'estimate_campaign_audience':
      return `Tahmini hedef kitle: ${data.count || 0} kişi`
    case 'list_workflows':
      return `${data.toplam || 0} iş akışı listelendi`
    case 'list_blocked_slots':
      return `${data.toplam || 0} bloklu zaman dilimi`
    case 'list_shifts':
      return `${data.toplam || 0} vardiya listelendi`
    case 'list_unpaid_invoices':
      return `${data.toplam || 0} ödenmemiş fatura (toplam ${data.toplam_bakiye || 0}₺)`
    default:
      return 'İşlem tamamlandı'
  }
}
