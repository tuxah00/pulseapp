// RLS bypass: portal müşterisi Supabase auth user değil; business_id + customer_id filtresi her sorguda zorunlu
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Ortak portal sorguları — API route'larında tekrar tekrar yazılmasın diye.
 * Her fonksiyon service role admin client kullanır; ancak her sorgu
 * business_id + customer_id filtresi ile scope'lanır (oturum sahibi dışındaki
 * verilere erişilemez).
 */

export async function getCustomerVisibleRecords(businessId: string, customerId: string) {
  const admin = createAdminClient()
  return admin
    .from('business_records')
    .select('id, type, title, data, created_at, updated_at')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .eq('is_customer_visible', true)
    .order('created_at', { ascending: false })
}

export async function getCustomerVisiblePhotos(businessId: string, customerId: string) {
  const admin = createAdminClient()
  return admin
    .from('customer_photos')
    .select(`
      id, photo_url, photo_type, tags, notes, taken_at, protocol_id, session_id, appointment_id, created_at,
      protocol:treatment_protocols(id, name, service:services(id, name)),
      appointment:appointments(id, appointment_date, start_time, service:services(id, name))
    `)
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .eq('is_customer_visible', true)
    .order('taken_at', { ascending: false })
    .order('created_at', { ascending: false })
}

export async function getActiveProtocolsWithSessions(businessId: string, customerId: string) {
  const admin = createAdminClient()
  const { data: protocols, error } = await admin
    .from('treatment_protocols')
    .select(`
      id, name, total_sessions, completed_sessions, interval_days, status, notes, created_at,
      service:services(id, name),
      staff:staff_members!treatment_protocols_created_by_fkey(id, name),
      sessions:protocol_sessions(
        id, session_number, status, planned_date, completed_date, notes,
        post_care_notes, post_care_files,
        appointment:appointments(id, appointment_date, start_time, end_time)
      )
    `)
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  return { data: protocols, error }
}

export async function getCustomerPackages(businessId: string, customerId: string) {
  const admin = createAdminClient()
  return admin
    .from('customer_packages')
    .select(`
      id, package_name, sessions_total, sessions_used, price_paid, status,
      purchase_date, expiry_date, notes,
      service:services(id, name),
      usages:package_usages(
        id, used_at, notes,
        appointment:appointments(id, appointment_date, start_time)
      )
    `)
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .order('purchase_date', { ascending: false })
}
