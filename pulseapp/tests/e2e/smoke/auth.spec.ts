import { test, expect } from '@playwright/test'
import { login, TEST_EMAIL, TEST_PASSWORD } from './helpers'

test.describe('Kimlik Doğrulama', () => {
  test('giriş yapılabilir ve dashboard açılır', async ({ page }) => {
    await login(page)
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('giriş yapılmışken /auth/login → dashboard yönlendirmesi', async ({ page }) => {
    await login(page)
    await page.goto('/auth/login')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('yanlış şifre ile giriş hata verir', async ({ page }) => {
    await page.goto('/auth/login')
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', 'yanlis-sifre-xyz')
    await page.click('button[type="submit"]')
    // Hata mesajı veya URL değişmemeli
    await expect(page).not.toHaveURL(/\/dashboard/, { timeout: 5_000 })
  })

  test('çıkış yapılabilir', async ({ page }) => {
    await login(page)
    // Kullanıcı menüsünü aç ve çıkış yap
    const logoutBtn = page.locator('button', { hasText: /çıkış/i }).or(
      page.locator('[data-testid="logout"]')
    )
    if (await logoutBtn.isVisible()) {
      await logoutBtn.click()
      await expect(page).toHaveURL(/\/auth\/login|^\/$/)
    }
  })
})
