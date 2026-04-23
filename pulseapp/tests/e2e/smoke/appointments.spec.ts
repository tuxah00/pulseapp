import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Randevular', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('randevular sayfası yüklenir', async ({ page }) => {
    await page.goto('/dashboard/appointments')
    await expect(page.locator('h1, [class*="h-page"]').first()).toBeVisible()
  })

  test('haftalık takvim görünümüne geçilebilir', async ({ page }) => {
    await page.goto('/dashboard/appointments')
    // Haftalık görünüm butonu
    const weekBtn = page.locator('button', { hasText: /hafta/i }).or(
      page.locator('[data-view="week"]')
    )
    if (await weekBtn.isVisible()) {
      await weekBtn.click()
      // Takvim grid'i görünür olmalı
      await expect(page.locator('[class*="grid"], [class*="calendar"]').first()).toBeVisible()
    }
  })

  test('yeni randevu modalı açılır', async ({ page }) => {
    await page.goto('/dashboard/appointments')
    const newBtn = page.locator('button', { hasText: /yeni randevu|randevu ekle/i }).first()
    await expect(newBtn).toBeVisible()
    await newBtn.click()
    // Modal veya form açılmalı
    await expect(
      page.locator('[role="dialog"], [class*="modal"], form').first()
    ).toBeVisible({ timeout: 5_000 })
  })
})
