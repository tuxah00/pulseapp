'use client'

import { notFound } from 'next/navigation'
import type { StaffPermissions } from '@/types'

/**
 * Yetki kontrolü. permissions yüklendi ve istenen anahtar `false` ise
 * `notFound()` fırlatır → Next.js not-found.tsx boundary'si devreye girer
 * ve gerçek 404 gösterilir.
 *
 * Kullanım:
 *   requirePermission(permissions, 'invoices')
 *
 * Böylece yetkisiz kullanıcılar "erişim yetkiniz yok" mesajı yerine 404
 * görür → sayfanın varlığı sızdırılmaz.
 */
export function requirePermission(
  permissions: StaffPermissions | null | undefined,
  key: keyof StaffPermissions
) {
  if (permissions && permissions[key] === false) {
    notFound()
  }
}
