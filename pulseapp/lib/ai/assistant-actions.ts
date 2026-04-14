import type { createAdminClient } from '@/lib/supabase/admin'
import type { AuthContext } from '@/lib/api/with-permission'
import { logAuditServer } from '@/lib/utils/audit'
import { sendCampaign } from '@/lib/campaigns/send'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

export type PendingActionType =
  | 'create_appointment'
  | 'cancel_appointment'
  | 'update_appointment_status'
  | 'reschedule_appointment'
  | 'create_customer'
  | 'update_customer'
  | 'delete_customer'
  | 'create_service'
  | 'update_service'
  | 'send_message'
  | 'create_campaign'
  | 'send_campaign'
  | 'create_workflow'
  | 'toggle_workflow'

export interface ConfirmationRequired {
  success: true
  requires_confirmation: true
  action_id: string
  action_type: PendingActionType
  preview: string
  details: Record<string, any>
}

export async function createPendingAction(
  admin: SupabaseAdmin,
  ctx: AuthContext & { conversationId?: string | null },
  actionType: PendingActionType,
  payload: Record<string, any>,
  preview: string,
  details: Record<string, any> = {},
  options: { scheduledFor?: string | null } = {},
): Promise<ConfirmationRequired | { success: false; error: string }> {
  const scheduledFor = options.scheduledFor || null
  const { data, error } = await admin
    .from('ai_pending_actions')
    .insert({
      business_id: ctx.businessId,
      staff_id: ctx.staffId,
      conversation_id: ctx.conversationId || null,
      action_type: actionType,
      payload,
      preview,
      scheduled_for: scheduledFor,
      status: scheduledFor ? 'scheduled' : 'pending',
    })
    .select('id')
    .single()

  if (error || !data) {
    return { success: false, error: 'Eylem kaydedilemedi' }
  }

  return {
    success: true,
    requires_confirmation: true,
    action_id: data.id,
    action_type: actionType,
    preview,
    details: { ...details, ...(scheduledFor ? { scheduled_for: scheduledFor } : {}) },
  }
}

export interface ActionExecuteResult {
  ok: boolean
  message: string
  data?: any
}

/**
 * Bekleyen aksiyonu yürütür. Dispatch table burada.
 * Her action type için executor fonksiyonu çalıştırılır.
 */
export type ExecutorCtx = {
  businessId: string
  staffId: string
  staffName: string
}

export async function executePendingAction(
  admin: SupabaseAdmin,
  actionId: string,
  ctx: ExecutorCtx,
): Promise<ActionExecuteResult> {
  // Load pending action
  const { data: action, error } = await admin
    .from('ai_pending_actions')
    .select('*')
    .eq('id', actionId)
    .single()

  if (error || !action) return { ok: false, message: 'Eylem bulunamadı' }
  if (action.status !== 'pending' && action.status !== 'scheduled') {
    return { ok: false, message: 'Bu eylem zaten işlenmiş' }
  }
  if (action.staff_id !== ctx.staffId) return { ok: false, message: 'Yetkisiz erişim' }
  if (new Date(action.expires_at) < new Date()) {
    await admin.from('ai_pending_actions').update({ status: 'expired' }).eq('id', actionId)
    return { ok: false, message: 'Bu eylem zaman aşımına uğradı, lütfen tekrar sorun' }
  }

  const payload = action.payload as Record<string, any>
  let result: ActionExecuteResult

  try {
    switch (action.action_type as PendingActionType) {
      case 'create_appointment':
        result = await execCreateAppointment(admin, ctx, payload)
        break
      case 'cancel_appointment':
        result = await execCancelAppointment(admin, ctx, payload)
        break
      case 'update_appointment_status':
        result = await execUpdateAppointmentStatus(admin, ctx, payload)
        break
      case 'reschedule_appointment':
        result = await execRescheduleAppointment(admin, ctx, payload)
        break
      case 'create_customer':
        result = await execCreateCustomer(admin, ctx, payload)
        break
      case 'update_customer':
        result = await execUpdateCustomer(admin, ctx, payload)
        break
      case 'delete_customer':
        result = await execDeleteCustomer(admin, ctx, payload)
        break
      case 'create_service':
        result = await execCreateService(admin, ctx, payload)
        break
      case 'update_service':
        result = await execUpdateService(admin, ctx, payload)
        break
      case 'send_message':
        result = await execSendMessage(admin, ctx, payload)
        break
      case 'create_campaign':
        result = await execCreateCampaign(admin, ctx, payload)
        break
      case 'send_campaign':
        result = await execSendCampaign(admin, ctx, payload)
        break
      case 'create_workflow':
        result = await execCreateWorkflow(admin, ctx, payload)
        break
      case 'toggle_workflow':
        result = await execToggleWorkflow(admin, ctx, payload)
        break
      default:
        result = { ok: false, message: 'Bilinmeyen eylem türü' }
    }
  } catch (err: any) {
    console.error('executePendingAction error:', err)
    result = { ok: false, message: 'İşlem sırasında hata oluştu' }
  }

  // Update pending action row. On fail: scheduled → 'failed' (runner won't retry);
  // pending → stay 'pending' (user can retry).
  const wasScheduled = action.status === 'scheduled'
  await admin
    .from('ai_pending_actions')
    .update({
      status: result.ok ? 'executed' : (wasScheduled ? 'failed' : 'pending'),
      executed_at: result.ok ? new Date().toISOString() : null,
      result: { ok: result.ok, message: result.message },
    })
    .eq('id', actionId)

  return result
}

