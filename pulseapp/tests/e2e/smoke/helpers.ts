import { type Page } from '@playwright/test'

export const TEST_EMAIL = process.env.TEST_EMAIL || 'pulseapp@gmail.com'
export const TEST_PASSWORD = process.env.TEST_PASSWORD || '123123'

/** Standart test hesabıyla giriş yapar ve dashboard'u bekler. */
export async function login(page: Page) {
  await page.goto('/auth/login')
  await page.fill('input[type="email"]', TEST_EMAIL)
  await page.fill('input[type="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 15_000 })
}
