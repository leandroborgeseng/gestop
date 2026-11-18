import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * 322 R-1: Voltar no celular não reabre o registro.
 * API real, sem page.route. O eco não pode repor id/tarefa depois do histórico.
 */
const EMAIL = 'admin.gestop@franca.sp.gov.br';
const SENHA = process.env.GESTOP_ADMIN_PASSWORD ?? 'Gestop@123';

test.use({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });

test.beforeAll(() => {
  const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  execFileSync('npx', ['tsx', 'scripts/seed-322-r1.ts'], {
    cwd: raiz,
    stdio: 'inherit',
    env: process.env,
  });
});

async function entrar(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
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

async function voltarEManter(page: Page, filtro: RegExp) {
  await page.goBack();
  await page.waitForTimeout(3_000);
  const url = new URL(page.url());
  expect(url.searchParams.get('id')).toBeNull();
  expect(url.searchParams.get('tarefa')).toBeNull();
  await expect(page).toHaveURL(filtro);
}

test.describe('322 R-1 voltar sem reabrir o registro', () => {
  test.setTimeout(90_000);

  test('Chamados: o id não volta', async ({ page }) => {
    await entrar(page);
    await page.goto('/chamados?status=aberto&prioridade=alta');
    await page.getByRole('button', { name: /ZZR1-001/ }).click();
    await expect(page).toHaveURL(/[?&]id=/);
    await voltarEManter(page, /status=aberto/);
    await expect(page).toHaveURL(/prioridade=alta/);
    await expect(page.getByRole('button', { name: /ZZR1-001/ })).toBeVisible();
  });

  test('Documentos: o id não volta', async ({ page }) => {
    await entrar(page);
    await page.goto('/documentos?tipo=notificacao');
    await page.getByRole('button', { name: /ZZR1-DOC/ }).click();
    await expect(page).toHaveURL(/[?&]id=/);
    await voltarEManter(page, /tipo=notificacao/);
    await expect(page.getByRole('button', { name: /ZZR1-DOC/ })).toBeVisible();
  });

  test('Vistorias: o id não volta', async ({ page }) => {
    await entrar(page);
    await page.goto('/vistorias?tipoUnidade=escola');
    await page.getByRole('button', { name: /ZZR1 Unidade/ }).click();
    await expect(page).toHaveURL(/[?&]id=/);
    await voltarEManter(page, /tipoUnidade=escola/);
    await expect(page.getByRole('button', { name: /ZZR1 Unidade/ })).toBeVisible();
  });

  test('Execução: a tarefa não volta', async ({ page }) => {
    await entrar(page);
    await page.goto('/execucao?aba=tarefas');
    await page.getByRole('button', { name: /ZZR1-001/ }).click();
    await expect(page).toHaveURL(/[?&]tarefa=/);
    await voltarEManter(page, /aba=tarefas/);
    await expect(page.getByRole('button', { name: /ZZR1-001/ })).toBeVisible();
  });
});
