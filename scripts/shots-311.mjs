import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.SHOT_BASE || 'http://127.0.0.1:3010';
const OUT = process.env.SHOT_OUT || '/workspace/gestop-311/evidencias/311';
const EMAIL = 'admin.gestop@franca.sp.gov.br';
const PASS = 'Gestop@123';
const UNID = process.env.ZZ_UNIDADE_ID || '94598015-4f73-41f3-80cd-5c375e776397';

mkdirSync(OUT, { recursive: true });

async function login(page) {
  // API login → localStorage (labels do form não usam htmlFor)
  const resp = await page.request.post('http://127.0.0.1:3011/auth/login', {
    data: { email: EMAIL, password: PASS },
  });
  if (!resp.ok()) throw new Error(`login API ${resp.status()} ${await resp.text()}`);
  const data = await resp.json();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((auth) => {
    localStorage.setItem('sigma.auth', JSON.stringify({
      accessToken: auth.accessToken,
      user: auth.user,
    }));
  }, data);
  await page.goto(`${BASE}/cco`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 });
}


async function ensureVistoriasDrawer(page) {
  if (await page.locator('[data-testid="drawer-vistoria-card"]').count()) return;
  if (!(await page.locator('aside[role="dialog"]').count())) {
    await page.getByRole('button').filter({ hasText: 'ZZTESTE-311' }).first().click({ force: true });
    await page.waitForSelector('aside[role="dialog"]', { timeout: 15000 });
  }
  await page.getByRole('tab', { name: /Vistorias/i }).click();
  await page.waitForSelector('[data-testid="drawer-vistoria-card"]', { timeout: 15000 });
}

