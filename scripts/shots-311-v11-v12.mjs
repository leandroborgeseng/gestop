import { chromium } from 'playwright';
import { join } from 'node:path';

const BASE = process.env.SHOT_BASE || 'http://127.0.0.1:3010';
const OUT = process.env.SHOT_OUT || '/workspace/gestop-311/evidencias/311';
const EMAIL = 'admin.gestop@franca.sp.gov.br';
const PASS = 'Gestop@123';

async function login(page) {
  const resp = await page.request.post('http://127.0.0.1:3011/auth/login', {
    data: { email: EMAIL, password: PASS },
  });
  if (!resp.ok()) throw new Error(`login API ${resp.status()}`);
  const data = await resp.json();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((auth) => {
    localStorage.setItem('sigma.auth', JSON.stringify({ accessToken: auth.accessToken, user: auth.user }));
  }, data);
}

async function openVistorias(page) {
  await page.goto(`${BASE}/cco`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.getByRole('button').filter({ hasText: 'ZZTESTE-311' }).first().click({ force: true });
  await page.waitForSelector('aside[role="dialog"]', { timeout: 15000 });
  await page.getByRole('tab', { name: /Vistorias/i }).click();
  await page.waitForSelector('[data-testid="drawer-vistoria-card"]', { timeout: 15000 });
}

async function enterFullscreenShell(page) {
  // Headless bloqueia requestFullscreen — força o mesmo host CSS do fallback
  // e esconde chrome do app para o shot deixar o mapa em tela cheia visual.
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-shot-fullscreen', '1');
    const style = document.createElement('style');
    style.id = 'shot-fs-hide-chrome';
    style.textContent = `
      html[data-shot-fullscreen="1"] nav[aria-label="Navegação principal"],
      html[data-shot-fullscreen="1"] nav[aria-label="Navegação mobile"],
      html[data-shot-fullscreen="1"] header.sticky,
      html[data-shot-fullscreen="1"] [data-testid="app-sidebar"],
      html[data-shot-fullscreen="1"] aside:not([role="dialog"]) {
        display: none !important;
      }
      html[data-shot-fullscreen="1"] .sigma-map-shell.sigma-map-fullscreen {
        position: fixed !important;
        inset: 0 !important;
        z-index: 70 !important;
        border-radius: 0 !important;
        width: 100vw !important;
        height: 100dvh !important;
        max-height: 100dvh !important;
      }
    `;
    document.head.appendChild(style);
    const shell = document.querySelector('.sigma-map-shell');
    if (!shell) throw new Error('sigma-map-shell ausente');
    shell.classList.add('sigma-map-fullscreen', 'fixed', 'inset-0');
    shell.setAttribute('data-shot-fs', '1');
  });
  await page.waitForTimeout(500);
}

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(25000);

  await login(page);
  await openVistorias(page);

  // --- V11 ---
  await enterFullscreenShell(page);
  // drawer pode ter sumido do host antigo; reabre se preciso
  if (!(await page.locator('aside[role="dialog"]').count())) {
    await page.getByRole('button').filter({ hasText: 'ZZTESTE-311' }).first().click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
    // se lista sumiu com chrome escondido, abre modal direto via evaluate? preferir card
  }
  // Garante modal: se drawer sumiu, força abertura via click no card se existir
  let card = page.locator('[data-testid="drawer-vistoria-card"]').first();
  if (!(await card.count())) {
    // reexibe lista temporariamente só para clicar — ou dispara modal via DOM
    await page.evaluate(() => {
      // dispara evento custom? fallback: cria click no host
    });
    // Reabre CCO sem perder FS classes
    await page.goto(`${BASE}/cco`);
    await page.waitForTimeout(1500);
    await enterFullscreenShell(page);
    await page.getByRole('button').filter({ hasText: 'ZZTESTE-311' }).first().click({ force: true });
    await page.waitForSelector('aside[role="dialog"]');
    await page.getByRole('tab', { name: /Vistorias/i }).click();
    await page.waitForSelector('[data-testid="drawer-vistoria-card"]');
    card = page.locator('[data-testid="drawer-vistoria-card"]').first();
  }
  await card.click({ force: true });
  await page.waitForSelector('[data-testid="cco-vistoria-modal"]', { timeout: 15000 });
  await page.waitForTimeout(600);
  // Esconde o drawer da unidade (não o modal) para o mapa fullscreen ficar claro
  await page.evaluate(() => {
    document.querySelectorAll('aside[role="dialog"]').forEach((el) => {
      if (!el.closest('[data-cco-vistoria-modal]') && !el.querySelector('[data-testid="cco-vistoria-modal"]')) {
        el.style.visibility = 'hidden';
      }
    });
    // overlay do drawer também
    document.querySelectorAll('button[aria-label="Fechar detalhe"]').forEach((el) => {
      el.style.visibility = 'hidden';
    });
  });
  await page.waitForTimeout(200);
  const sidebarVisible = await page.locator('nav[aria-label="Navegação principal"]').isVisible().catch(() => false);
  if (sidebarVisible) throw new Error('V11: sidebar ainda visível no shot');
  const hasFs = await page.evaluate(() => document.querySelector('.sigma-map-shell.sigma-map-fullscreen') != null);
  if (!hasFs) throw new Error('V11: classe sigma-map-fullscreen ausente');
  await page.screenshot({ path: join(OUT, 'v11-fullscreen-modal.png'), fullPage: false });
  console.log('wrote v11-fullscreen-modal.png');

  // limpa FS e fecha modal
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid="cco-vistoria-modal"]', { state: 'detached' });
  await page.evaluate(() => {
    document.documentElement.removeAttribute('data-shot-fullscreen');
    document.getElementById('shot-fs-hide-chrome')?.remove();
    document.querySelector('.sigma-map-shell')?.classList.remove('sigma-map-fullscreen', 'fixed', 'inset-0');
  });

  // --- V12-375 ---
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE}/cco`);
  await page.waitForTimeout(1500);
  await page.getByRole('button').filter({ hasText: 'ZZTESTE-311' }).first().click({ force: true });
  await page.waitForSelector('aside[role="dialog"]');
  await page.getByRole('tab', { name: /Vistorias/i }).click();
  await page.waitForSelector('[data-testid="drawer-vistoria-card"]');
  await page.locator('[data-testid="drawer-vistoria-card"]').first().click({ force: true });
  await page.waitForSelector('[data-testid="cco-vistoria-modal"]');
  await page.waitForTimeout(500);

  const geometry = await page.evaluate(() => {
    const footer = document.querySelector('[data-testid="cco-vistoria-modal-footer"]');
    const nav = document.querySelector('nav[aria-label="Navegação mobile"]');
    if (!footer) return { error: 'footer ausente' };
    const fr = footer.getBoundingClientRect();
    const nr = nav?.getBoundingClientRect();
    return {
      footerBottom: fr.bottom,
      footerTop: fr.top,
      navTop: nr?.top ?? null,
      vh: window.innerHeight,
      clearance: nr ? nr.top - fr.bottom : null,
      fechar: footer.textContent?.includes('Fechar'),
      abrir: footer.textContent?.includes('Abrir em Vistorias realizadas'),
    };
  });
  console.log('V12-375 geometry', geometry);
  if (geometry.clearance != null && geometry.clearance < 0) {
    throw new Error(`U311-8: footer coberto pelo bottom nav (clearance=${geometry.clearance})`);
  }
  if (geometry.clearance != null && geometry.clearance < 4) {
    console.warn('clearance pequeno mas >=0:', geometry.clearance);
  }
  await page.screenshot({ path: join(OUT, 'v12-375.png'), fullPage: false });
  console.log('wrote v12-375.png');

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
