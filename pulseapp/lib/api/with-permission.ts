import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActiveStaffForApi } from '@/lib/auth/active-business'
import {
  getEffectivePermissions,
  getEffectiveWritePermissions,
  type StaffPermissions,
  type StaffWritePermissions,
  type StaffRole,
} from '@/types'

/**
 * API route permission middleware.
 *
 * Auth kontrolü yapar, staff member'ın ilgili permission flag'ini kontrol eder.
 * Yetkisizse 403 döner.
 *
 * Kullanım:
 * ```ts
 * export const GET = withPermission('invoices', async (req, { staffId, businessId, role }) => {
 *   // ...
 *   return NextResponse.json({ data })
 * })
 * ```
 */

export interface AuthContext {
  userId: string
  staffId: string
  businessId: string
  role: StaffRole
  permissions: StaffPermissions
  writePermissions: StaffWritePermissions
}

type PermissionHandler = (
  req: NextRequest,
  ctx: AuthContext
) => Promise<NextResponse> | NextResponse

/**
 * Kullanıcının aktif staff kaydını çözer. Birden fazla işletmede çalışan
 * kullanıcılar için aktif işletme cookie'sine göre doğru kayıt seçilir.
 * Dönüş: { ok, ctx } veya { ok: false, response }
 */
async function resolveAuthContext(): Promise<
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse }
> {
  const supabase = createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Oturum bulunamadı. Lütfen giriş yapın.' }, { status: 401 }),
    }
  }

  const admin = createAdminClient()
  const { staff, status } = await resolveActiveStaffForApi(admin, user.id)

  if (status === 'needs_selection') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Aktif işletme seçilmedi. Lütfen işletme seçin.', code: 'NEEDS_BUSINESS_SELECTION' },
        { status: 409 }
      ),
    }
  }

  if (!staff) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Personel kaydı bulunamadı.' }, { status: 403 }),
    }
  }

  const role = staff.role as StaffRole
  return {
    ok: true,
    ctx: {
      userId: user.id,
      staffId: staff.id,
      businessId: staff.business_id,
      role,
      permissions: getEffectivePermissions(role, staff.permissions),
      writePermissions: getEffectiveWritePermissions(role, staff.write_permissions ?? null),
    },
  }
}

export function withPermission(
  permission: keyof StaffPermissions,
  handler: PermissionHandler
) {
  return async (req: NextRequest, _routeContext?: any) => {
    try {
      const auth = await resolveAuthContext()
      if (!auth.ok) return auth.response

      if (!auth.ctx.permissions[permission]) {
        return NextResponse.json(
          { error: `Bu işlem için yetkiniz yok: ${permission}` },
          { status: 403 }
        )
      }

      return handler(req, auth.ctx)
    } catch (err: any) {
      console.error('Permission middleware hatası:', err)
      return NextResponse.json(
        { error: 'Sunucu hatası' },
        { status: 500 }
      )
    }
  }
}

/**
 * Yazma (POST/PUT/PATCH/DELETE) yetkisi kontrolü yapan middleware.
 * View yetkisi VE write yetkisi birlikte kontrol edilir.
 */
export function withWritePermission(
  permission: keyof StaffPermissions,
  handler: PermissionHandler
) {
  return withPermission(permission, (req, ctx) => {
    if (!ctx.writePermissions[permission]) {
      return NextResponse.json(
        { error: `Düzenleme yetkiniz yok: ${permission}` },
        { status: 403 }
      )
    }
    return handler(req, ctx)
  })
}

/**
 * Inline kullanım için permission kontrol fonksiyonu.
 * GET/POST/DELETE gibi birden fazla HTTP metodu olan route'lar için uygundur.
 *
 * Kullanım:
 * ```ts
 * const auth = await requirePermission(req, 'invoices')
 * if (!auth.ok) return auth.response
 * const { businessId, role } = auth.ctx
 * ```
 */
export async function requirePermission(
  _req: NextRequest,
  permission: keyof StaffPermissions
): Promise<
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse }
> {
  try {
    const auth = await resolveAuthContext()
    if (!auth.ok) return auth

    if (!auth.ctx.permissions[permission]) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `Bu işlem için yetkiniz yok: ${permission}` },
          { status: 403 }
        ),
      }
    }

    return auth
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 }),
    }
  }
}

/**
 * Inline kullanım için yazma yetkisi kontrolü.
 *
 * Kullanım:
 * ```ts
 * const auth = await requireWritePermission(req, 'invoices')
 * if (!auth.ok) return auth.response
 * const { businessId } = auth.ctx
 * ```
 */
export async function requireWritePermission(
  req: NextRequest,
  permission: keyof StaffPermissions
): Promise<
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse }
> {
  const base = await requirePermission(req, permission)
  if (!base.ok) return base
  if (!base.ctx.writePermissions[permission]) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Düzenleme yetkiniz yok: ${permission}` },
        { status: 403 }
      ),
    }
  }
  return base
}

/**
 * Sadece auth kontrolü yapan wrapper (permission kontrolü yok).
 * Public olmayan ama tüm staff'ın erişebildiği endpoint'ler için.
 */
export function withAuth(handler: PermissionHandler) {
  return async (req: NextRequest, _routeContext?: any) => {
    try {
      const auth = await resolveAuthContext()
      if (!auth.ok) return auth.response
      return handler(req, auth.ctx)
    } catch (err: any) {
      console.error('Auth middleware hatası:', err)
      return NextResponse.json(
        { error: 'Sunucu hatası' },
        { status: 500 }
      )
    }
  }
}
