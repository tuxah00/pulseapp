import type { createAdminClient } from '@/lib/supabase/admin'
import type { AuthContext } from '@/lib/api/with-permission'
import { logAuditServer } from '@/lib/utils/audit'
import { sendCampaign } from '@/lib/campaigns/send'
import { generateInvoiceNumber, generateReceiptNumber } from '@/lib/invoices/numbering'
import { deductStockFromItems } from '@/lib/invoices/stock'
import { computeInvoiceTotals } from '@/lib/invoices/calc'
import type { InvoiceItem } from '@/types'

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
  | 'update_working_hours'
  | 'create_blocked_slot'
  | 'delete_blocked_slot'
  | 'assign_shift'
  | 'create_shift_definition'
  | 'invite_staff'
  | 'update_staff_permissions'
  | 'update_business_settings'
  | 'create_invoice'
  | 'record_invoice_payment'
  | 'generate_invoice_from_appointment'
  | 'create_pos_transaction'
  | 'record_expense'
  | 'record_manual_income'

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
      case 'update_working_hours':
        result = await execUpdateWorkingHours(admin, ctx, payload)
        break
      case 'create_blocked_slot':
        result = await execCreateBlockedSlot(admin, ctx, payload)
        break
      case 'delete_blocked_slot':
        result = await execDeleteBlockedSlot(admin, ctx, payload)
        break
      case 'assign_shift':
        result = await execAssignShift(admin, ctx, payload)
        break
      case 'create_shift_definition':
        result = await execCreateShiftDefinition(admin, ctx, payload)
        break
      case 'invite_staff':
        result = await execInviteStaff(admin, ctx, payload)
        break
      case 'update_staff_permissions':
        result = await execUpdateStaffPermissions(admin, ctx, payload)
        break
      case 'update_business_settings':
        result = await execUpdateBusinessSettings(admin, ctx, payload)
        break
      case 'create_invoice':
        result = await execCreateInvoice(admin, ctx, payload)
        break
      case 'record_invoice_payment':
        result = await execRecordInvoicePayment(admin, ctx, payload)
        break
      case 'generate_invoice_from_appointment':
        result = await execGenerateInvoiceFromAppointment(admin, ctx, payload)
        break
      case 'create_pos_transaction':
        result = await execCreatePosTransaction(admin, ctx, payload)
        break
      case 'record_expense':
        result = await execRecordExpense(admin, ctx, payload)
        break
      case 'record_manual_income':
        result = await execRecordManualIncome(admin, ctx, payload)
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

// ── Faz 7: Sistem Yönetimi Executors ─────────────────────────────────

async function execUpdateWorkingHours(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const { error } = await admin
    .from('businesses')
    .update({ working_hours: p.working_hours })
    .eq('id', ctx.businessId)

  if (error) return { ok: false, message: 'Güncelleme başarısız: ' + error.message }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'update',
    resource: 'settings',
    details: { via: 'ai_assistant', field: 'working_hours' },
  })

  return { ok: true, message: '✓ Çalışma saatleri güncellendi' }
}

async function execCreateBlockedSlot(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const { data, error } = await admin.from('blocked_slots').insert({
    business_id: ctx.businessId,
    date: p.date,
    start_time: p.start_time,
    end_time: p.end_time,
    staff_id: p.staff_id,
    reason: p.reason,
  }).select('id').single()

  if (error || !data) return { ok: false, message: 'Blok oluşturulamadı: ' + (error?.message || '') }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'create',
    resource: 'appointment',
    resourceId: data.id,
    details: { via: 'ai_assistant', kind: 'blocked_slot', date: p.date },
  })

  return { ok: true, message: '✓ Zaman dilimi bloklandı', data: { id: data.id } }
}

async function execDeleteBlockedSlot(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const { error } = await admin
    .from('blocked_slots')
    .delete()
    .eq('id', p.blocked_slot_id)
    .eq('business_id', ctx.businessId)

  if (error) return { ok: false, message: 'Silme başarısız: ' + error.message }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'delete',
    resource: 'appointment',
    resourceId: p.blocked_slot_id,
    details: { via: 'ai_assistant', kind: 'blocked_slot' },
  })

  return { ok: true, message: '✓ Blok kaldırıldı' }
}

