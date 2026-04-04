import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyMembership(supabase: ReturnType<typeof createServerSupabaseClient>, userId: string, businessId: string) {
  const { data } = await supabase
    .from('staff_members')
    .select('id, business_id, role')
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .single()
  return data
}

// GET: Kontrendikasyonlar (hizmet bazlı veya tümü)
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const serviceId = searchParams.get('serviceId')

  if (!businessId) return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const admin = createAdminClient()
  let query = admin
    .from('service_contraindications')
    .select('*, service:services(id, name)')
    .eq('business_id', businessId)
    .order('risk_level', { ascending: false })

  if (serviceId) query = query.eq('service_id', serviceId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contraindications: data })
}

// POST: Kontrendikasyon ekle
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await request.json()
  const { businessId, serviceId, allergen, riskLevel, warningMessage } = body

  if (!businessId || !serviceId || !allergen) {
    return NextResponse.json({ error: 'businessId, serviceId, allergen zorunlu' }, { status: 400 })
  }

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('service_contraindications')
    .insert({
      business_id: businessId,
      service_id: serviceId,
      allergen,
      risk_level: riskLevel || 'high',
      warning_message: warningMessage || null,
    })
    .select('*, service:services(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ contraindication: data }, { status: 201 })
}

// DELETE: Kontrendikasyon sil
export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const id = searchParams.get('id')

  if (!businessId || !id) return NextResponse.json({ error: 'businessId ve id gerekli' }, { status: 400 })

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('service_contraindications')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// POST: Çapraz kontrol — müşteri alerjileri + hizmet kontrendikasyonları
// Endpoint: /api/contraindications?check=true
export async function PUT(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await request.json()
  const { businessId, customerId, serviceId } = body

  if (!businessId || !customerId || !serviceId) {
    return NextResponse.json({ error: 'businessId, customerId, serviceId zorunlu' }, { status: 400 })
  }

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const admin = createAdminClient()

  // Müşterinin alerjilerini al
  const { data: allergies } = await admin
    .from('customer_allergies')
    .select('allergen, severity, reaction')
    .eq('customer_id', customerId)
    .eq('business_id', businessId)

  if (!allergies || allergies.length === 0) {
    return NextResponse.json({ warnings: [], hasRisk: false })
  }

  // Hizmetin kontrendikasyonlarını al
  const { data: contraindications } = await admin
    .from('service_contraindications')
    .select('allergen, risk_level, warning_message')
    .eq('service_id', serviceId)
    .eq('business_id', businessId)

  if (!contraindications || contraindications.length === 0) {
    return NextResponse.json({ warnings: [], hasRisk: false })
  }

  // Eşleşmeleri bul
  const allergenSet = new Set(allergies.map(a => a.allergen.toLowerCase()))
  const warnings = contraindications
    .filter(c => allergenSet.has(c.allergen.toLowerCase()))
    .map(c => {
      const allergy = allergies.find(a => a.allergen.toLowerCase() === c.allergen.toLowerCase())
      return {
        allergen: c.allergen,
        riskLevel: c.risk_level,
        severity: allergy?.severity,
        reaction: allergy?.reaction,
        warningMessage: c.warning_message,
      }
    })

  return NextResponse.json({
    warnings,
    hasRisk: warnings.length > 0,
  })
}
