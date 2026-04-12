import { NextResponse } from 'next/server'
import type { ZodType, ZodError } from 'zod'

function zodErrorResponse(error: ZodError): NextResponse {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root'
    if (!fieldErrors[path]) fieldErrors[path] = issue.message
  }
  return NextResponse.json(
    { error: 'Doğrulama başarısız', fields: fieldErrors },
    { status: 400 },
  )
}

/**
 * API route'lar için Zod tabanlı request body doğrulayıcı.
 *
 * Hatalar Türkçe field-level mesajlar ile 400 olarak döner.
 */
export async function validateBody<T>(
  req: Request,
  schema: ZodType<T>,
): Promise<
  | { ok: true; data: T }
  | { ok: false; response: NextResponse }
> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Geçersiz istek gövdesi (JSON ayrıştırılamadı)' },
        { status: 400 },
      ),
    }
  }

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, response: zodErrorResponse(parsed.error) }
  }

  return { ok: true, data: parsed.data }
}

/**
 * GET route'lar için query parameter doğrulayıcı.
 */
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: ZodType<T>,
): { ok: true; data: T } | { ok: false; response: NextResponse } {
  const raw: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    raw[key] = value
  })

  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, response: zodErrorResponse(parsed.error) }
  }

  return { ok: true, data: parsed.data }
}

/**
 * API route'larında pagination parametrelerini parse eder.
 */
export function parsePaginationParams(searchParams: URLSearchParams, defaultSize = 50) {
  const page = Math.max(0, parseInt(searchParams.get('page') || '0', 10) || 0)
  const pageSize = Math.min(Math.max(1, parseInt(searchParams.get('pageSize') || String(defaultSize), 10) || defaultSize), 100)
  return { page, pageSize, from: page * pageSize, to: (page + 1) * pageSize - 1 }
}
