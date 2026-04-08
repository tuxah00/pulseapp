import { test, expect } from '@playwright/test'

/**
 * Login akışı smoke testleri.
 *
 * 1) Sayfa render edilebiliyor mu (credential gerektirmez)
 * 2) Yanlış credential ile Türkçe hata mesajı görünüyor mu
 * 3) (Opsiyonel) E2E_TEST_EMAIL + E2E_TEST_PASSWORD env var'ları varsa
 *    gerçek login → /dashboard geçişi.
 *
 * Üçüncü testi çalıştırmak için projenin kökünde `.env.test.local` oluştur:
 *   E2E_TEST_EMAIL=test@ornek.com
 *   E2E_TEST_PASSWORD=parola123
 */

test.describe('Login sayfası', () => {
  test('login sayfası doğru başlık ve alanlarla render edilir', async ({ page }) => {
    await page.goto('/auth/login')

    await expect(page.getByRole('heading', { name: /tekrar hoş geldiniz/i })).toBeVisible()
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
    await expect(page.getByRole('button', { name: /giriş yap/i })).toBeVisible()
  })

  test('yanlış credential ile Türkçe hata mesajı gösterir', async ({ page }) => {
    await page.goto('/auth/login')

    await page.locator('#email').fill('wrong-user-test@pulseapp-test.local')
    await page.locator('#password').fill('wrong-password-123')
    await page.getByRole('button', { name: /giriş yap/i }).click()

    // Hata kutusu görünmeli — "E-posta veya şifre hatalı" ya da Supabase orijinal mesajı
    const errorLocator = page.locator('.bg-red-50').first()
    await expect(errorLocator).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Login → Dashboard (gerçek credential ile)', () => {
  test.skip(
    !process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD,
    'E2E_TEST_EMAIL/E2E_TEST_PASSWORD tanımlı değil, gerçek login testi atlanıyor'
  )

  test('başarılı login sonrası /dashboard yüklenir', async ({ page }) => {
    await page.goto('/auth/login')
    await page.locator('#email').fill(process.env.E2E_TEST_EMAIL!)
    await page.locator('#password').fill(process.env.E2E_TEST_PASSWORD!)
    await page.getByRole('button', { name: /giriş yap/i }).click()

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
  })
})
