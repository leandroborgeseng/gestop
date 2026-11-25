import { expect, test, type Page } from '@playwright/test';

/**
 * 322 R-2: no build de produção, valor inválido sai da URL de Execução.
 * Dez vezes em cada navegador. API real, sem page.route.
 */
const EMAIL = 'admin.gestop@franca.sp.gov.br';
const SENHA = process.env.GESTOP_ADMIN_PASSWORD ?? 'Gestop@123';
const SUJA = '/execucao?aba=tarefas&status=xyz&atrasadas=1&prazoDe=2026-99-01&hoje=2';

test.use({ serviceWorkers: 'block' });

async function entrar(page: Page) {
  await page.goto('/login');
  const email = page.getByPlaceholder('seu.email@franca.sp.gov.br');
  const senha = page.locator('input[type="password"]');
  await expect(async () => {
    await email.fill(EMAIL);
    await senha.fill(SENHA);
    await expect(email).toHaveValue(EMAIL);
  }).toPass();
  await page.getByRole('button', { name: /^entrar$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

test('U-A8-6 tira status e data inválidos da Execução', async ({ page }) => {
  test.setTimeout(90_000);
  await entrar(page);
  for (let vez = 0; vez < 10; vez += 1) {
    await page.goto(SUJA);
    await expect(page.getByRole('heading', { name: 'Execução' })).toBeVisible();
    await expect(page).toHaveURL(/aba=tarefas/);
    await expect(page).toHaveURL(/atrasadas=1/);
    await expect(page).not.toHaveURL(/status=xyz/);
    await expect(page).not.toHaveURL(/prazoDe=/);
    await expect(page).not.toHaveURL(/hoje=/);
  }
});
