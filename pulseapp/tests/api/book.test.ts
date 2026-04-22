// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Supabase admin client'ı mock'lanır — gerçek DB'ye gidilmez.
// Her test kendi davranışını `mockChainResults` ile belirler.
const mockChainResults: {
  businesses?: { data: unknown; error: unknown }
  services?: { data: unknown; error: unknown }
  appointments_conflict?: { data: unknown; error: unknown }
  customers?: { data: unknown; error: unknown }
  appointment_insert?: { data: unknown; error: unknown }
} = {}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    const makeChain = (getResult: () => { data: unknown; error: unknown }) => {
      const chain: Record<string, unknown> = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        gt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn(() => Promise.resolve(getResult())),
        then: (resolve: (v: unknown) => unknown) => Promise.resolve(getResult()).then(resolve),
      }
      return chain
    }
    return {
      from: vi.fn((table: string) => {
        if (table === 'businesses') {
          return makeChain(() => mockChainResults.businesses ?? { data: null, error: null })
        }
        if (table === 'services') {
          return makeChain(() => mockChainResults.services ?? { data: null, error: null })
        }
        if (table === 'appointments') {
          // insert chain başka dönüş gerektirir, ama bu testlerde appointment insert'e gelmeyeceğiz
          return makeChain(() => mockChainResults.appointments_conflict ?? { data: [], error: null })
        }
        if (table === 'customers') {
          return makeChain(() => mockChainResults.customers ?? { data: null, error: null })
        }
        if (table === 'notifications') {
          return makeChain(() => ({ data: null, error: null }))
        }
        return makeChain(() => ({ data: null, error: null }))
      }),
    }
  },
}))

// Route handler'ı mock'tan SONRA import edilmeli.
const { POST } = await import('@/app/api/book/route')

// UUID validation gereksinimi nedeniyle testlerde geçerli UUID kullanılır
const TEST_BUSINESS_ID = '00000000-0000-4000-8000-000000000001'
const TEST_SERVICE_ID = '00000000-0000-4000-8000-000000000002'

function makeRequest(body: unknown, businessId = TEST_BUSINESS_ID) {
  return new NextRequest(
    `http://localhost:3000/api/book?businessId=${businessId}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }
  )
}

describe('POST /api/book', () => {
  beforeEach(() => {
    // Her testten önce mock state'i sıfırla
    Object.keys(mockChainResults).forEach(
      (key) => delete mockChainResults[key as keyof typeof mockChainResults]
    )
  })

  it('eksik alan varsa 400 ve Zod field-level hata döner', async () => {
    const req = makeRequest({
      service_id: TEST_SERVICE_ID,
      appointment_date: '2099-04-08',
      start_time: '10:00',
      // customer_name eksik
      customer_phone: '5551234567',
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Doğrulama başarısız')
    expect(json.fields).toHaveProperty('customer_name')
  })

  it('businessId query param yoksa 400 döner', async () => {
    const req = new NextRequest('http://localhost:3000/api/book', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Geçersiz businessId')
  })

  it('çalışma saatleri dışı randevu 400 döner', async () => {
    // Pazartesi 2026-04-06, çalışma 09:00-18:00
    // Request start_time 08:00 → çalışma saati dışı
    mockChainResults.businesses = {
      data: {
        id: 'biz-1',
        working_hours: {
          mon: { open: '09:00', close: '18:00' },
          tue: { open: '09:00', close: '18:00' },
          wed: { open: '09:00', close: '18:00' },
          thu: { open: '09:00', close: '18:00' },
          fri: { open: '09:00', close: '18:00' },
          sat: null,
          sun: null,
        },
      },
      error: null,
    }

    const req = makeRequest({
      service_id: TEST_SERVICE_ID,
      appointment_date: '2099-04-06', // Pazartesi
      start_time: '08:00',
      customer_name: 'Test Müşteri',
      customer_phone: '5551234567',
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toContain('Çalışma saatleri dışında')
  })

  it('kapalı gün için 400 "Bu gün kapalıdır" döner', async () => {
    mockChainResults.businesses = {
      data: {
        id: 'biz-1',
        working_hours: {
          mon: { open: '09:00', close: '18:00' },
          tue: { open: '09:00', close: '18:00' },
          wed: { open: '09:00', close: '18:00' },
          thu: { open: '09:00', close: '18:00' },
          fri: { open: '09:00', close: '18:00' },
          sat: null,
          sun: null, // Pazar kapalı
        },
      },
      error: null,
    }

    const req = makeRequest({
      service_id: TEST_SERVICE_ID,
      appointment_date: '2099-04-05', // Pazar
      start_time: '10:00',
      customer_name: 'Test Müşteri',
      customer_phone: '5551234567',
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('Bu gün kapalıdır')
  })

  it('işletme bulunamazsa 404 döner', async () => {
    mockChainResults.businesses = { data: null, error: null }

    const req = makeRequest({
      service_id: TEST_SERVICE_ID,
      appointment_date: '2099-04-08',
      start_time: '10:00',
      customer_name: 'Test Müşteri',
      customer_phone: '5551234567',
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error).toBe('İşletme bulunamadı')
  })
})
