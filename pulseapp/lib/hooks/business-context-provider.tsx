'use client'

import { createContext, useContext } from 'react'
import type { SectorType, PlanType } from '@/types'

interface BusinessContextValue {
  businessId: string
  userId: string
  staffId: string
  staffName: string
  sector: SectorType
  plan: PlanType
  businessName: string
}

const BusinessContext = createContext<BusinessContextValue | null>(null)

export function BusinessProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: BusinessContextValue
}) {
  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  )
}

export function useBusinessData(): BusinessContextValue {
  const ctx = useContext(BusinessContext)
  if (!ctx) {
    throw new Error('useBusinessData must be used within BusinessProvider')
  }
  return ctx
}
