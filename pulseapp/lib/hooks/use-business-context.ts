'use client'

import { useBusinessData } from './business-context-provider'
import type { StaffRole, StaffPermissions } from '@/types'

interface BusinessContext {
  businessId: string | null
  userId: string | null
  staffId: string | null
  staffName: string | null
  staffRole: StaffRole | null
  permissions: StaffPermissions | null
  loading: boolean
}

export function useBusinessContext(): BusinessContext {
  try {
    const data = useBusinessData()
    return {
      businessId: data.businessId,
      userId: data.userId,
      staffId: data.staffId,
      staffName: data.staffName,
      staffRole: data.staffRole,
      permissions: data.permissions,
      loading: false,
    }
  } catch {
    return {
      businessId: null,
      userId: null,
      staffId: null,
      staffName: null,
      staffRole: null,
      permissions: null,
      loading: false,
    }
  }
}
