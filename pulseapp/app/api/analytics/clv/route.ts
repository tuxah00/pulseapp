import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/api/with-permission'

// GET: Müşteri Yaşam Boyu Değeri (CLV)
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const customerId = searchParams.get('customerId')
  const limit = parseInt(searchParams.get('limit') || '20')

  const admin = createAdminClient()

  // Müşterileri al
  let customerQuery = admin
    .from('customers')
    .select('id, name, phone, segment, total_visits, total_revenue, last_visit_at, created_at')
    .eq('business_id', businessId)
    .eq('is_active', true)

  if (customerId) {
    customerQuery = customerQuery.eq('id', customerId)
  } else {
    customerQuery = customerQuery.order('total_revenue', { ascending: false }).limit(limit)
  }

  const { data: customers, error } = await customerQuery
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!customers || customers.length === 0) {
    return NextResponse.json({ clvData: [] })
  }

  // Her müşteri için detaylı CLV hesapla
  const clvData = customers.map(customer => {
    const totalSpend = customer.total_revenue || 0
    const visitCount = customer.total_visits || 0
    const avgSpend = visitCount > 0 ? totalSpend / visitCount : 0

    // Müşteri yaşı (ay cinsinden)
    const customerAge = customer.created_at
      ? Math.max(1, Math.floor((Date.now() - new Date(customer.created_at).getTime()) / (30 * 24 * 60 * 60 * 1000)))
      : 1

    // Aylık ziyaret frekansı
    const monthlyFrequency = visitCount / customerAge

    // Tahmini yıllık değer = aylık frekans × ortalama harcama × 12
    const estimatedAnnualValue = monthlyFrequency * avgSpend * 12

    // Son ziyaretten bu yana geçen gün
    const daysSinceLastVisit = customer.last_visit_at
      ? Math.floor((Date.now() - new Date(customer.last_visit_at).getTime()) / (24 * 60 * 60 * 1000))
      : null

    return {
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone,
      segment: customer.segment,
      totalSpend,
      visitCount,
      avgSpend: Math.round(avgSpend * 100) / 100,
      monthlyFrequency: Math.round(monthlyFrequency * 100) / 100,
      estimatedAnnualValue: Math.round(estimatedAnnualValue * 100) / 100,
      daysSinceLastVisit,
      customerAgeMonths: customerAge,
    }
  })

  return NextResponse.json({ clvData })
}
