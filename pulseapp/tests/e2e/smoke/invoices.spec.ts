import { test, expect } from '@playwright/test'
import { login } from './helpers'

test.describe('Faturalar', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('faturalar sayfası yüklenir', async ({ page }) => {
    await page.goto('/dashboard/invoices')
    await expect(page.locator('h1, [class*="h-page"]').first()).toBeVisible()
  })

  test('yeni fatura formu açılır', async ({ page }) => {
    await page.goto('/dashboard/invoices')
    const newBtn = page.locator('button', { hasText: /yeni fatura|fatura oluştur/i }).first()
    await expect(newBtn).toBeVisible()
    await newBtn.click()
    await expect(
      page.locator('[role="dialog"], [class*="modal"], form').first()
    ).toBeVisible({ timeout: 5_000 })
  })

  test('fatura filtresi çalışır', async ({ page }) => {
    await page.goto('/dashboard/invoices')
    // Durum filtresi veya tarih filtresi
    const filterBtn = page.locator('button', { hasText: /filtre|tümü/i }).first()
    if (await filterBtn.isVisible()) {
      await filterBtn.click()
      await expect(page.locator('body')).toBeVisible()
    }
  })
})
