import { test, expect } from '@playwright/test';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe('Health checks', () => {
  test('frontend health proxy responde', async ({ request }) => {
    const response = await request.get('/api/health/backend');
    expect(response.status()).toBeLessThan(500);
    const body = await response.json();
    expect(body).toHaveProperty('status');
  });

  test('login page carrega', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Entrar no sistema' })).toBeVisible();
  });
});

test.describe('Fluxo autenticado', () => {
  test.skip(!adminEmail || !adminPassword, 'Defina E2E_ADMIN_EMAIL e E2E_ADMIN_PASSWORD');

  test('login redireciona para dashboard ou cco', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/e-mail/i).fill(adminEmail!);
    await page.getByLabel(/senha/i).fill(adminPassword!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
  });

  test('CCO carrega apos login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/e-mail/i).fill(adminEmail!);
    await page.getByLabel(/senha/i).fill(adminPassword!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.goto('/cco');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).toContainText(/unidade|mapa|CCO/i);
  });

  test('fila em execucao carrega apos login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/e-mail/i).fill(adminEmail!);
    await page.getByLabel(/senha/i).fill(adminPassword!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.goto('/execucao');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).toContainText(/execu/i);
  });

  test('admin importacao acessivel', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/e-mail/i).fill(adminEmail!);
    await page.getByLabel(/senha/i).fill(adminPassword!);
    await page.getByRole('button', { name: /entrar/i }).click();
    await page.goto('/admin');
    await expect(page.locator('body')).toContainText(/Importação|Administração|Webmap/i);
  });
});

test.describe('Chamado publico', () => {
  test('pagina de chamado publico renderiza', async ({ page }) => {
    await page.goto('/chamado/PMF-ESC-001');
    await expect(page.getByRole('heading', { name: /chamado/i })).toBeVisible();
  });
});
