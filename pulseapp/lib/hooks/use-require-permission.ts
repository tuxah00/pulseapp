'use client'

import { notFound } from 'next/navigation'
import type { StaffPermissions, SectorType } from '@/types'
import { sectorHasModule } from '@/lib/config/sector-modules'

/**
 * Yetki kontrolü. permissions yüklendi ve istenen anahtar `false` ise
 * `notFound()` fırlatır → Next.js not-found.tsx boundary'si devreye girer
 * ve gerçek 404 gösterilir.
 *
 * Kullanım:
 *   requirePermission(permissions, 'invoices')
 */
export function requirePermission(
  permissions: StaffPermissions | null | undefined,
  key: keyof StaffPermissions
) {
  if (permissions && permissions[key] === false) {
    notFound()
  }
}

/**
 * Sektör modül kontrolü. Bu sektörde bulunmayan bir modülün URL'ine
 * girilirse gerçek 404 döner.
 *
 * Kullanım:
 *   requireSectorModule(sector, 'classes')  // sadece fitness/yoga_pilates için geçerli
 */
export function requireSectorModule(
  sector: SectorType | null | undefined,
  moduleKey: string
) {
  if (sector && !sectorHasModule(sector, moduleKey)) {
    notFound()
  }
}
