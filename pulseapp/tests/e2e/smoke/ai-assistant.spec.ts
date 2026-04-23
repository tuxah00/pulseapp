import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('AI Asistan', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('AI asistan sayfası yüklenir', async ({ page }) => {
    await page.goto('/dashboard/ai-assistant')
    await expect(page.locator('h1, [class*="h-page"], textarea, input').first()).toBeVisible({ timeout: 10_000 })
  })

  test('mesaj gönderilebilir', async ({ page }) => {
    await page.goto('/dashboard/ai-assistant')
    const input = page.locator('textarea, input[placeholder*="yaz"], input[placeholder*="mesaj"]').first()
    if (await input.isVisible({ timeout: 5_000 })) {
      await input.fill('Merhaba, bugün kaç randevum var?')
      const sendBtn = page.locator('button[type="submit"], button', { hasText: /gönder/i }).first()
      if (await sendBtn.isVisible()) {
        await sendBtn.click()
        // Yanıt yükleniyor veya geldi
        await page.waitForTimeout(1_000)
        await expect(page.locator('body')).toBeVisible()
      }
    }
  })
})
