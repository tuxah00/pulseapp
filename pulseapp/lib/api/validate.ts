import { NextResponse } from 'next/server'
import type { ZodType } from 'zod'

/**
 * API route'lar için Zod tabanlı request body doğrulayıcı.
 *
 * Kullanım:
 * ```ts
 * const result = await validateBody(req, customerCreateSchema)
 * if (!result.ok) return result.response
 * const { name, phone } = result.data
 * ```
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
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.') || '_root'
      if (!fieldErrors[path]) fieldErrors[path] = issue.message
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Doğrulama başarısız', fields: fieldErrors },
        { status: 400 },
      ),
    }
  }

  return { ok: true, data: parsed.data }
}
