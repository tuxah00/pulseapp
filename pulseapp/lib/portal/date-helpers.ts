/**
 * Portal UI'de "X gün önce", "yaklaşıyor" gibi insancıl tarih formatları.
 */

const MS_DAY = 24 * 60 * 60 * 1000

export function daysBetween(a: Date, b: Date): number {
  const aD = new Date(a.getFullYear(), a.getMonth(), a.getDate())
  const bD = new Date(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((aD.getTime() - bD.getTime()) / MS_DAY)
}

export function daysSince(date: string | Date | null | undefined): number | null {
  if (!date) return null
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return null
  return daysBetween(new Date(), d)
}

export function formatRelative(date: string | Date | null | undefined): string {
  const n = daysSince(date)
  if (n === null) return ''
  if (n === 0) return 'bugün'
  if (n === 1) return 'dün'
  if (n < 7) return `${n} gün önce`
  if (n < 30) return `${Math.floor(n / 7)} hafta önce`
  if (n < 365) return `${Math.floor(n / 30)} ay önce`
  return `${Math.floor(n / 365)} yıl önce`
}

export function formatUntil(date: string | Date | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return ''
  const n = daysBetween(d, new Date())
  if (n === 0) return 'bugün'
  if (n === 1) return 'yarın'
  if (n < 7) return `${n} gün sonra`
  if (n < 30) return `${Math.ceil(n / 7)} hafta sonra`
  if (n < 365) return `${Math.ceil(n / 30)} ay sonra`
  return `${Math.ceil(n / 365)} yıl sonra`
}

export function isToday(date: string | Date | null | undefined): boolean {
  if (!date) return false
  const d = typeof date === 'string' ? new Date(date) : date
  const t = new Date()
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate()
}

/**
 * Doğum günü bugüne denk mi? Yıl bakılmaz.
 */
export function isBirthdayToday(birthday: string | null | undefined): boolean {
  if (!birthday) return false
  const b = new Date(birthday)
  if (isNaN(b.getTime())) return false
  const t = new Date()
  return b.getMonth() === t.getMonth() && b.getDate() === t.getDate()
}

/**
 * Saate göre selamlama: Günaydın / İyi günler / İyi akşamlar
 */
export function getTimeOfDayGreeting(): string {
  const h = new Date().getHours()
  if (h < 6) return 'İyi geceler'
  if (h < 12) return 'Günaydın'
  if (h < 18) return 'İyi günler'
  return 'İyi akşamlar'
}
