'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { formatDateISO } from '@/lib/utils'

export default function PerformanceStats() {
  const { businessId, loading: ctxLoading } = useBusinessContext()
  const [appointments, setAppointments] = useState<{ status: string }[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    if (!businessId) return
    const start = new Date()
    start.setDate(start.getDate() - 30)
    const startStr = formatDateISO(start)

    const aptRes = await supabase.from('appointments')
      .select('status')
      .eq('business_id', businessId)
      .gte('appointment_date', startStr)
      .is('deleted_at', null)

    if (aptRes.data) setAppointments(aptRes.data)
    setLoading(false)
  }, [businessId, supabase])

  useEffect(() => { if (!ctxLoading) fetchData() }, [fetchData, ctxLoading])

  const stats = useMemo(() => {
    const completed = appointments.filter(a => a.status === 'completed')
    const noShow = appointments.filter(a => a.status === 'no_show')
    const cancelled = appointments.filter(a => a.status === 'cancelled')
    const total = appointments.length
    const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0
    const noShowRate = total > 0 ? Math.round((noShow.length / total) * 100) : 0
    return { cancelled, total, completionRate, noShowRate }
  }, [appointments])

  if (loading) return null
  const { cancelled, total, completionRate, noShowRate } = stats
  if (total === 0) return null

  return (
    <div className="card p-4">
      <h3 className="h-sub mb-3">Son 30 Gün Performansı</h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-xl font-semibold tabular-nums text-green-600 dark:text-green-400">%{completionRate}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Tamamlanma</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-semibold tabular-nums text-red-600 dark:text-red-400">%{noShowRate}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Gelmeme</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">{cancelled.length}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">İptal</p>
        </div>
      </div>
    </div>
  )
}
