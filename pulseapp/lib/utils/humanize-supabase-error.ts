/**
 * Supabase / Postgres hatalarını kullanıcıya yönelik Türkçe mesaja dönüştürür.
 *
 * Ham `error.message` (ör. "duplicate key value violates unique constraint ...")
 * kullanıcıya gösterilmemeli: hem anlaşılmaz hem de veritabanı detaylarını sızdırır.
 *
 * Kullanım:
 *   const { error } = await supabase.from(...).insert(...)
 *   if (error) setError(humanizeSupabaseError(error))
 *
 * Bilinen örüntüler için önceden tanımlı mesajlar, diğer durumlar için
 * genel bir fallback mesajı döner. Debug için orijinal hata konsola basılır.
 */

type SupabaseLikeError = {
  message?: string
  code?: string
  details?: string | null
  hint?: string | null
}

const GENERIC_FALLBACK = 'Bir sorun oluştu. Lütfen tekrar deneyin.'

export function humanizeSupabaseError(
  error: unknown,
  overrides?: Record<string, string>,
): string {
  if (!error) return GENERIC_FALLBACK

  // Debug trace — orijinal hata DevTools'ta görünsün
  if (typeof console !== 'undefined') {
    console.error('[supabase]', error)
  }

  const err = error as SupabaseLikeError
  const raw = [err.message, err.details, err.hint].filter(Boolean).join(' | ').toLowerCase()

  if (!raw) return GENERIC_FALLBACK

  // Çağıran yerel eşlemeler her zaman önceliklidir
  if (overrides) {
    for (const [pattern, message] of Object.entries(overrides)) {
      if (raw.includes(pattern.toLowerCase())) return message
    }
  }

  // Müşteri telefonu unique index'i
  if (raw.includes('idx_customers_business_phone')) {
    return 'Bu telefon numarası zaten kayıtlı.'
  }

  // Randevu çakışma trigger'ı (kullanıcı dostu mesaj raise ediyor)
  if (raw.includes('başka bir randevusu var')) {
    return 'Bu personelin bu saatte başka bir randevusu var.'
  }

  // Postgres hata sınıfları
  if (raw.includes('duplicate key') || raw.includes('unique constraint')) {
    return 'Bu kayıt zaten mevcut.'
  }
  if (raw.includes('foreign key constraint')) {
    return 'Bu kayıt başka kayıtlara bağlı. Önce ilgili kayıtları kontrol edin.'
  }
  if (raw.includes('not-null constraint') || raw.includes('null value in column')) {
    return 'Bazı zorunlu alanlar boş. Lütfen formu kontrol edin.'
  }
  if (raw.includes('check constraint')) {
    return 'Girilen değer geçerli değil. Lütfen kontrol edin.'
  }
  if (raw.includes('invalid input syntax') || raw.includes('invalid text representation')) {
    return 'Geçersiz veri formatı. Lütfen girdiğiniz bilgileri kontrol edin.'
  }
  if (raw.includes('permission denied') || raw.includes('row-level security')) {
    return 'Bu işlem için yetkiniz yok.'
  }
  if (raw.includes('timeout') || raw.includes('connection')) {
    return 'Bağlantı sorunu. İnternetinizi kontrol edip tekrar deneyin.'
  }

  return GENERIC_FALLBACK
}
