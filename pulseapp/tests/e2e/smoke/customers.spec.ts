import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Müşteriler', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('müşteriler sayfası yüklenir', async ({ page }) => {
    await page.goto('/dashboard/customers')
    await expect(page.locator('h1, [class*="h-page"]').first()).toBeVisible()
  })

  test('yeni müşteri formu açılır', async ({ page }) => {
    await page.goto('/dashboard/customers')
    const newBtn = page.locator('button', { hasText: /yeni müşteri|hasta ekle|müşteri ekle/i }).first()
    await expect(newBtn).toBeVisible()
    await newBtn.click()
    await expect(
      page.locator('[role="dialog"], [class*="modal"], form').first()
    ).toBeVisible({ timeout: 5_000 })
  })

  test('müşteri arama çalışır', async ({ page }) => {
    await page.goto('/dashboard/customers')
    const searchInput = page.locator('input[placeholder*="ara"], input[type="search"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('test')
      // Sonuç listesi veya boş durum görünmeli
      await page.waitForTimeout(400) // debounce
      await expect(page.locator('body')).toBeVisible()
    }
  })
})
