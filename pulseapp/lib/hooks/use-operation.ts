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

// Pending → success/error geçişinde "flash" görünmesini engellemek için min süre
const MIN_PENDING_MS = 350
// Network hangs / unresolved promise koruması — pending sonsuz kalmasın
const MAX_PENDING_MS = 30_000

export function useOperation() {
  const run = useCallback(async <T,>(
    fn: () => Promise<T>,
    messages: OperationMessages,
  ): Promise<T | null> => {
    const id = crypto.randomUUID()
    const startedAt = Date.now()

    // Pending toast
    window.dispatchEvent(new CustomEvent('pulse-toast', {
      detail: { id, type: 'pending', title: messages.pending },
    }))

    // Min-show garantisi — çok hızlı işlemlerde pending bir flash gibi görünmesin
    const ensureMinShow = async () => {
      const elapsed = Date.now() - startedAt
      if (elapsed < MIN_PENDING_MS) {
        await new Promise(r => setTimeout(r, MIN_PENDING_MS - elapsed))
      }
    }

    // Timeout race'i — fn çözülmezse 30 sn sonra hata fırlatılır
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('İşlem zaman aşımına uğradı (30 sn).')), MAX_PENDING_MS),
    )

    try {
      const result = await Promise.race([fn(), timeoutPromise])

      // Bazı Supabase çağrıları { data, error } şeklinde döner; error varsa fırlat
      if (result && typeof result === 'object' && 'error' in result) {
        const supabaseError = (result as { error: unknown }).error
        if (supabaseError) {
          throw supabaseError
        }
      }

      await ensureMinShow()
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

      await ensureMinShow()
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
