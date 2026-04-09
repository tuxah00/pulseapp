import type { SectorType, PlanType } from '@/types'

// ── Plugin Sidebar Extension ──
export interface PluginSidebarItem {
  key: string
  name: string
  href: string
  iconName: string
  /** Minimum plan required to see this item */
  requiredPlan?: PlanType
}

// ── Plugin Action (context menu / quick action) ──
export interface PluginAction {
  key: string
  label: string
  iconName: string
  description: string
  /** Where this action appears */
  context: 'appointment' | 'customer' | 'session' | 'global'
  /** API endpoint to call, if any */
  endpoint?: string
  requiredPlan?: PlanType
}

// ── Document/Form Template ──
export interface PluginTemplate {
  key: string
  name: string
  description: string
  category: 'consent_form' | 'post_care' | 'report' | 'checklist' | 'prescription'
  /** Markdown template content with {{variable}} placeholders */
  content: string
}

// ── AI Capability ──
export interface PluginAiCapability {
  key: string
  name: string
  description: string
  /** API endpoint for this capability */
  endpoint: string
  requiredPlan?: PlanType
}

// ── Dashboard Widget ──
export interface PluginWidget {
  key: string
  name: string
  description: string
  /** Component key for dynamic rendering */
  component: string
  size: 'small' | 'medium' | 'full'
  requiredPlan?: PlanType
}

// ── Main Plugin Interface ──
export interface SectorPlugin {
  id: string
  name: string
  description: string
  version: string
  /** Which sectors auto-activate this plugin */
  sectors: SectorType[]
  /** Minimum plan required */
  requiredPlan?: PlanType

  // Extensions
  sidebarItems?: PluginSidebarItem[]
  actions?: PluginAction[]
  templates?: PluginTemplate[]
  aiCapabilities?: PluginAiCapability[]
  widgets?: PluginWidget[]

  // Sector-specific labels
  customerLabel?: string
  customerLabelSingular?: string
  appointmentLabel?: string
}
