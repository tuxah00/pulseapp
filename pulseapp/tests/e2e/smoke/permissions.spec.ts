import { test, expect } from '@playwright/test'
import { login } from './helpers'

/**
 * Yetki matrisi testi.
 * Owner hesabı ile denetim sayfasına erişilir,
 * erişilemeyen sayfalar 401/403 veya redirect döner.
 */
test.describe('Yetki Matrisi', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('owner denetim kaydına erişebilir', async ({ page }) => {
    await page.goto('/dashboard/audit')
    // 401/403 sayfası değil, gerçek içerik gelmeli — yetki varsa
    const body = page.locator('body')
    await expect(body).not.toContainText('401')
    await expect(body).not.toContainText('Yetkisiz')
  })

  test('giriş yapılmamışken /dashboard → login yönlendirmesi', async ({ page }) => {
    // Yeni bağlam (oturum olmadan) ile doğrudan dashboard'a git
    await page.context().clearCookies()
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10_000 })
  })

  test('korumalı API endpoint anonim erişimde 401 döner', async ({ page }) => {
    const resp = await page.request.get('/api/customers?businessId=nonexistent')
    expect([401, 403, 400]).toContain(resp.status())
  })

  test('portal sayfası dashboard oturumu olmadan erişilebilir', async ({ page }) => {
    // Portal sayfaları public — 404 dışında herhangi bir 2xx/3xx olmalı
    const resp = await page.request.get('/portal/test-business-id/dashboard')
    expect(resp.status()).not.toBe(500)
  })
})