export async function cancelPendingAction(
  admin: SupabaseAdmin,
  actionId: string,
  staffId: string,
  businessId?: string,
): Promise<{ ok: boolean; message: string }> {
  const { data: action } = await admin
    .from('ai_pending_actions')
    .select('staff_id, business_id, status, preview')
    .eq('id', actionId)
    .single()

  if (!action) return { ok: false, message: 'Eylem bulunamadı' }
  if (action.staff_id !== staffId) return { ok: false, message: 'Yetkisiz' }
  if (businessId && action.business_id !== businessId) return { ok: false, message: 'Yetkisiz' }
  if (action.status !== 'pending' && action.status !== 'scheduled') {
    return { ok: false, message: 'Zaten işlenmiş' }
  }

  await admin.from('ai_pending_actions').update({ status: 'cancelled' }).eq('id', actionId)
  return { ok: true, message: 'İptal edildi' }
}

// ─── Executors ─────────────────────────────────────────────────────────

async function execCreateAppointment(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  // Re-check conflict just before insert
  const { data: conflict } = await admin
    .from('appointments')
    .select('id')
    .eq('business_id', ctx.businessId)
    .eq('staff_id', p.staff_id || ctx.staffId)
    .eq('appointment_date', p.date)
    .is('deleted_at', null)
    .in('status', ['pending', 'confirmed'])
    .or(`and(start_time.lt.${p.end_time},end_time.gt.${p.start_time})`)
    .limit(1)

  if (conflict && conflict.length > 0) {
    return { ok: false, message: 'Bu saat için çakışan bir randevu bulunuyor' }
  }

  const { data, error } = await admin.from('appointments').insert({
    business_id: ctx.businessId,
    customer_id: p.customer_id,
    service_id: p.service_id,
    staff_id: p.staff_id || ctx.staffId,
    appointment_date: p.date,
    start_time: p.start_time,
    end_time: p.end_time,
    status: 'confirmed',
    notes: p.notes || null,
    source: 'ai_assistant',
  }).select('id').single()

  if (error || !data) return { ok: false, message: 'Randevu oluşturulamadı: ' + (error?.message || '') }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'create',
    resource: 'appointment',
    resourceId: data.id,
    details: { via: 'ai_assistant', ...p },
  })

  return { ok: true, message: `✓ Randevu oluşturuldu`, data: { id: data.id } }
}

async function execCancelAppointment(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const { error } = await admin
    .from('appointments')
    .update({ deleted_at: new Date().toISOString(), status: 'cancelled' })
    .eq('id', p.appointment_id)
    .eq('business_id', ctx.businessId)

  if (error) return { ok: false, message: 'İptal başarısız: ' + error.message }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'cancel',
    resource: 'appointment',
    resourceId: p.appointment_id,
    details: { via: 'ai_assistant' },
  })

  return { ok: true, message: '✓ Randevu iptal edildi' }
}

