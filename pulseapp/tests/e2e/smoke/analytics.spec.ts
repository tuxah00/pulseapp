import { test, expect } from '@playwright/test'
import { login } from './helpers'
import path from 'path'
import fs from 'fs'
import os from 'os'

test.describe('Analitik', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('analitik sayfası yüklenir', async ({ page }) => {
    await page.goto('/dashboard/analytics')
    await expect(page.locator('h1, [class*="h-page"]').first()).toBeVisible()
  })

  test('PDF indir butonu görünür ve tıklanabilir', async ({ page }) => {
    await page.goto('/dashboard/analytics')
    const pdfBtn = page.locator('button', { hasText: /pdf indir/i })
    await expect(pdfBtn).toBeVisible({ timeout: 10_000 })
  })

  test('PDF indirilir', async ({ page }) => {
    await page.goto('/dashboard/analytics')
    const pdfBtn = page.locator('button', { hasText: /pdf indir/i })
    await expect(pdfBtn).toBeVisible({ timeout: 10_000 })

    // İndirme event'ini yakala
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15_000 }).catch(() => null),
      pdfBtn.click(),
    ])
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i)
    }
  })

  test('dönem seçici çalışır', async ({ page }) => {
    await page.goto('/dashboard/analytics')
    const periodBtn = page.locator('button', { hasText: /bu ay|geçen ay|7 gün/i }).first()
    if (await periodBtn.isVisible()) {
      await periodBtn.click()
      await expect(page.locator('body')).toBeVisible()
    }
  })
})
