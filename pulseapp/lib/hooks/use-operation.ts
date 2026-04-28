'use client'

import { useCallback } from 'react'

/**
 * Async işlem boyunca otomatik olarak pending → success/error toast akışını yöneten hook.
 *
 * Davranış:
 * 1. Hook çağrılınca gri "Devam ediyor..." toast gösterilir (otomatik kapanmaz).
 * 2. İşlem başarılıyla tamamlanınca aynı toast yeşil "başarılı" mesajına dönüşür (5 sn sonra otomatik kapanır).
 * 3. İşlem hata fırlatırsa aynı toast kırmızı hata mesajına dönüşür + body kısmında hata detayı.
 * 4. Sonuç: kullanıcı her zaman bir geri bildirim görür, sessiz başarısızlık olmaz.
 *
 * Örnek:
 *   const { run } = useOperation()
 *   await run(
 *     () => supabase.from('appointments').update({ status: 'completed' }).eq('id', id),
 *     { pending: 'Tamamlandı işaretleniyor...', success: 'Tamamlandı', error: 'İşlem başarısız' }
 *   )
 */
export interface OperationMessages {
  /** Gri pending toast metni — örn. "Kaydediliyor..." */
  pending: string
  /** Başarı toast metni — örn. "Kaydedildi" */
  success: string
  /** Hata varsayılan başlık — gerçek hata body'de gösterilir */
  error?: string
}

export function useOperation() {
  const run = useCallback(async <T,>(
    fn: () => Promise<T>,
    messages: OperationMessages,
  ): Promise<T | null> => {
    const id = crypto.randomUUID()

    // Pending toast
    window.dispatchEvent(new CustomEvent('pulse-toast', {
      detail: { id, type: 'pending', title: messages.pending },
    }))

    try {
      const result = await fn()

      // Bazı Supabase çağrıları { data, error } şeklinde döner; error varsa fırlat
      if (result && typeof result === 'object' && 'error' in result) {
        const supabaseError = (result as { error: unknown }).error
        if (supabaseError) {
          throw supabaseError
        }
      }

      // Başarı — aynı id ile yeşil toast
      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: { id, type: 'success', title: messages.success },
      }))
      return result
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Bilinmeyen hata'

      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: {
          id,
          type: 'error',
          title: messages.error ?? 'İşlem başarısız',
          body: message,
        },
      }))
      return null
    }
  }, [])

  return { run }
}
