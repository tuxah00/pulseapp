import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

async function verifyMembership(supabase: ReturnType<typeof createServerSupabaseClient>, userId: string, businessId: string) {
  const { data } = await supabase
    .from('staff_members')
    .select('id, business_id')
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .single()
  return data
}

// POST: AI Tedavi Önerisi
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await request.json()
  const { businessId, customerId, complaint, additionalNotes } = body

  if (!businessId || !customerId) {
    return NextResponse.json({ error: 'businessId ve customerId zorunlu' }, { status: 400 })
  }

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  // Müşteri bilgilerini topla
  const [customerResult, allergiesResult, protocolsResult, appointmentsResult, servicesResult] = await Promise.all([
    supabase.from('customers').select('name, segment, total_visits, notes').eq('id', customerId).single(),
    supabase.from('customer_allergies').select('allergen, severity, reaction').eq('customer_id', customerId).eq('business_id', businessId),
    supabase.from('treatment_protocols').select('name, status, total_sessions, completed_sessions, service:services(name)').eq('customer_id', customerId).eq('business_id', businessId).order('created_at', { ascending: false }).limit(5),
    supabase.from('appointments').select('appointment_date, status, service:services(name)').eq('customer_id', customerId).eq('business_id', businessId).order('appointment_date', { ascending: false }).limit(10),
    supabase.from('services').select('name, description, price, duration_minutes').eq('business_id', businessId).eq('is_active', true),
  ])

  const customer = customerResult.data
  const allergies = allergiesResult.data || []
  const protocols = protocolsResult.data || []
  const pastAppointments = appointmentsResult.data || []
  const availableServices = servicesResult.data || []

  if (!customer) return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 })

  // Claude'a gönderilecek bağlam
  const prompt = `Sen bir medikal estetik klinik danışmanısın. Aşağıdaki müşteri bilgilerine göre tedavi önerisi yap.

## Müşteri Bilgileri
- Ad: ${customer.name}
- Segment: ${customer.segment}
- Toplam Ziyaret: ${customer.total_visits}
- Notlar: ${customer.notes || 'Yok'}

## Alerjiler
${allergies.length > 0 ? allergies.map(a => `- ${a.allergen} (${a.severity})${a.reaction ? ` — Reaksiyon: ${a.reaction}` : ''}`).join('\n') : 'Bilinen alerji yok.'}

## Geçmiş Tedavi Protokolleri
${protocols.length > 0 ? protocols.map(p => {
  const svc = Array.isArray(p.service) ? p.service[0] : p.service
  return `- ${p.name} (${(svc as { name: string } | null)?.name || '?'}) — ${p.completed_sessions}/${p.total_sessions} seans, Durum: ${p.status}`
}).join('\n') : 'Geçmiş protokol yok.'}

## Son Randevular
${pastAppointments.length > 0 ? pastAppointments.map(a => {
  const svc = Array.isArray(a.service) ? a.service[0] : a.service
  return `- ${a.appointment_date} — ${(svc as { name: string } | null)?.name || '?'} (${a.status})`
}).join('\n') : 'Geçmiş randevu yok.'}

## Mevcut Şikayet / İstek
${complaint || 'Belirtilmemiş'}

## Ek Notlar
${additionalNotes || 'Yok'}

## Mevcut Hizmetler
${availableServices.map(s => `- ${s.name}${s.price ? ` (₺${s.price})` : ''} — ${s.duration_minutes} dk${s.description ? ` — ${s.description}` : ''}`).join('\n')}

---

Lütfen aşağıdaki formatta yanıt ver:

1. **Önerilen Tedavi**: Ana tedavi önerisi
2. **Seans Planı**: Önerilen seans sayısı ve aralığı
3. **Dikkat Edilecekler**: Alerjiler ve kontrendikasyonlar göz önünde
4. **Alternatif Seçenekler**: Varsa alternatif tedavi yolları
5. **Tahmini Maliyet**: Mevcut hizmet fiyatlarına göre

SADECE mevcut hizmet listesindeki hizmetleri öner. Türkçe yanıt ver.`

  try {
    const anthropic = new Anthropic()
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => block.type === 'text' ? block.text : '')
      .join('\n')

    return NextResponse.json({
      suggestion: responseText,
      customerName: customer.name,
      allergiesCount: allergies.length,
      pastProtocolsCount: protocols.length,
    })
  } catch (err) {
    console.error('AI tedavi önerisi hatası:', err)
    return NextResponse.json({ error: 'AI yanıtı alınamadı' }, { status: 500 })
  }
}
