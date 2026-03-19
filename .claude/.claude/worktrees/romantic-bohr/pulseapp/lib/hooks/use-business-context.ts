'use client'

import { useBusinessData } from './business-context-provider'

interface BusinessContext {
  businessId: string | null
  userId: string | null
  staffId: string | null
  staffName: string | null
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
      loading: false,
    }
  } catch {
    return {
      businessId: null,
      userId: null,
      staffId: null,
      staffName: null,
      loading: false,
    }
  }
}