async function execUpdateAppointmentStatus(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const { error } = await admin
    .from('appointments')
    .update({ status: p.status })
    .eq('id', p.appointment_id)
    .eq('business_id', ctx.businessId)

  if (error) return { ok: false, message: 'Güncelleme başarısız: ' + error.message }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'status_change',
    resource: 'appointment',
    resourceId: p.appointment_id,
    details: { via: 'ai_assistant', new_status: p.status },
  })

  return { ok: true, message: `✓ Randevu durumu güncellendi: ${p.status}` }
}

async function execRescheduleAppointment(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const { error } = await admin
    .from('appointments')
    .update({
      appointment_date: p.new_date,
      start_time: p.new_start_time,
      end_time: p.new_end_time,
      status: 'pending',
    })
    .eq('id', p.appointment_id)
    .eq('business_id', ctx.businessId)

  if (error) return { ok: false, message: 'Erteleme başarısız: ' + error.message }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'update',
    resource: 'appointment',
    resourceId: p.appointment_id,
    details: { via: 'ai_assistant', new_date: p.new_date, new_time: p.new_start_time },
  })

  return { ok: true, message: '✓ Randevu ertelendi' }
}

async function execCreateCustomer(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const { data, error } = await admin.from('customers').insert({
    business_id: ctx.businessId,
    name: p.name,
    phone: p.phone,
    email: p.email || null,
    birthday: p.birthday || null,
    notes: p.notes || null,
    segment: 'new',
    is_active: true,
  }).select('id').single()

  if (error || !data) return { ok: false, message: 'Müşteri oluşturulamadı: ' + (error?.message || '') }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'create',
    resource: 'customer',
    resourceId: data.id,
    details: { via: 'ai_assistant', name: p.name },
  })

  return { ok: true, message: `✓ ${p.name} müşteri olarak eklendi`, data: { id: data.id } }
}

async function execUpdateCustomer(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const updates: Record<string, any> = {}
  if (p.name !== undefined) updates.name = p.name
  if (p.phone !== undefined) updates.phone = p.phone
  if (p.email !== undefined) updates.email = p.email
  if (p.notes !== undefined) updates.notes = p.notes
  if (p.segment !== undefined) updates.segment = p.segment
  if (p.preferred_channel !== undefined) updates.preferred_channel = p.preferred_channel

  const { error } = await admin
    .from('customers')
    .update(updates)
    .eq('id', p.customer_id)
    .eq('business_id', ctx.businessId)

  if (error) return { ok: false, message: 'Güncelleme başarısız: ' + error.message }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'update',
    resource: 'customer',
    resourceId: p.customer_id,
    details: { via: 'ai_assistant', updates: JSON.stringify(updates) },
  })

  return { ok: true, message: '✓ Müşteri bilgileri güncellendi' }
}

async function execDeleteCustomer(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const { error } = await admin
    .from('customers')
    .update({ is_active: false })
    .eq('id', p.customer_id)
    .eq('business_id', ctx.businessId)

  if (error) return { ok: false, message: 'Silme başarısız: ' + error.message }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'delete',
    resource: 'customer',
    resourceId: p.customer_id,
    details: { via: 'ai_assistant' },
  })

  return { ok: true, message: '✓ Müşteri pasifleştirildi' }
}

async function execCreateService(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const { data, error } = await admin.from('services').insert({
    business_id: ctx.businessId,
    name: p.name,
    duration_minutes: p.duration_minutes,
    price: p.price ?? null,
    description: p.description || null,
    is_active: true,
  }).select('id').single()

  if (error || !data) return { ok: false, message: 'Hizmet oluşturulamadı: ' + (error?.message || '') }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'create',
    resource: 'service',
    resourceId: data.id,
    details: { via: 'ai_assistant', name: p.name },
  })

  return { ok: true, message: `✓ ${p.name} hizmeti eklendi`, data: { id: data.id } }
}

async function execUpdateService(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const updates: Record<string, any> = {}
  if (p.name !== undefined) updates.name = p.name
  if (p.duration_minutes !== undefined) updates.duration_minutes = p.duration_minutes
  if (p.price !== undefined) updates.price = p.price
  if (p.description !== undefined) updates.description = p.description
  if (p.is_active !== undefined) updates.is_active = p.is_active

  const { error } = await admin
    .from('services')
    .update(updates)
    .eq('id', p.service_id)
    .eq('business_id', ctx.businessId)

  if (error) return { ok: false, message: 'Güncelleme başarısız: ' + error.message }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'update',
    resource: 'service',
    resourceId: p.service_id,
    details: { via: 'ai_assistant', updates: JSON.stringify(updates) },
  })

  return { ok: true, message: '✓ Hizmet güncellendi' }
}

