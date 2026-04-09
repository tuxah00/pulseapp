import type { SectorType, PlanType } from '@/types'
import type {
  SectorPlugin, PluginAction, PluginTemplate, PluginAiCapability, PluginWidget, PluginSidebarItem
} from './types'

// ── Sector Plugins ──
import { aestheticPlugin } from './sectors/aesthetic'
import { dentalPlugin } from './sectors/dental'
import { fitnessPlugin } from './sectors/fitness'

const ALL_PLUGINS: SectorPlugin[] = [
  aestheticPlugin,
  dentalPlugin,
  fitnessPlugin,
]

// ── Query Functions ──

/** Get all plugins that are active for a given sector */
export function getPluginsForSector(sector: SectorType): SectorPlugin[] {
  return ALL_PLUGINS.filter(p => p.sectors.includes(sector))
}

/** Get a single plugin by its ID */
export function getPluginById(pluginId: string): SectorPlugin | undefined {
  return ALL_PLUGINS.find(p => p.id === pluginId)
}

// ── Aggregation Helpers ──

function planAllowed(requiredPlan: PlanType | undefined, currentPlan: PlanType): boolean {
  if (!requiredPlan) return true
  const planOrder: PlanType[] = ['starter', 'standard', 'pro']
  return planOrder.indexOf(currentPlan) >= planOrder.indexOf(requiredPlan)
}

/** Get all sidebar items from plugins for a sector, filtered by plan */
export function getPluginSidebarItems(sector: SectorType, plan: PlanType): PluginSidebarItem[] {
  return getPluginsForSector(sector)
    .flatMap(p => (p.sidebarItems ?? []).filter(item => planAllowed(item.requiredPlan, plan)))
}

/** Get all actions from plugins for a sector and context */
export function getPluginActions(
  sector: SectorType,
  context: PluginAction['context'],
  plan: PlanType = 'starter'
): PluginAction[] {
  return getPluginsForSector(sector)
    .flatMap(p => (p.actions ?? [])
      .filter(a => a.context === context && planAllowed(a.requiredPlan, plan))
    )
}

/** Get all templates from plugins for a sector */
export function getPluginTemplates(sector: SectorType, category?: PluginTemplate['category']): PluginTemplate[] {
  const templates = getPluginsForSector(sector).flatMap(p => p.templates ?? [])
  return category ? templates.filter(t => t.category === category) : templates
}

/** Get all AI capabilities from plugins for a sector */
export function getPluginAiCapabilities(sector: SectorType, plan: PlanType = 'starter'): PluginAiCapability[] {
  return getPluginsForSector(sector)
    .flatMap(p => (p.aiCapabilities ?? []).filter(c => planAllowed(c.requiredPlan, plan)))
}

/** Get all dashboard widgets from plugins for a sector */
export function getPluginWidgets(sector: SectorType, plan: PlanType = 'starter'): PluginWidget[] {
  return getPluginsForSector(sector)
    .flatMap(p => (p.widgets ?? []).filter(w => planAllowed(w.requiredPlan, plan)))
}

/** Fill template variables in a template string */
export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`)
}