async function execAssignShift(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const { data, error } = await admin.from('shifts').upsert({
    business_id: ctx.businessId,
    staff_id: p.staff_id,
    shift_date: p.shift_date,
    start_time: p.start_time,
    end_time: p.end_time,
    shift_type: p.shift_type,
    notes: p.notes,
  }, { onConflict: 'business_id,staff_id,shift_date' }).select('id').single()

  if (error || !data) return { ok: false, message: 'Vardiya atanamadı: ' + (error?.message || '') }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'create',
    resource: 'shift',
    resourceId: data.id,
    details: { via: 'ai_assistant', shift_date: p.shift_date, shift_type: p.shift_type },
  })

  return { ok: true, message: '✓ Vardiya atandı', data: { id: data.id } }
}

async function execCreateShiftDefinition(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const { data: biz } = await admin
    .from('businesses').select('settings').eq('id', ctx.businessId).single()

  const settings = (biz?.settings || {}) as Record<string, any>
  const defs = Array.isArray(settings.shift_definitions) ? settings.shift_definitions : []
  const next = [...defs, { name: p.name, start: p.start, end: p.end }]

  const { error } = await admin
    .from('businesses')
    .update({ settings: { ...settings, shift_definitions: next } })
    .eq('id', ctx.businessId)

  if (error) return { ok: false, message: 'Kaydedilemedi: ' + error.message }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'update',
    resource: 'settings',
    details: { via: 'ai_assistant', field: 'shift_definitions', added: p.name },
  })

  return { ok: true, message: `✓ Mesai tanımı eklendi: ${p.name}` }
}

async function execInviteStaff(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const { data, error } = await admin.from('staff_invitations').insert({
    business_id: ctx.businessId,
    invited_by: ctx.staffId,
    email: p.email,
    role: p.role,
  }).select('token').single()

  if (error || !data) return { ok: false, message: 'Davet oluşturulamadı: ' + (error?.message || '') }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'create',
    resource: 'staff',
    details: { via: 'ai_assistant', kind: 'invitation', role: p.role, email: p.email },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pulseapp.vercel.app'
  const link = `${appUrl}/invite/${data.token}`
  return { ok: true, message: `✓ Davet linki oluşturuldu: ${link}`, data: { token: data.token, link } }
}

async function execUpdateStaffPermissions(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  // Merge with current permissions so partial updates work
  const merged = { ...(p.current || {}), ...(p.permissions || {}) }

  const { error } = await admin
    .from('staff_members')
    .update({ permissions: merged })
    .eq('id', p.staff_id)
    .eq('business_id', ctx.businessId)

  if (error) return { ok: false, message: 'Güncelleme başarısız: ' + error.message }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'update',
    resource: 'permissions',
    resourceId: p.staff_id,
    details: { via: 'ai_assistant', changes: JSON.stringify(p.permissions) },
  })

  return { ok: true, message: '✓ Yetkiler güncellendi' }
}

async function execUpdateBusinessSettings(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const { data: biz } = await admin
    .from('businesses').select('settings').eq('id', ctx.businessId).single()

  const current = (biz?.settings || {}) as Record<string, unknown>
  const incoming = (p.settings || {}) as Record<string, unknown>
  const merged: Record<string, unknown> = { ...current, ...incoming }

  // Nested-merge: ai_preferences, ai_memory — kullanıcı sadece tek alan değişse bile
  // tüm alt anahtarları silmesin
  for (const key of ['ai_preferences', 'ai_memory'] as const) {
    if (incoming[key] && typeof incoming[key] === 'object') {
      merged[key] = { ...(current[key] as Record<string, unknown> || {}), ...(incoming[key] as Record<string, unknown>) }
    }
  }

  const { error } = await admin
    .from('businesses')
    .update({ settings: merged })
    .eq('id', ctx.businessId)

  if (error) return { ok: false, message: 'Güncelleme başarısız: ' + error.message }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'update',
    resource: 'settings',
    details: { via: 'ai_assistant', updated_keys: Object.keys(p.settings || {}).join(',') },
  })

  return { ok: true, message: '✓ İşletme ayarları güncellendi' }
}