async function execSendMessage(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  // Insert message row (outbound); actual SMS/WhatsApp sending is handled by existing pipeline
  const { data, error } = await admin.from('messages').insert({
    business_id: ctx.businessId,
    customer_id: p.customer_id,
    direction: 'outbound',
    channel: p.channel || 'sms',
    content: p.content,
    status: 'pending',
    staff_id: ctx.staffId,
    staff_name: ctx.staffName,
  }).select('id').single()

  if (error || !data) return { ok: false, message: 'Mesaj kaydedilemedi: ' + (error?.message || '') }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'send',
    resource: 'message',
    resourceId: data.id,
    details: { via: 'ai_assistant', channel: p.channel, customer_id: p.customer_id },
  })

  return { ok: true, message: '✓ Mesaj gönderildi', data: { id: data.id } }
}

// ── Faz 6: Campaign & Workflow Executors ─────────────────────────────

async function execCreateCampaign(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const { data, error } = await admin.from('campaigns').insert({
    business_id: ctx.businessId,
    name: p.name,
    description: p.description || null,
    segment_filter: p.segment_filter || {},
    message_template: p.message_template,
    channel: p.channel || 'auto',
    scheduled_at: p.scheduled_at || null,
    status: p.scheduled_at ? 'scheduled' : 'draft',
    created_by_staff_id: ctx.staffId,
  }).select('id').single()

  if (error || !data) return { ok: false, message: 'Kampanya oluşturulamadı: ' + (error?.message || '') }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'create',
    resource: 'campaign',
    resourceId: data.id,
    details: { via: 'ai_assistant', name: p.name },
  })

  return { ok: true, message: `✓ Kampanya oluşturuldu: ${p.name}`, data: { id: data.id } }
}

async function execSendCampaign(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const { data: camp, error: loadErr } = await admin
    .from('campaigns')
    .select('id, status, segment_filter, message_template, channel')
    .eq('id', p.campaign_id)
    .eq('business_id', ctx.businessId)
    .single()

  if (loadErr || !camp) return { ok: false, message: 'Kampanya bulunamadı' }
  if (!['draft', 'scheduled'].includes(camp.status)) {
    return { ok: false, message: `Kampanya durumu uygun değil: ${camp.status}` }
  }

  // Mark as sending; the real send happens via sendCampaign helper (reused)
  await admin.from('campaigns').update({ status: 'sending' }).eq('id', camp.id)

  // Fire-and-await send (may take a while for large audiences)
  await sendCampaign(
    admin,
    camp.id,
    ctx.businessId,
    camp.segment_filter || {},
    camp.message_template,
    camp.channel || 'auto',
  )

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'send',
    resource: 'campaign',
    resourceId: camp.id,
    details: { via: 'ai_assistant' },
  })

  return { ok: true, message: '✓ Kampanya gönderildi', data: { id: camp.id } }
}

async function execCreateWorkflow(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const { data, error } = await admin.from('workflows').insert({
    business_id: ctx.businessId,
    name: p.name,
    trigger_type: p.trigger_type,
    steps: p.steps,
    is_active: true,
  }).select('id').single()

  if (error || !data) return { ok: false, message: 'İş akışı oluşturulamadı: ' + (error?.message || '') }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'create',
    resource: 'workflow',
    resourceId: data.id,
    details: { via: 'ai_assistant', name: p.name, trigger_type: p.trigger_type },
  })

  return { ok: true, message: `✓ İş akışı oluşturuldu: ${p.name}`, data: { id: data.id } }
}

async function execToggleWorkflow(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const { error } = await admin
    .from('workflows')
    .update({ is_active: p.is_active, updated_at: new Date().toISOString() })
    .eq('id', p.workflow_id)
    .eq('business_id', ctx.businessId)

  if (error) return { ok: false, message: 'Güncelleme başarısız: ' + error.message }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'update',
    resource: 'workflow',
    resourceId: p.workflow_id,
    details: { via: 'ai_assistant', is_active: p.is_active },
  })

  return { ok: true, message: p.is_active ? '✓ İş akışı aktifleştirildi' : '✓ İş akışı pasifleştirildi' }
}
