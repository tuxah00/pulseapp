import { createClient } from '@supabase/supabase-js'

// DİKKAT: Bu client RLS'yi bypass eder!
// Sadece API route'larda ve cron job'larda kullan.
// ASLA client-side'da kullanma.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