// ─── Faz 8: Finans Executors ──────────────────────────────────────────

/** Shared invoice insert helper — totals hesaplar, kaydı atar, audit log yazar */
async function insertInvoice(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  params: {
    customer_id: string
    items: InvoiceItem[]
    tax_rate?: number
    discount_amount?: number
    discount_type?: 'percentage' | 'fixed' | null
    due_date?: string | null
    notes?: string | null
    appointment_id?: string | null
    auditDetails?: Record<string, string | number | boolean | null>
  },
): Promise<ActionExecuteResult> {
  const subtotal = params.items.reduce((s, it) => s + (Number(it.total) || 0), 0)
  const totals = computeInvoiceTotals({
    subtotal,
    tax_rate: params.tax_rate,
    discount_amount: params.discount_amount,
    discount_type: params.discount_type,
  })

  const invoiceNumber = await generateInvoiceNumber(admin, ctx.businessId)
  const { data, error } = await admin
    .from('invoices')
    .insert({
      business_id: ctx.businessId,
      customer_id: params.customer_id,
      appointment_id: params.appointment_id || null,
      invoice_number: invoiceNumber,
      items: params.items,
      subtotal: totals.subtotal,
      tax_rate: params.tax_rate || 0,
      tax_amount: totals.tax_amount,
      total: totals.total,
      paid_amount: 0,
      status: 'pending',
      discount_amount: totals.discount_value,
      discount_type: params.discount_type || null,
      due_date: params.due_date || null,
      notes: params.notes || null,
      staff_id: ctx.staffId,
      staff_name: ctx.staffName,
      payment_type: 'standard',
    })
    .select('id, invoice_number, total')
    .single()

  if (error || !data) return { ok: false, message: 'Fatura oluşturulamadı: ' + (error?.message || '') }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'create',
    resource: 'invoice',
    resourceId: data.id,
    details: {
      via: 'ai_assistant',
      invoice_number: data.invoice_number,
      total: data.total,
      ...(params.auditDetails || {}),
    },
  })

  return { ok: true, message: `✓ Fatura ${data.invoice_number} oluşturuldu (${data.total}₺)`, data: { id: data.id } }
}

async function execCreateInvoice(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  return insertInvoice(admin, ctx, {
    customer_id: p.customer_id,
    items: p.items as InvoiceItem[],
    tax_rate: p.tax_rate,
    discount_amount: p.discount_amount,
    discount_type: p.discount_type,
    due_date: p.due_date,
    notes: p.notes,
  })
}

async function execRecordInvoicePayment(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const { data: invoice } = await admin
    .from('invoices')
    .select('id, business_id, invoice_number, total, paid_amount, status, items')
    .eq('id', p.invoice_id)
    .eq('business_id', ctx.businessId)
    .is('deleted_at', null)
    .single()

  if (!invoice) return { ok: false, message: 'Fatura bulunamadı' }

  const isRefund = p.payment_type === 'refund'
  const signedAmount = isRefund ? -Math.abs(p.amount) : Math.abs(p.amount)

  const { error: payErr } = await admin.from('invoice_payments').insert({
    business_id: invoice.business_id,
    invoice_id: invoice.id,
    amount: Math.abs(p.amount),
    method: p.method,
    payment_type: p.payment_type || 'payment',
    installment_number: p.installment_number || null,
    notes: p.notes || null,
    staff_id: ctx.staffId,
    staff_name: ctx.staffName,
  })
  if (payErr) return { ok: false, message: 'Ödeme kaydedilemedi: ' + payErr.message }

  const newPaid = Math.max(0, (Number(invoice.paid_amount) || 0) + signedAmount)
  const total = Number(invoice.total) || 0
  const newStatus = newPaid >= total ? 'paid' : newPaid > 0 ? 'partial' : 'pending'
  const updateObj: Record<string, unknown> = {
    paid_amount: newPaid,
    status: newStatus,
    updated_at: new Date().toISOString(),
  }
  if (newStatus === 'paid') {
    updateObj.paid_at = new Date().toISOString()
    updateObj.payment_method = p.method
  }

  const { error: upErr } = await admin
    .from('invoices')
    .update(updateObj)
    .eq('id', invoice.id)
  if (upErr) return { ok: false, message: 'Fatura güncellenemedi: ' + upErr.message }

  // Tam ödeme tamamlandıysa stok düş (standart akışla tutarlı)
  if (newStatus === 'paid' && invoice.status !== 'paid' && Array.isArray(invoice.items)) {
    await deductStockFromItems(admin, invoice.items as InvoiceItem[], {
      businessId: invoice.business_id,
      invoiceNumber: invoice.invoice_number,
    })
  }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'pay',
    resource: 'invoice',
    resourceId: invoice.id,
    details: {
      via: 'ai_assistant',
      invoice_number: invoice.invoice_number,
      amount: p.amount,
      method: p.method,
      new_status: newStatus,
    },
  })

  return { ok: true, message: `✓ Ödeme kaydedildi (${invoice.invoice_number}) — durum: ${newStatus}` }
}

