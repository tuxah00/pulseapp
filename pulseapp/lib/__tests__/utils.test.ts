import { describe, it, expect } from 'vitest'
import {
  cn,
  formatCurrency,
  formatPhone,
  formatTime,
  getInitials,
  getSegmentColor,
  getStatusColor,
  getStarDisplay,
} from '@/lib/utils'

describe('cn', () => {
  it('birden fazla class birleştirir', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('falsy değerleri filtreler', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('tailwind çakışmalarını çözer (twMerge)', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2')
  })
})

describe('formatCurrency', () => {
  it('pozitif tam sayıyı TRY formatında döner', () => {
    const result = formatCurrency(1234)
    expect(result).toContain('₺')
    expect(result).toContain('1.234')
  })

  it('sıfır için TRY simgesini içerir', () => {
    expect(formatCurrency(0)).toContain('₺')
  })

  it('ondalığı yuvarlar (maximumFractionDigits: 0)', () => {
    const result = formatCurrency(1234.56)
    expect(result).toContain('1.235')
  })
})

describe('formatPhone', () => {
  it('10 haneli numarayı 0 ön ekiyle formatlar', () => {
    expect(formatPhone('5321234567')).toBe('0532 123 45 67')
  })

  it('11 haneli numarayı (0 ile başlayan) formatlar', () => {
    expect(formatPhone('05321234567')).toBe('0532 123 45 67')
  })

  it('boşluk ve tireyi temizler', () => {
    expect(formatPhone('0532-123 45 67')).toBe('0532 123 45 67')
  })

  it('geçersiz uzunlukta orijinali döner', () => {
    expect(formatPhone('123')).toBe('123')
  })
})

describe('formatTime', () => {
  it('"HH:mm:ss" formatını "HH:mm"e keser', () => {
    expect(formatTime('14:30:00')).toBe('14:30')
  })

  it('zaten kısa olan formatı bozmaz', () => {
    expect(formatTime('09:15')).toBe('09:15')
  })
})

describe('getInitials', () => {
  it('tam isimden iki harfli baş harf üretir', () => {
    expect(getInitials('Ali Veli')).toBe('AV')
  })

  it('tek kelime için tek harf döner', () => {
    expect(getInitials('Ahmet')).toBe('A')
  })

  it('3+ kelimenin sadece ilk 2 harfini alır', () => {
    expect(getInitials('Ali Veli Ayşe')).toBe('AV')
  })

  it('boş veya null için "?" döner', () => {
    expect(getInitials('')).toBe('?')
    expect(getInitials(null)).toBe('?')
    expect(getInitials(undefined)).toBe('?')
  })

  it('küçük harfleri büyüğe çevirir', () => {
    expect(getInitials('ali veli')).toBe('AV')
  })
})

describe('getSegmentColor', () => {
  it('bilinen segment için doğru class döner', () => {
    expect(getSegmentColor('new')).toBe('bg-blue-100 text-blue-700')
    expect(getSegmentColor('vip')).toBe('bg-amber-100 text-amber-700')
    expect(getSegmentColor('risk')).toBe('bg-orange-100 text-orange-700')
  })

  it('bilinmeyen segment için gri fallback döner', () => {
    expect(getSegmentColor('unknown')).toBe('bg-gray-100 text-gray-700')
  })
})

describe('getStatusColor', () => {
  it('appointment durumları için doğru class döner', () => {
    expect(getStatusColor('pending')).toBe('bg-yellow-100 text-yellow-700')
    expect(getStatusColor('confirmed')).toBe('bg-blue-100 text-blue-700')
    expect(getStatusColor('completed')).toBe('bg-green-100 text-green-700')
    expect(getStatusColor('cancelled')).toBe('bg-gray-100 text-gray-500')
    expect(getStatusColor('no_show')).toBe('bg-red-100 text-red-700')
  })

  it('bilinmeyen status için gri fallback döner', () => {
    expect(getStatusColor('??')).toBe('bg-gray-100 text-gray-700')
  })
})

describe('getStarDisplay', () => {
  it('5 üzerinden doğru yıldız çıktısı üretir', () => {
    expect(getStarDisplay(0)).toBe('☆☆☆☆☆')
    expect(getStarDisplay(3)).toBe('★★★☆☆')
    expect(getStarDisplay(5)).toBe('★★★★★')
  })
})
