/**
 * Çalışma saati doğrulaması.
 *
 * İşletme `working_hours` yapısı:
 *   { mon: { open: '09:00', close: '18:00' } | null, tue: ..., ... }
 * `null` = o gün kapalı.
 *
 * Hem `/api/book` hem de `/api/public/business/[id]/book` aynı kontrolü kullanır.
 */

export type WorkingHoursMap = Record<
  string,
  { open: string; close: string } | null
>

const DAY_KEYS: Record<number, string> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
}

export interface WorkingHoursError {
  error: string
  status: number
}

/**
 * Verilen tarih+saat, işletmenin çalışma saatleri içinde mi?
 *
 * @returns `null` → geçerli; aksi halde `{ error, status }` döner.
 */
export function checkWorkingHours(
  workingHours: WorkingHoursMap | null | undefined,
  date: string,
  startTime: string,
): WorkingHoursError | null {
  if (!workingHours) return null // çalışma saati tanımsız → validasyon atlanır

  const dayKey = DAY_KEYS[new Date(date + 'T00:00:00').getDay()]
  const dayHours = workingHours[dayKey]

  if (!dayHours) {
    return { error: 'Bu gün kapalıdır', status: 400 }
  }
  if (startTime < dayHours.open) {
    return { error: 'Çalışma saatleri dışında randevu oluşturulamaz', status: 400 }
  }
  return null
}
