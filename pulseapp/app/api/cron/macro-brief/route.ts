import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/api/verify-cron'
import { getOpenAIClient, ASSISTANT_MODEL } from '@/lib/ai/openai-client'
import { SECTOR_LABELS } from '@/types'
import type { SectorType } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

const BRIEF_MAX_TOKENS = 500
const BRIEF_TTL_DAYS = 8 // haftalık + 1 gün grace

interface BriefNote {
  kind: 'economy' | 'regulation' | 'trend' | 'risk'
  text: string
}

interface BriefJson {
  headline: string
  notes: BriefNote[]
}

/**
 * Haftalık sektör gündem özeti.
 * Pazartesi sabah cron tetikler; aktif işletmelerin sektörleri için OpenAI'dan
 * makroekonomi/regülasyon/trend özeti çeker ve `macro_briefs` tablosuna yazar.
 */
export async function GET(request: NextRequest) {
  const authErr = verifyCronAuth(request)
  if (authErr) return authErr

  const admin = createAdminClient()
  const { data: businesses, error } = await admin
    .from('businesses')
    .select('sector')
    .eq('is_active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sectors = Array.from(
    new Set(((businesses || []) as { sector: string | null }[])
      .map(b => (b.sector as SectorType) || 'other')),
  )

  const now = new Date()
  const expiresAt = new Date(now.getTime() + BRIEF_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  let written = 0
  let failures = 0

  for (const sector of sectors) {
    try {
      const brief = await generateBrief(sector)
      if (!brief) { failures++; continue }

      const { error: insertErr } = await admin.from('macro_briefs').insert({
        sector,
        headline: brief.headline,
        notes: brief.notes,
        generated_at: now.toISOString(),
        expires_at: expiresAt,
      })
      if (insertErr) { failures++; console.error(`[macro-brief] insert ${sector}:`, insertErr); continue }
      written++
    } catch (err) {
      failures++
      console.error(`[macro-brief] sector ${sector} failed:`, err)
    }
  }

  return NextResponse.json({ ok: true, sectors: sectors.length, written, failures })
}

async function generateBrief(sector: SectorType): Promise<BriefJson | null> {
  try {
    const openai = getOpenAIClient()
    const sectorLabel = SECTOR_LABELS[sector] || sector
    const res = await openai.chat.completions.create({
      model: ASSISTANT_MODEL,
      max_tokens: BRIEF_MAX_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Sen Türkiye'deki küçük-orta işletmelere yönelik makro gündem özeti hazırlayan bir editörsün. JSON döneceksin — şema: { "headline": string (≤120 kr), "notes": [{ "kind": "economy"|"regulation"|"trend"|"risk", "text": string (≤160 kr) }] }. Maksimum 4 not. Türkçe, sade, somut rakam/olay referansı ver. Varsayımsal/uydurulmuş haberden kaçın; son 7 gün Türkiye ekonomisi, küresel gelişmeler, sektörü etkileyen regülasyon veya tüketici eğilimleri üzerinden genel yorum yap.`,
        },
        {
          role: 'user',
          content: `Sektör: ${sectorLabel}\nBugün: ${new Date().toLocaleDateString('tr-TR')}\n\nBu sektördeki bir işletme sahibinin bilmesi gereken haftalık makro gündemi JSON olarak hazırla.`,
        },
      ],
    })
    const content = res.choices[0]?.message?.content?.trim()
    if (!content) return null
    const parsed = JSON.parse(content) as BriefJson
    if (!parsed.headline || !Array.isArray(parsed.notes)) return null
    return {
      headline: String(parsed.headline).slice(0, 200),
      notes: parsed.notes
        .filter(n => n && typeof n.text === 'string')
        .slice(0, 4)
        .map(n => ({
          kind: (['economy', 'regulation', 'trend', 'risk'].includes(n.kind) ? n.kind : 'trend') as BriefNote['kind'],
          text: String(n.text).slice(0, 240),
        })),
    }
  } catch (err) {
    console.error('[macro-brief] openai error:', err)
    return null
  }
}
