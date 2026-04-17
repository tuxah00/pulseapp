import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'

/**
 * KVKK veri taşınabilirliği — müşterinin tüm verilerini JSON olarak döndürür.
 * Client tarafında dosya olarak indirilir.
 */
export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const admin = createAdminClient()

  const [
    customerRes,
    businessRes,
    apptsRes,
    invoicesRes,
    reviewsRes,
    feedbackRes,
    rewardsRes,
    loyaltyRes,
    txRes,
    recordsRes,
    photosRes,
    protocolsRes,
    packagesRes,
    consentsRes,
  ] = await Promise.all([
    admin.from('customers').select('id, name, phone, email, birthday, segment, total_visits, last_visit_at, preferred_channel, created_at').eq('id', customerId).eq('business_id', businessId).single(),
    admin.from('businesses').select('id, name, sector').eq('id', businessId).single(),
    admin.from('appointments').select('id, appointment_date, start_time, end_time, status, notes, services(name), staff_members(name)').eq('business_id', businessId).eq('customer_id', customerId).is('deleted_at', null).order('appointment_date', { ascending: false }),
    admin.from('invoices').select('id, total, paid_amount, status, issue_date, due_date').eq('business_id', businessId).eq('customer_id', customerId).is('deleted_at', null).order('issue_date', { ascending: false }),
    admin.from('reviews').select('id, rating, comment, status, created_at, actual_response').eq('business_id', businessId).eq('customer_id', customerId).order('created_at', { ascending: false }),
    admin.from('feedback').select('id, type, subject, message, status, response, responded_at, created_at').eq('business_id', businessId).eq('customer_id', customerId).order('created_at', { ascending: false }),
    admin.from('customer_rewards').select('id, status, given_at, used_at, expires_at, notes, reward:rewards(name, type, value)').eq('business_id', businessId).eq('customer_id', customerId).order('given_at', { ascending: false }),
    admin.from('loyalty_points').select('points_balance, tier, total_earned, total_spent').eq('business_id', businessId).eq('customer_id', customerId).maybeSingle(),
    admin.from('point_transactions').select('id, type, points, source, description, created_at').eq('business_id', businessId).eq('customer_id', customerId).order('created_at', { ascending: false }),
    admin.from('business_records').select('id, type, title, data, created_at').eq('business_id', businessId).eq('customer_id', customerId).eq('is_customer_visible', true).order('created_at', { ascending: false }),
    admin.from('customer_photos').select('id, photo_url, photo_type, taken_at, notes').eq('business_id', businessId).eq('customer_id', customerId).eq('is_customer_visible', true).order('taken_at', { ascending: false }),
    admin.from('treatment_protocols').select('id, name, status, total_sessions, completed_sessions, started_at, notes').eq('business_id', businessId).eq('customer_id', customerId).order('started_at', { ascending: false }),
    admin.from('customer_packages').select('id, package_name, sessions_total, sessions_used, status, purchase_date, expiry_date').eq('business_id', businessId).eq('customer_id', customerId).order('purchase_date', { ascending: false }),
    admin.from('consent_records').select('id, consent_type, given_at, revoked_at, method').eq('business_id', businessId).eq('customer_id', customerId).order('given_at', { ascending: false }),
  ])

  const exportData = {
    exportedAt: new Date().toISOString(),
    version: 1,
    business: businessRes.data || null,
    customer: customerRes.data || null,
    appointments: apptsRes.data || [],
    invoices: invoicesRes.data || [],
    reviews: reviewsRes.data || [],
    feedback: feedbackRes.data || [],
    rewards: rewardsRes.data || [],
    loyalty: loyaltyRes.data || null,
    pointTransactions: txRes.data || [],
    records: recordsRes.data || [],
    photos: photosRes.data || [],
    treatmentProtocols: protocolsRes.data || [],
    packages: packagesRes.data || [],
    consents: consentsRes.data || [],
  }

  const filename = `pulseapp-veri-${businessId.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.json`

  return new NextResponse(JSON.stringify(exportData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