async function execGenerateInvoiceFromAppointment(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const result = await insertInvoice(admin, ctx, {
    customer_id: p.customer_id,
    items: p.items as InvoiceItem[],
    tax_rate: p.tax_rate,
    appointment_id: p.appointment_id,
    auditDetails: { source: 'appointment', appointment_id: p.appointment_id },
  })
  if (!result.ok) return result
  return { ...result, message: result.message.replace('oluşturuldu', 'randevudan oluşturuldu') }
}

async function execCreatePosTransaction(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  const receipt_number = await generateReceiptNumber(admin, ctx.businessId)

  const payments = [{ method: p.payment_method, amount: p.total }]

  const { data, error } = await admin
    .from('pos_transactions')
    .insert({
      business_id: ctx.businessId,
      customer_id: p.customer_id || null,
      staff_id: ctx.staffId,
      transaction_type: 'sale',
      items: p.items,
      subtotal: p.subtotal,
      discount_amount: p.discount_amount || 0,
      tax_amount: 0,
      total: p.total,
      payments,
      payment_status: 'paid',
      receipt_number,
      notes: p.notes || null,
    })
    .select('id, receipt_number, total')
    .single()

  if (error || !data) return { ok: false, message: 'POS satışı oluşturulamadı: ' + (error?.message || '') }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'create',
    resource: 'pos_transaction',
    resourceId: data.id,
    details: {
      via: 'ai_assistant',
      receipt_number: data.receipt_number,
      total: data.total,
      method: p.payment_method,
    },
  })

  return { ok: true, message: `✓ POS satışı kaydedildi (${data.receipt_number})`, data: { id: data.id } }
}

async function execLedgerEntry(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
  kind: 'expense' | 'income',
): Promise<ActionExecuteResult> {
  const table = kind === 'expense' ? 'expenses' : 'income'
  const dateCol = kind === 'expense' ? 'expense_date' : 'income_date'
  const row: Record<string, unknown> = {
    business_id: ctx.businessId,
    category: p.category,
    description: p.description || null,
    amount: p.amount,
    [dateCol]: p.date,
    is_recurring: !!p.is_recurring,
    recurring_period: p.recurring_period || null,
    custom_interval_days: p.custom_interval_days || null,
  }

  const { data, error } = await admin.from(table).insert(row).select('id').single()
  if (error || !data) {
    const label = kind === 'expense' ? 'Gider' : 'Gelir'
    return { ok: false, message: `${label} kaydedilemedi: ` + (error?.message || '') }
  }

  await logAuditServer({
    businessId: ctx.businessId,
    staffId: ctx.staffId,
    staffName: ctx.staffName,
    action: 'create',
    resource: kind,
    resourceId: data.id,
    details: { via: 'ai_assistant', category: p.category, amount: p.amount },
  })

  const label = kind === 'expense' ? 'Gider' : 'Gelir'
  return { ok: true, message: `✓ ${label} kaydedildi (${p.category} — ${p.amount}₺)` }
}

async function execRecordExpense(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  return execLedgerEntry(admin, ctx, p, 'expense')
}

async function execRecordManualIncome(
  admin: SupabaseAdmin,
  ctx: ExecutorCtx,
  p: Record<string, any>,
): Promise<ActionExecuteResult> {
  return execLedgerEntry(admin, ctx, p, 'income')
}
