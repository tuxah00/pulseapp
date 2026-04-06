import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, isToday, isTomorrow, isPast } from 'date-fns'
import { tr } from 'date-fns/locale'

// ── Tailwind class merge ──
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Tarih formatlama (Türkçe) ──

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'd MMMM yyyy', { locale: tr })
}

export function formatDateShort(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'd MMM', { locale: tr })
}

export function formatTime(time: string): string {
  // "14:30:00" → "14:30"
  return time.slice(0, 5)
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'd MMM yyyy HH:mm', { locale: tr })
}

export function getRelativeDay(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  if (isToday(d)) return 'Bugün'
  if (isTomorrow(d)) return 'Yarın'
  return formatDate(d)
}

export function isDatePast(date: string | Date): boolean {
  const d = typeof date === 'string' ? parseISO(date) : date
  return isPast(d)
}

// ── Para formatlama ──

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ── Telefon formatlama ──

export function formatPhone(phone: string): string {
  // "5321234567" → "0532 123 45 67"
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `0${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8, 10)}`
  }
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7, 9)} ${cleaned.slice(9, 11)}`
  }
  return phone
}

// ── Segment renkleri ──

export function getSegmentColor(segment: string): string {
  const colors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700',
    regular: 'bg-green-100 text-green-700',
    vip: 'bg-amber-100 text-amber-700',
    risk: 'bg-orange-100 text-orange-700',
    lost: 'bg-red-100 text-red-700',
  }
  return colors[segment] || 'bg-gray-100 text-gray-700'
}

// ── Randevu durum renkleri ──

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-500',
    no_show: 'bg-red-100 text-red-700',
  }
  return colors[status] || 'bg-gray-100 text-gray-700'
}

// ── Yıldız hesaplama ──

export function getStarDisplay(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating)
}

// ── Avatar yardımcıları ──

export const AVATAR_COLORS = [
  'bg-violet-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-cyan-500',
] as const

export function getInitials(name?: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function getAvatarColor(name?: string | null): string {
  return 'bg-pulse-500'
}
