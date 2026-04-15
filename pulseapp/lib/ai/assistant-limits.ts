import type { PlanType } from '@/types'

export interface AIAssistantLimits {
  dailyMessages: number
  monthlyMessages: number
  maxHistory: number
  maxConversations: number
}

export const AI_LIMITS: Record<PlanType, AIAssistantLimits> = {
  starter: {
    dailyMessages: 20,
    monthlyMessages: 300,
    maxHistory: 10,
    maxConversations: 10,
  },
  standard: {
    dailyMessages: 100,
    monthlyMessages: 2000,
    maxHistory: 20,
    maxConversations: 50,
  },
  pro: {
    dailyMessages: 500,
    monthlyMessages: 10000,
    maxHistory: 30,
    maxConversations: 200,
  },
}
