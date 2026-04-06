import { test, expect } from '@playwright/test'

test.describe('Landing pública', () => {
  test('carga la home con el encabezado principal', async ({ page }) => {
    await page.goto('/')
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toBeVisible()
    await expect(h1).toContainText(/Asambleas/i)
  })

  test('página de términos responde', async ({ page }) => {
    await page.goto('/terminos')
    await expect(
      page.getByRole('heading', { level: 1, name: /Documentos legales/i })
    ).toBeVisible()
  })
})
