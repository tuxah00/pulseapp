import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Kurulum sihirbazının `businesses.settings.wizard_step` ilerlemesini günceller.
 * Merge-in-place: diğer settings alanlarını bozmaz, wizard_step'i yalnızca
 * ileri götürür (kullanıcı geri giderse önceki en yüksek adım korunur).
 */
export async function advanceWizardStep(
  supabase: SupabaseClient,
  businessId: string,
  step: number,
): Promise<void> {
  const { data } = await supabase
    .from('businesses')
    .select('settings')
    .eq('id', businessId)
    .maybeSingle()

  const settings = (data?.settings as Record<string, unknown> | null) ?? {}
  const prevStep = typeof settings.wizard_step === 'number' ? settings.wizard_step : 0
  if (step <= prevStep) return

  await supabase
    .from('businesses')
    .update({ settings: { ...settings, wizard_step: step } })
    .eq('id', businessId)
}

/**
 * `businesses.settings` JSONB içine key/value merge ile yazar.
 * Kurulum sihirbazında mesaj şablonları, toggle'lar ve tamamlanma bayrağı
 * için kullanılır. Hem wizard_step'i ileriye alır hem de verilen patch'i uygular.
 */
export async function patchBusinessSettings(
  supabase: SupabaseClient,
  businessId: string,
  patch: Record<string, unknown>,
  advanceToStep?: number,
): Promise<void> {
  const { data } = await supabase
    .from('businesses')
    .select('settings')
    .eq('id', businessId)
    .maybeSingle()

  const current = (data?.settings as Record<string, unknown> | null) ?? {}
  const next: Record<string, unknown> = { ...current, ...patch }

  if (typeof advanceToStep === 'number') {
    const prevStep = typeof current.wizard_step === 'number' ? current.wizard_step : 0
    if (advanceToStep > prevStep) next.wizard_step = advanceToStep
  }

  await supabase.from('businesses').update({ settings: next }).eq('id', businessId)
}
