/**
 * Doğum günü yardımcıları.
 *
 * Kritik: 29 Şubat doğumlular artık yıl olmayan yıllarda (yılların ~%75'i)
 * takvimde mevcut değildir. Bu nedenle 29 Şubat doğumluların doğum günü
 * artık yıl olmayan yıllarda 28 Şubat'a kaydırılır (yaygın uygulama).
 */

export function isBirthdayToday(birthday: string | null | undefined, today: Date = new Date()): boolean {
  if (!birthday) return false
  // YYYY-MM-DD formatı
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) return false

  const bMonth = parseInt(birthday.slice(5, 7), 10)
  const bDay = parseInt(birthday.slice(8, 10), 10)
  if (!bMonth || !bDay) return false

  const todayMonth = today.getMonth() + 1
  const todayDay = today.getDate()
  const todayYear = today.getFullYear()

  // Normal eşleşme
  if (bMonth === todayMonth && bDay === todayDay) return true

  // 29 Şubat doğumlu + artık yıl değil → 28 Şubat'ı doğum günü say
  if (bMonth === 2 && bDay === 29 && !isLeapYear(todayYear)) {
    return todayMonth === 2 && todayDay === 28
  }

  return false
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Müşterinin geçerli bir doğum tarihi olup olmadığını kontrol eder.
 * En az `minYears` yaşında olmalı (varsayılan: 2).
 * @param birthday YYYY-MM-DD formatında tarih string'i
 */
export function isValidCustomerBirthday(birthday: string, minYears = 2): boolean {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - minYears)
  const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`
  const year = parseInt(birthday.slice(0, 4), 10)
  return birthday <= cutoffStr && year >= 1900 && year <= new Date().getFullYear()
}
