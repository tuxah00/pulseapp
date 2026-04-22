import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'
import { verifyCronAuth } from '@/lib/api/verify-cron'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/cron/workflows' })

// GET — Cron ile çalıştırılan iş akışı adımlarını işle
export async function GET(request: NextRequest) {
  const cronErr = verifyCronAuth(request)
  if (cronErr) return cronErr

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // Çalışması gereken run'ları bul
  const { data: runs, error: runsError } = await admin
    .from('workflow_runs')
    .select(`
      id, business_id, workflow_id, customer_id, appointment_id,
      current_step, status, next_run_at, context,
      workflows(id, name, steps, is_active),
      customers(id, name, phone)
    `)
    .eq('status', 'running')
    .lte('next_run_at', now)
    .limit(50)

  if (runsError) {
    log.error({ err: runsError }, 'Workflow runs fetch error')
    return NextResponse.json({ error: runsError.message }, { status: 500 })
  }

  if (!runs || runs.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  let processedCount = 0
  let errorCount = 0

  for (const run of runs) {
    try {
      const workflow = run.workflows as any
      const customer = run.customers as any

      // Akış pasif edilmişse iptal et
      if (!workflow || !workflow.is_active) {
        await admin
          .from('workflow_runs')
          .update({ status: 'cancelled', completed_at: now })
          .eq('id', run.id)
        continue
      }

      const steps = workflow.steps as { delay_hours: number; message: string }[]
      const stepIndex = run.current_step

      if (stepIndex >= steps.length) {
        await admin
          .from('workflow_runs')
          .update({ status: 'completed', completed_at: now })
          .eq('id', run.id)
        continue
      }

      const step = steps[stepIndex]

      // Mesajdaki değişkenleri değiştir
      let message = step.message
        .replace(/\{name\}/g, customer?.name || 'Müşteri')

      // Mesajı gönder
      if (customer?.phone) {
        await sendMessage({
          to: customer.phone,
          body: message,
          businessId: run.business_id,
          customerId: run.customer_id,
          messageType: 'template',
          channel: 'auto',
        })
      }

      const nextStepIndex = stepIndex + 1

      if (nextStepIndex >= steps.length) {
        // Tüm adımlar tamamlandı
        await admin
          .from('workflow_runs')
          .update({
            status: 'completed',
            current_step: nextStepIndex,
            completed_at: now,
          })
          .eq('id', run.id)
      } else {
        // Sonraki adıma geç
        const nextStep = steps[nextStepIndex]
        const nextRunAt = new Date(Date.now() + nextStep.delay_hours * 60 * 60 * 1000).toISOString()

        await admin
          .from('workflow_runs')
          .update({
            current_step: nextStepIndex,
            next_run_at: nextRunAt,
          })
          .eq('id', run.id)
      }

      processedCount++
    } catch (err: any) {
      log.error({ err, runId: run.id }, 'Workflow run işlenirken hata')
      errorCount++
      // Hatayı kaydet ama tüm işlemi durdurma
      await admin
        .from('workflow_runs')
        .update({ status: 'failed' })
        .eq('id', run.id)
    }
  }

  return NextResponse.json({ processed: processedCount, errors: errorCount })
}
