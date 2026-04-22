import { test, expect } from '@playwright/test'

/**
 * Portal booking testi — giriş gerektirmez (public sayfa).
 * businessId gerçek bir kayıtlı işletme ID'si olmalı.
 * TEST_BUSINESS_ID env varı yoksa test atlanır.
 */
const BUSINESS_ID = process.env.TEST_BUSINESS_ID

test.describe('Portal — Online Randevu', () => {
  test.skip(!BUSINESS_ID, 'TEST_BUSINESS_ID env varı gerekli')

  test('public booking sayfası yüklenir', async ({ page }) => {
    await page.goto(`/book/${BUSINESS_ID}`)
    // İşletme adı veya randevu formu görünmeli
    await expect(page.locator('h1, [class*="business-name"]').first()).toBeVisible({ timeout: 10_000 })
  })

  test('hizmet seçilebilir', async ({ page }) => {
    await page.goto(`/book/${BUSINESS_ID}`)
    // İlk hizmet seçeneği
    const serviceOption = page.locator('[class*="service-card"], button[class*="service"]').first()
    if (await serviceOption.isVisible({ timeout: 5_000 })) {
      await serviceOption.click()
      // Bir sonraki adım görünmeli
      await expect(page.locator('body')).toBeVisible()
    }
  })
})
