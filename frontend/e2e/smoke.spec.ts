import { test, expect } from '@playwright/test';

test('login page renders', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Entrar no sistema' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Esqueci minha senha' })).toBeVisible();
});

test('password recovery page renders', async ({ page }) => {
  await page.goto('/recuperar-senha');
  await expect(page.getByRole('heading', { name: 'Recuperar senha' })).toBeVisible();
});

test('public chamado page renders', async ({ page }) => {
  await page.goto('/chamado/PMF-ESC-001');
  await expect(page.getByText('Prefeitura de Franca')).toBeVisible();
  await expect(page.getByText('Chamado via QR Code')).toBeVisible();
});

test('relatorios page requires login', async ({ page }) => {
  await page.goto('/relatorios');
  await expect(page).toHaveURL(/\/login/);
});
