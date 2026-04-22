/**
 * Merkezi logger — API route'larında `console.*` yerine kullanılır.
 *
 * Kullanım:
 * ```ts
 * const log = createLogger({ route: 'api/book' })
 * log.info({ businessId, customerId }, 'Randevu oluşturuldu')
 * log.error({ err }, 'SMS gönderimi başarısız')
 * ```
 *
 * - Development: renkli, okunabilir satır ('[INFO] api/book | msg | {context}')
 * - Production (`NODE_ENV==='production'`): tek satır JSON (Vercel log drain + ileride Sentry
 *   bridge kolay olacak şekilde)
 * - Error instance'ları otomatik olarak `{name, message, stack}` şeklinde serialize edilir.
 *
 * Sprint 8'de Sentry devreye alındığında `error` seviyesi Sentry.captureException'a köprülenir.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

type LogContext = Record<string, unknown>

export interface Logger {
  debug: (ctxOrMsg: LogContext | string, msg?: string) => void
  info: (ctxOrMsg: LogContext | string, msg?: string) => void
  warn: (ctxOrMsg: LogContext | string, msg?: string) => void
  error: (ctxOrMsg: LogContext | string, msg?: string) => void
  child: (extra: LogContext) => Logger
}

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }

function currentMinLevel(): number {
  const env = (process.env.LOG_LEVEL || '').toLowerCase() as LogLevel
  if (env in LEVEL_RANK) return LEVEL_RANK[env]
  return process.env.NODE_ENV === 'production' ? LEVEL_RANK.info : LEVEL_RANK.debug
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack }
  }
  if (err && typeof err === 'object') return err as Record<string, unknown>
  return { value: err }
}

function normalizeContext(ctx: LogContext): LogContext {
  const out: LogContext = {}
  for (const [key, value] of Object.entries(ctx)) {
    if (key === 'err' || key === 'error') {
      out[key] = serializeError(value)
    } else {
      out[key] = value
    }
  }
  return out
}

function emit(level: LogLevel, base: LogContext, ctxOrMsg: LogContext | string, msg?: string) {
  if (LEVEL_RANK[level] < currentMinLevel()) return

  const message = typeof ctxOrMsg === 'string' ? ctxOrMsg : msg || ''
  const extra = typeof ctxOrMsg === 'string' ? {} : normalizeContext(ctxOrMsg)
  const merged = { ...base, ...extra }

  if (process.env.NODE_ENV === 'production') {
    const line = JSON.stringify({
      level,
      time: new Date().toISOString(),
      msg: message,
      ...merged,
    })
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](line)
    return
  }

  // Development — okunabilir format
  const ctxStr = Object.keys(merged).length ? ` ${JSON.stringify(merged)}` : ''
  const tag = `[${level.toUpperCase()}]`
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](`${tag} ${message}${ctxStr}`)
}

/**
 * Logger instance'ı oluşturur. `base` alanları her log satırında otomatik eklenir.
 *
 * Önerilen temel alan: `{ route: 'api/feedback' }` veya `{ job: 'cron/reminders' }`.
 */
export function createLogger(base: LogContext = {}): Logger {
  const logger: Logger = {
    debug: (ctxOrMsg, msg) => emit('debug', base, ctxOrMsg, msg),
    info: (ctxOrMsg, msg) => emit('info', base, ctxOrMsg, msg),
    warn: (ctxOrMsg, msg) => emit('warn', base, ctxOrMsg, msg),
    error: (ctxOrMsg, msg) => emit('error', base, ctxOrMsg, msg),
    child: (extra) => createLogger({ ...base, ...extra }),
  }
  return logger
}
