import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Verify that the authenticated user is a staff member of the given business.
 * Returns the staff row on success, `null` on failure.
 *
 * Used as defense-in-depth on top of Supabase RLS — reject requests where the
 * caller supplies a `businessId` query param / body field that belongs to
 * another tenant.
 */
export async function verifyBusinessAccess(
  supabase: SupabaseClient,
  userId: string,
  businessId: string
): Promise<{ id: string; business_id: string; role: string } | null> {
  const { data } = await supabase
    .from('staff_members')
    .select('id, business_id, role')
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .single()
  return data as { id: string; business_id: string; role: string } | null
}
