import { Sun } from 'lucide-react'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export default async function AiBriefWidget({ businessId }: { businessId: string }) {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('notifications')
    .select('id, title, body, created_at, is_read')
    .eq('business_id', businessId)
    .eq('type', 'ai_brief')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  const ageDays = data.created_at
    ? Math.floor((Date.now() - new Date(data.created_at).getTime()) / MS_PER_DAY)
    : null
  if (ageDays != null && ageDays > 1) return null

  const lines = (data.body || '').split('\n').map((l: string) => l.trim()).filter(Boolean)

  return (
    <div className="card space-y-3 border-l-4 border-amber-400">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
          <Sun className="h-4 w-4 text-amber-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{data.title}</p>
          <p className="text-xs text-gray-400">AI tarafından hazırlandı</p>
        </div>
      </div>
      <div className="space-y-1.5">
        {lines.map((line: string, i: number) => (
          <p key={i} className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
            {line.replace(/^[-•*]\s*/, '• ')}
          </p>
        ))}
      </div>
    </div>
  )
}