async function openZztesteDrawer(page) {
  await page.goto(`${BASE}/cco`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  // lista lateral sincronizada com o mapa
  const row = page.getByRole('button').filter({ hasText: 'ZZTESTE-311' });
  await row.first().waitFor({ timeout: 20000 });
  await row.first().click();
  await page.waitForSelector('aside[role="dialog"]', { timeout: 15000 });
  await page.getByRole('tab', { name: /Vistorias/i }).click();
  await page.waitForSelector('[data-testid="drawer-vistoria-card"]', { timeout: 15000 });
}

async function main() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);

  await login(page);
  await openZztesteDrawer(page);

  // --- CCO-V10 antes ---
  await page.screenshot({ path: join(OUT, 'v10-antes.png'), fullPage: false });

  // abre modal da vistoria mais recente (primeira da lista)
  await page.locator('[data-testid="drawer-vistoria-card"]').first().click({ force: true });
  await page.waitForSelector('[data-testid="cco-vistoria-modal"]', { timeout: 15000 });
  await page.waitForTimeout(800);

  // --- CCO-V12 1280 ---
  await page.screenshot({ path: join(OUT, 'v12-1280.png'), fullPage: false });

  // --- CCO-V4 fotos ---
  const thumbs = page.locator('[data-testid="evidencia-foto-thumb"]');
  if ((await thumbs.count()) === 0) {
    // scroll no modal body
    await page.locator('[data-testid="cco-vistoria-modal"]').evaluate((el) => {
      const body = el.querySelector('.overflow-y-auto');
      if (body) body.scrollTop = body.scrollHeight;
    });
    await page.waitForTimeout(500);
  }
  await thumbs.first().click();
  await page.waitForSelector('[data-testid="image-gallery-lightbox"]', { timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, 'v4-lightbox-nav.png'), fullPage: false });
  // navega próxima se existir
  const next = page.locator('[data-testid="image-gallery-next"]');
  if (await next.count()) {
    await next.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, 'v4-lightbox-foto2.png'), fullPage: false });
  }
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid="image-gallery-lightbox"]', { state: 'detached', timeout: 5000 });

  // --- CCO-V4 anexo ---
  await page.locator('[data-testid="cco-vistoria-modal"]').evaluate((el) => {
    const body = el.querySelector('.overflow-y-auto');
    if (body) body.scrollTop = body.scrollHeight;
  });
  await page.waitForTimeout(300);
  const anexo = page.locator('[data-testid="evidencia-anexo"]');
  if ((await anexo.count()) === 0) throw new Error('Anexo não-imagem não encontrado no modal');
  await anexo.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(OUT, 'v4-anexo-nao-imagem.png'), fullPage: false });

  // fecha modal → V10 depois
  await page.locator('[data-testid="cco-vistoria-modal"]').getByRole('button', { name: /^Fechar$/i }).last().click();
  await page.waitForSelector('[data-testid="cco-vistoria-modal"]', { state: 'detached', timeout: 8000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, 'v10-depois.png'), fullPage: false });

  // --- CCO-V11 fullscreen ---
  // Força fallback CSS (requestFullscreen em headless costuma ser bloqueado).
  await page.evaluate(() => {
    const shell = document.querySelector('.sigma-map-shell');
    if (!shell) return;
    shell.classList.add('sigma-map-fullscreen', 'fixed', 'inset-0');
    shell.style.zIndex = '70';
    shell.setAttribute('data-shot-fs', '1');
  });
  await page.waitForTimeout(400);
  // drawer/modal precisam do portal host atualizado (MutationObserver na classe)
  if (!(await page.locator('aside[role="dialog"]').count())) {
    await page.getByRole('button').filter({ hasText: 'ZZTESTE-311' }).first().click({ force: true });
    await page.waitForSelector('aside[role="dialog"]');
    await page.getByRole('tab', { name: /Vistorias/i }).click();
  }
  await page.locator('[data-testid="drawer-vistoria-card"]').first().click({ force: true });
  await page.waitForSelector('[data-testid="cco-vistoria-modal"]', { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, 'v11-fullscreen-modal.png'), fullPage: false });
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid="cco-vistoria-modal"]', { state: 'detached', timeout: 8000 });
  await page.evaluate(() => {
    const shell = document.querySelector('.sigma-map-shell');
    shell?.classList.remove('sigma-map-fullscreen', 'fixed', 'inset-0');
    shell?.removeAttribute('data-shot-fs');
  });
  await page.waitForTimeout(300);

  // --- CCO-V12 tablet/mobile ---
  await page.setViewportSize({ width: 800, height: 1280 });
  await ensureVistoriasDrawer(page);
  await page.locator('[data-testid="drawer-vistoria-card"]').first().click({ force: true });
  await page.waitForSelector('[data-testid="cco-vistoria-modal"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, 'v12-800x1280.png'), fullPage: false });
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid="cco-vistoria-modal"]', { state: 'detached' });

  await page.setViewportSize({ width: 375, height: 812 });
  await ensureVistoriasDrawer(page);
  await page.locator('[data-testid="drawer-vistoria-card"]').first().click({ force: true });
  await page.waitForSelector('[data-testid="cco-vistoria-modal"]');
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, 'v12-375.png'), fullPage: false });
  await page.keyboard.press('Escape');

  // --- B1 erro lista ---
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.route('**/operacional/unidades/**', async (route) => {
    const url = route.request().url();
    const isDetalhe = /\/operacional\/unidades\/[0-9a-f-]{36}(\?|$)/i.test(url);
    if (route.request().method() === 'GET' && isDetalhe) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"erro zzteste"}' });
    } else await route.continue();
  });
  await page.goto(`${BASE}/cco`);
  await page.waitForTimeout(1500);
  await page.getByRole('button').filter({ hasText: 'ZZTESTE-311' }).first().click({ force: true });
  await page.waitForSelector('aside[role="dialog"]', { timeout: 15000 });
  await page.getByRole('tab', { name: /Vistorias/i }).click();
  await page.getByText(/Não foi possível carregar as vistorias\. Tentar de novo/).waitFor({ timeout: 15000 });
  await page.screenshot({ path: join(OUT, 'b1-erro-lista.png'), fullPage: false });

  await browser.close();
  console.log('OK shots em', OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
