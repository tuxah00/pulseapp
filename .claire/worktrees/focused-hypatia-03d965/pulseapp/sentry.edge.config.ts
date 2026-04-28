import * as Sentry from '@sentry/nextjs'
import { SENTRY_BASE_CONFIG } from './lib/sentry-config'

Sentry.init({ ...SENTRY_BASE_CONFIG })
