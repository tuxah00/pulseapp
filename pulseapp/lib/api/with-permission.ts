import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
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

export function withPermission(
  permission: keyof StaffPermissions,
  handler: PermissionHandler
) {
  return async (req: NextRequest, routeContext?: any) => {
    try {
      // 1. Auth kontrolü
      const supabase = createServerSupabaseClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json(
          { error: 'Oturum bulunamadı. Lütfen giriş yapın.' },
          { status: 401 }
        )
      }

      // 2. Staff member bilgisini çek
      const admin = createAdminClient()
      const { data: staff, error: staffError } = await admin
        .from('staff_members')
        .select('id, business_id, role, permissions, write_permissions, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single()

      if (staffError || !staff) {
        return NextResponse.json(
          { error: 'Personel kaydı bulunamadı.' },
          { status: 403 }
        )
      }

      // 3. Permission kontrolü
      const role = staff.role as StaffRole
      const effectivePerms = getEffectivePermissions(role, staff.permissions)
      const effectiveWrite = getEffectiveWritePermissions(role, (staff as any).write_permissions ?? null)

      if (!effectivePerms[permission]) {
        return NextResponse.json(
          { error: `Bu işlem için yetkiniz yok: ${permission}` },
          { status: 403 }
        )
      }

      // 4. Handler'a context ile devam et
      const ctx: AuthContext = {
        userId: user.id,
        staffId: staff.id,
        businessId: staff.business_id,
        role,
        permissions: effectivePerms,
        writePermissions: effectiveWrite,
      }

      return handler(req, ctx)
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
 * View yetkisi VE write yetkisi birlikte kontrol edilir. Yoksa 403.
 *
 * Kullanım:
 * ```ts
 * export const POST = withWritePermission('invoices', async (req, ctx) => { ... })
 * ```
 */
export function withWritePermission(
  permission: keyof StaffPermissions,
  handler: PermissionHandler
) {
  return async (req: NextRequest, routeContext?: any) => {
    try {
      const supabase = createServerSupabaseClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 })
      }

      const admin = createAdminClient()
      const { data: staff } = await admin
        .from('staff_members')
        .select('id, business_id, role, permissions, write_permissions, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single()

      if (!staff) {
        return NextResponse.json({ error: 'Personel kaydı bulunamadı.' }, { status: 403 })
      }

      const role = staff.role as StaffRole
      const effectivePerms = getEffectivePermissions(role, staff.permissions)
      const effectiveWrite = getEffectiveWritePermissions(role, (staff as any).write_permissions ?? null)

      if (!effectivePerms[permission]) {
        return NextResponse.json(
          { error: `Bu sayfayı görme yetkiniz yok: ${permission}` },
          { status: 403 }
        )
      }

      if (!effectiveWrite[permission]) {
        return NextResponse.json(
          { error: `Düzenleme yetkiniz yok: ${permission}` },
          { status: 403 }
        )
      }

      const ctx: AuthContext = {
        userId: user.id,
        staffId: staff.id,
        businessId: staff.business_id,
        role,
        permissions: effectivePerms,
        writePermissions: effectiveWrite,
      }

      return handler(req, ctx)
    } catch (err: any) {
      console.error('Write permission middleware hatası:', err)
      return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 })
    }
  }
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
  req: NextRequest,
  permission: keyof StaffPermissions
): Promise<
  | { ok: true; ctx: AuthContext }
  | { ok: false; response: NextResponse }
> {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Oturum bulunamadı.' }, { status: 401 }),
      }
    }

    const admin = createAdminClient()
    const { data: staff } = await admin
      .from('staff_members')
      .select('id, business_id, role, permissions, write_permissions, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!staff) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Personel kaydı bulunamadı.' }, { status: 403 }),
      }
    }

    const role = staff.role as StaffRole
    const effectivePerms = getEffectivePermissions(role, staff.permissions)
    const effectiveWrite = getEffectiveWritePermissions(role, (staff as any).write_permissions ?? null)

    if (!effectivePerms[permission]) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: `Bu işlem için yetkiniz yok: ${permission}` },
          { status: 403 }
        ),
      }
    }

    return {
      ok: true,
      ctx: {
        userId: user.id,
        staffId: staff.id,
        businessId: staff.business_id,
        role,
        permissions: effectivePerms,
        writePermissions: effectiveWrite,
      },
    }
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
  return async (req: NextRequest, routeContext?: any) => {
    try {
      const supabase = createServerSupabaseClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json(
          { error: 'Oturum bulunamadı. Lütfen giriş yapın.' },
          { status: 401 }
        )
      }

      const admin = createAdminClient()
      const { data: staff } = await admin
        .from('staff_members')
        .select('id, business_id, role, permissions, write_permissions, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .limit(1)
        .single()

      if (!staff) {
        return NextResponse.json(
          { error: 'Personel kaydı bulunamadı.' },
          { status: 403 }
        )
      }

      const role = staff.role as StaffRole
      const ctx: AuthContext = {
        userId: user.id,
        staffId: staff.id,
        businessId: staff.business_id,
        role,
        permissions: getEffectivePermissions(role, staff.permissions),
        writePermissions: getEffectiveWritePermissions(role, (staff as any).write_permissions ?? null),
      }

      return handler(req, ctx)
    } catch (err: any) {
      console.error('Auth middleware hatası:', err)
      return NextResponse.json(
        { error: 'Sunucu hatası' },
        { status: 500 }
      )
    }
  }
}
