import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Singleton browser client — client componentlerde ve hook'larda
// her render'da yeni bir instance yaratmak yerine tek bir örnek kullanılır.
// Bu, useCallback/useEffect bağımlılık listelerinde `supabase` referansının
// stabil kalmasını sağlar ve gereksiz re-fetch'leri engeller.
let browserClient: SupabaseClient | null = null

export function createClient() {
  if (browserClient) return browserClient
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  return browserClient
}
