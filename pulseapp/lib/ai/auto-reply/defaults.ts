/**
 * Otomatik yanıt sabitleri — UI ve runtime arasında drift önlemek için tek kaynak.
 */
export const AUTO_REPLY_DEFAULTS = {
  mode: 'whitelist' as const,
  hours: { start: '08:00', end: '22:00' },
  dailyCap: 200,
  perCustomerDailyCap: 5,
  cooldownMinutes: 5,
  signature: true,
} as const
