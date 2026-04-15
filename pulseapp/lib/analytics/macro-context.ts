import type { createAdminClient } from '@/lib/supabase/admin'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

export interface FxRate {
  code: string
  label: string
  buying: number
  selling: number
  weekly_delta_pct: number | null
}

export interface MacroSnapshot {
  fx: FxRate[]
  fetched_at: string
  source: string
  stale: boolean
}

export interface MacroBriefNote {
  kind: 'economy' | 'regulation' | 'trend' | 'risk'
  text: string
}

export interface MacroBrief {
  generated_at: string
  sector: string
  headline: string
  notes: MacroBriefNote[]
  expires_at: string
}

export interface MacroContext {
  snapshot: MacroSnapshot | null
  brief: MacroBrief | null
}

const FX_CACHE_TTL_MS = 60 * 60 * 1000 // 1 saat
let fxCache: { data: MacroSnapshot; cachedAt: number } | null = null

const TCMB_TODAY = 'https://www.tcmb.gov.tr/kurlar/today.xml'

function tcmbArchiveUrl(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `https://www.tcmb.gov.tr/kurlar/${y}${m}/${day}${m}${y}.xml`
}

interface TcmbRate {
  code: string
  forexBuying: number
  forexSelling: number
}

function parseTcmbXml(xml: string, wanted: string[]): TcmbRate[] {
  const results: TcmbRate[] = []
  for (const code of wanted) {
    const re = new RegExp(`<Currency[^>]*CurrencyCode="${code}"[^>]*>([\\s\\S]*?)</Currency>`, 'i')
    const match = xml.match(re)
    if (!match) continue
    const block = match[1]
    const buyMatch = block.match(/<ForexBuying>([\d.]+)<\/ForexBuying>/)
    const sellMatch = block.match(/<ForexSelling>([\d.]+)<\/ForexSelling>/)
    if (!buyMatch || !sellMatch) continue
    results.push({
      code,
      forexBuying: Number(buyMatch[1]),
      forexSelling: Number(sellMatch[1]),
    })
  }
  return results
}

const FX_LABELS: Record<string, string> = {
  USD: 'ABD Doları',
  EUR: 'Euro',
  GBP: 'İngiliz Sterlini',
}

async function fetchTcmb(url: string, signal: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(url, { signal, cache: 'no-store' })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

export async function fetchMacroSnapshot(): Promise<MacroSnapshot | null> {
  const now = Date.now()
  if (fxCache && now - fxCache.cachedAt < FX_CACHE_TTL_MS) {
    return { ...fxCache.data, stale: false }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  try {
    const todayXml = await fetchTcmb(TCMB_TODAY, controller.signal)
    if (!todayXml) {
      return fxCache?.data ? { ...fxCache.data, stale: true } : null
    }

    const today = parseTcmbXml(todayXml, ['USD', 'EUR', 'GBP'])
    if (today.length === 0) {
      return fxCache?.data ? { ...fxCache.data, stale: true } : null
    }

    // Bir hafta öncesi — YoW delta için
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
    const weekAgoXml = await fetchTcmb(tcmbArchiveUrl(weekAgo), controller.signal)
    const weekAgoRates = weekAgoXml ? parseTcmbXml(weekAgoXml, ['USD', 'EUR', 'GBP']) : []
    const prevMap = new Map(weekAgoRates.map(r => [r.code, r.forexSelling]))

    const fx: FxRate[] = today.map(r => {
      const prev = prevMap.get(r.code)
      const delta = prev && prev > 0
        ? Math.round(((r.forexSelling - prev) / prev) * 1000) / 10
        : null
      return {
        code: r.code,
        label: FX_LABELS[r.code] || r.code,
        buying: Math.round(r.forexBuying * 100) / 100,
        selling: Math.round(r.forexSelling * 100) / 100,
        weekly_delta_pct: delta,
      }
    })

    const snapshot: MacroSnapshot = {
      fx,
      fetched_at: new Date().toISOString(),
      source: 'TCMB',
      stale: false,
    }
    fxCache = { data: snapshot, cachedAt: now }
    return snapshot
  } finally {
    clearTimeout(timeout)
  }
}

export async function getMacroBrief(
  admin: SupabaseAdmin,
  sector: string,
): Promise<MacroBrief | null> {
  const { data } = await admin
    .from('macro_briefs')
    .select('sector, headline, notes, generated_at, expires_at')
    .eq('sector', sector)
    .gte('expires_at', new Date().toISOString())
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  return {
    sector: data.sector,
    headline: data.headline,
    notes: (data.notes as MacroBriefNote[]) || [],
    generated_at: data.generated_at,
    expires_at: data.expires_at,
  }
}

export async function fetchMacroContext(
  admin: SupabaseAdmin,
  sector: string,
): Promise<MacroContext> {
  const [snapshot, brief] = await Promise.all([
    fetchMacroSnapshot().catch(err => {
      console.error('[macro] fx snapshot failed:', err)
      return null
    }),
    getMacroBrief(admin, sector).catch(err => {
      console.error('[macro] brief fetch failed:', err)
      return null
    }),
  ])
  return { snapshot, brief }
}

/** AI prompt'a enjekte edilebilir kısa metin. */
export function macroContextForPrompt(ctx: MacroContext): string {
  const lines: string[] = []
  if (ctx.snapshot?.fx.length) {
    const fxLine = ctx.snapshot.fx.map(r => {
      const delta = r.weekly_delta_pct
      const deltaTxt = delta != null
        ? ` (son 7 gün ${delta > 0 ? '+' : ''}${delta.toFixed(1)}%)`
        : ''
      return `${r.code}=${r.selling}₺${deltaTxt}`
    }).join(', ')
    lines.push(`Güncel kurlar: ${fxLine}`)
  }
  if (ctx.brief) {
    lines.push(`Sektörel gündem: ${ctx.brief.headline}`)
    for (const note of ctx.brief.notes.slice(0, 3)) {
      lines.push(`- ${note.text}`)
    }
  }
  return lines.join('\n')
}
