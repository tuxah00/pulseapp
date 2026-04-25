'use client'

import { useBusinessData } from './business-context-provider'
import type { SectorType, PlanType, StaffRole, StaffPermissions, StaffWritePermissions, BusinessSettings } from '@/types'

interface BusinessContext {
  businessId: string | null
  businessName: string | null
  userId: string | null
  staffId: string | null
  staffName: string | null
  staffRole: StaffRole | null
  permissions: StaffPermissions | null
  writePermissions: StaffWritePermissions | null
  sector: SectorType | null
  plan: PlanType | null
  settings: BusinessSettings | null
  loading: boolean
}

export function useBusinessContext(): BusinessContext {
  try {
    const data = useBusinessData()
    return {
      businessId: data.businessId,
      businessName: data.businessName,
      userId: data.userId,
      staffId: data.staffId,
      staffName: data.staffName,
      staffRole: data.staffRole,
      permissions: data.permissions,
      writePermissions: data.writePermissions,
      sector: data.sector,
      plan: data.plan,
      settings: data.settings,
      loading: false,
    }
  } catch {
    return {
      businessId: null,
      businessName: null,
      userId: null,
      staffId: null,
      staffName: null,
      staffRole: null,
      permissions: null,
      writePermissions: null,
      sector: null,
      plan: null,
      settings: null,
      loading: true,
    }
  }
}
