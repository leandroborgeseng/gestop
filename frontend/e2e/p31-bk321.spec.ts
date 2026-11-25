import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
import { barraEmpilhada } from '../lib/cco-detalhe-barra';

/**
 * P3.1 — vista manual do mapa e corte da barra em 80rem.
 * Dados sintéticos só no mock.
 * BK-321-O2: 125% (20px) e 150% (24px) são a fonte padrão do Chromium
 * (Preferences webkit.webprefs.default_font_size), não um font-size CSS.
 * O media query em rem usa essa fonte inicial. O WebKit do Playwright não
 * expõe o mesmo ajuste: o teste registra a fonte real do motor e cruza o 80rem nela.
 */
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../evidencias/p31');
mkdirSync(OUT, { recursive: true });

const CHAMADO = 'ZZ Chamado Barra P31';
const USER = {
  id: 'u-p31-cco',
  nome: 'ZZTESTE P31 CCO',
  email: 'zzteste-p31-cco@aion.local',
  perfis: ['Gestor CCO'],
  permissoes: ['dashboard.visualizar'],
  secretaria: { id: 'sec-1', nome: 'Educação', sigla: 'SME' },
  perfilAtivo: { id: 'p-1', nome: 'Gestor CCO' },
  perfisDisponiveis: [{ id: 'p-1', nome: 'Gestor CCO' }],
  secretariaAtiva: { id: 'sec-1', nome: 'Educação', sigla: 'SME' },
  secretariasDisponiveis: [{ id: 'sec-1', nome: 'Educação', sigla: 'SME' }],
};

function chamadoItem() {
  return {
    id: 'ch-p31',
    codigo: 'CH-ZZ-P31',
    titulo: CHAMADO,
    descricao: 'Chamado sintético P31.',
    status: 'ABERTO',
    prioridade: 'MEDIA',
    origem: 'INTERNO',
    prazoEm: '2026-12-31T00:00:00.000Z',
    previstaExecucaoEm: null,
    enderecoTexto: 'Rua Sintética, 31',
    enderecoBairro: 'Centro',
    latitude: -20.5386,
    longitude: -47.4007,
    mapaLatitude: -20.5386,
    mapaLongitude: -47.4007,
    slaMapa: 'DENTRO',
    createdAt: '2026-02-01T12:00:00.000Z',
    secretaria: { id: 'sec-1', nome: 'Educação', sigla: 'SME' },
    unidade: { id: 'zz-p31', nome: 'EMEB ZZ P31', codigoPatrimonial: 'ZZ-P31', endereco: 'Rua Sintética, 31', bairro: 'Centro', latitude: -20.5386, longitude: -47.4007 },
    equipe: { id: 'eq-1', nome: 'Equipe ZZ' },
    tipoChamado: { id: 'tc-1', nome: CHAMADO },
    responsavel: { id: 'u-1', nome: 'Ana ZZ' },
  };
}

function unidadeBase() {
  return {
    id: 'zz-p31',
    codigoPatrimonial: 'ZZ-P31',
    nome: 'EMEB ZZ P31',
    tipo: 'ESCOLA',
    endereco: 'Rua Sintética, 31',
    bairro: 'Centro',
    cep: '14400-000',
    latitude: -20.5386,
    longitude: -47.4007,
    raioValidacaoMetros: 50,
    ativo: true,
    situacao: 'COM_PENDENCIAS',
    secretaria: { id: 'sec-1', nome: 'Educação', sigla: 'SME', responsavelNome: 'Ana ZZ' },
    pendencias: { naoConformidadesAbertas: 0, naoConformidadesSemChamadoAberto: 0, chamadosAbertos: 1, semVistoria: false, vistoriaAtrasada: null },
    pendenciasUnicas: 0,
    totais: { fiscalizacoes: 0, naoConformidadesAbertas: 0, chamadosAbertos: 1 },
    slaMapa: 'DENTRO',
    ultimaVistoriaNota: null,
  };
}

function motor(nome: string) {
  return nome.includes('webkit') ? 'webkit' : 'chromium';
}

function gravar(item: string, nome: string, dados: unknown) {
  const pasta = path.join(OUT, item);
  mkdirSync(pasta, { recursive: true });
  writeFileSync(path.join(pasta, nome), JSON.stringify(dados, null, 2));
}

async function preparar(page: Page) {
  await page.addInitScript((auth) => {
    localStorage.setItem('sigma.auth', JSON.stringify({ accessToken: 'token-p31-cco', user: auth, expiresAt: Date.now() + 86_400_000 }));
  }, USER);
  await page.route(/basemaps\.cartocdn\.com|arcgisonline\.com|openstreetmap\.org/, (route) => route.abort());
  await page.route('**/api-gestop/**', async (route) => {
    const pathName = new URL(route.request().url()).pathname.replace(/^\/api-gestop/, '');
    const send = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (pathName === '/auth/me') return send(USER);
    if (pathName === '/operacional/resumo') {
      return send({ totalUnidades: 1, unidadesAtivas: 1, totalSecretarias: 1, fiscalizacoesConcluidas: 0, naoConformidadesAbertas: 0, chamadosAbertos: 1, vistoriasAtrasadas: 0, totalPendencias: 0, eventosSyncPendentes: 0 });
    }
    if (pathName === '/operacional/opcoes-filtro') {
      return send({ secretarias: [{ id: 'sec-1', nome: 'Educação', sigla: 'SME' }], bairros: ['Centro'], tipos: ['ESCOLA'], responsaveis: [], emails: [], equipes: [], tiposChamado: [{ id: 'tc-1', nome: CHAMADO }] });
    }
    if (pathName === '/operacional/unidades') return send([unidadeBase()]);
    if (pathName === '/operacional/chamados-mapa') return send({ items: [chamadoItem()], total: 1, truncado: false });
    if (pathName.includes('/documentos/pendencias')) return send({ abrir: false, pendencias: { total: 0, grupos: [] }, total: 0, grupos: [] });
    if (pathName.includes('/monitoramento/alertas')) {
      return send({ resumo: { chamadosAtrasados: 0, chamadosSemTriagem: 0, syncFalhas: 0, chamadosUrgentes: 0 }, chamadosAtrasados: [], chamadosSemTriagem: [] });
    }
    if (route.request().method() === 'GET') return send([]);
    return send({});
  });
}

async function vista(page: Page) {
  return page.locator('.sigma-map-shell').first().evaluate((el) => ({
    lat: Number(el.getAttribute('data-map-lat')),
    lng: Number(el.getAttribute('data-map-lng')),
    zoom: Number(el.getAttribute('data-map-zoom')),
  }));
}

function mesmaVista(a: { lat: number; lng: number; zoom: number }, b: { lat: number; lng: number; zoom: number }) {
  expect(Math.abs(a.lat - b.lat)).toBeLessThan(0.00005);
  expect(Math.abs(a.lng - b.lng)).toBeLessThan(0.00005);
  expect(Math.abs(a.zoom - b.zoom)).toBeLessThan(0.01);
}

test('BK-321-O1 centro e zoom manuais sobrevivem à barra, ao corte e à rotação', async ({ page, browserName }) => {
  test.setTimeout(60_000);
  const tag = motor(browserName);
  await page.setViewportSize({ width: 1440, height: 900 });
  await preparar(page);
  await page.goto('/cco');
  const todos = page.getByRole('button', { name: 'Todos os chamados' });
  await expect(todos).toBeVisible({ timeout: 20_000 });
  await todos.click();
  await expect(page.locator('.cco-list-panel').getByRole('button', { name: CHAMADO })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.leaflet-control-zoom-in')).toBeVisible();
  await page.waitForTimeout(1200);
  const antes = await vista(page);
  await page.locator('.leaflet-control-zoom-in').click();
  await expect.poll(async () => (await vista(page)).zoom).toBeGreaterThan(antes.zoom);
  await page.waitForTimeout(700);
  const manual = await vista(page);

  await page.locator('.cco-list-panel').getByRole('button', { name: CHAMADO }).click();
  await expect(page.getByTestId('cco-detalhe-barra')).toBeVisible();
  await page.waitForTimeout(900);
  mesmaVista(await vista(page), manual);
  await page.getByTestId('cco-detalhe-fechar').click();
  await expect(page.getByTestId('cco-detalhe-barra')).toHaveCount(0);
  await page.waitForTimeout(900);
  mesmaVista(await vista(page), manual);

  await page.locator('.cco-list-panel').getByRole('button', { name: CHAMADO }).click();
  await expect(page.getByTestId('cco-detalhe-barra')).toBeVisible();
  for (const vp of [
    { w: 1279, h: 800 },
    { w: 1280, h: 800 },
    { w: 900, h: 1440 },
  ]) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.waitForTimeout(900);
    mesmaVista(await vista(page), manual);
  }
  const pasta = path.join(OUT, 'BK-321-O1');
  mkdirSync(pasta, { recursive: true });
  await page.screenshot({ path: path.join(pasta, `${tag}-vista.png`), animations: 'disabled' });
  gravar('BK-321-O1', `assert-${tag}.json`, { manual });
});

async function esperarDepuracao(porta: number) {
  const inicio = Date.now();
  while (Date.now() - inicio < 15_000) {
    try {
      const resposta = await fetch(`http://127.0.0.1:${porta}/json/version`);
      if (resposta.ok) return;
    } catch {
      /* o Chrome ainda está subindo */
    }
    await new Promise((resolver) => setTimeout(resolver, 100));
  }
  throw new Error(`Chrome não abriu a porta ${porta}`);
}

/**
 * Chromium: a fonte padrão vem do perfil (default_font_size), que é o valor
 * inicial do rem. CSS em um elemento não move @media (max-width: 79.999rem).
 */
async function chromeComFontePadrao(px: number) {
  const dir = mkdtempSync(path.join(tmpdir(), 'p31-fonte-'));
  mkdirSync(path.join(dir, 'Default'));
  writeFileSync(
    path.join(dir, 'Default', 'Preferences'),
    JSON.stringify({ webkit: { webprefs: { default_font_size: px, default_fixed_font_size: px } } }),
  );
  const porta = 9400 + (px % 10) + Math.floor(Math.random() * 400);
  const filho: ChildProcess = spawn(
    chromium.executablePath(),
    [
      `--user-data-dir=${dir}`,
      `--remote-debugging-port=${porta}`,
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--no-sandbox',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  await esperarDepuracao(porta);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${porta}`);
  const pagina = browser.contexts()[0].pages()[0] ?? (await browser.contexts()[0].newPage());
  return {
    pagina,
    async fechar() {
      await browser.close().catch(() => undefined);
      if (!filho.killed) filho.kill('SIGKILL');
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

async function medirCorte(page: Page) {
  return page.evaluate(() => {
    const barra = document.querySelector('[data-testid="cco-detalhe-barra"]');
    const grade = document.querySelector('.cco-workspace');
    return {
      fonte: parseFloat(getComputedStyle(document.documentElement).fontSize),
      barra: barra ? getComputedStyle(barra).position : 'ausente',
      colunas: grade ? getComputedStyle(grade).gridTemplateColumns : 'ausente',
      estreita: window.matchMedia('(max-width: 79.999rem)').matches,
    };
  });
}

async function abrirChamado(page: Page, base: string) {
  await preparar(page);
  await page.goto(base.endsWith('/cco') ? base : `${base.replace(/\/$/, '')}/cco`);
  const todos = page.getByRole('button', { name: 'Todos os chamados' });
  await expect(todos).toBeVisible({ timeout: 20_000 });
  await todos.click();
  const botao = page.locator('.cco-list-panel').getByRole('button', { name: CHAMADO });
  await expect(botao).toBeVisible({ timeout: 30_000 });
  await botao.click();
  await expect(page.getByTestId('cco-detalhe-barra')).toBeVisible();
}

test('BK-321-O2 a barra e a grade cruzam juntas o corte de 80rem', async ({ page, browserName, baseURL }) => {
  test.setTimeout(120_000);
  const tag = motor(browserName);
  const base = baseURL ?? 'http://localhost:3000';
  expect(barraEmpilhada(1599, 20)).toBe(true);
  expect(barraEmpilhada(1600, 20)).toBe(false);
  expect(barraEmpilhada(1919, 24)).toBe(true);
  expect(barraEmpilhada(1920, 24)).toBe(false);

  if (tag === 'webkit') {
    await page.setViewportSize({ width: 1440, height: 900 });
    await abrirChamado(page, base);
    const fonteInicial = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    const corte = 80 * fonteInicial;
    await page.setViewportSize({ width: Math.floor(corte) - 1, height: 800 });
    await page.waitForTimeout(300);
    const abaixo = await medirCorte(page);
    const pasta = path.join(OUT, 'BK-321-O2');
    mkdirSync(pasta, { recursive: true });
    await page.screenshot({ path: path.join(pasta, 'webkit-padrao-abaixo.png'), animations: 'disabled' });
    await page.setViewportSize({ width: Math.ceil(corte), height: 800 });
    await page.waitForTimeout(300);
    const acima = await medirCorte(page);
    await page.screenshot({ path: path.join(pasta, 'webkit-padrao-acima.png'), animations: 'disabled' });
    expect(abaixo.estreita).toBe(true);
    expect(abaixo.barra).toBe('fixed');
    expect(acima.estreita).toBe(false);
    expect(acima.barra).toBe('sticky');
    expect(acima.colunas).not.toBe(abaixo.colunas);
    gravar('BK-321-O2', 'assert-webkit.json', {
      mecanismo:
        'O WebKit automatizado do Playwright não aplica default-font-size: o protocolo não tem esse ajuste e --config-file não alcança a página criada pela automação. O corte foi medido na fonte padrão real do motor.',
      fonte: fonteInicial,
      corte,
      abaixo,
      acima,
    });
    return;
  }

  const medicoes: Array<Record<string, unknown>> = [];
  for (const fonte of [20, 24]) {
    const { pagina, fechar } = await chromeComFontePadrao(fonte);
    try {
      const emBranco = await pagina.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
      expect(emBranco).toBe(fonte);
      await pagina.setViewportSize({ width: 1440, height: 900 });
      const depoisDoViewport = await pagina.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
      expect(depoisDoViewport).toBe(fonte);
      await abrirChamado(pagina, base);
      const naApp = await pagina.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
      expect(naApp).toBe(fonte);
      const corte = 80 * fonte;
      await pagina.setViewportSize({ width: Math.floor(corte) - 1, height: 800 });
      await pagina.waitForTimeout(300);
      const abaixo = await medirCorte(pagina);
      const pasta = path.join(OUT, 'BK-321-O2');
      mkdirSync(pasta, { recursive: true });
      const rotulo = fonte === 20 ? '125' : '150';
      await pagina.screenshot({ path: path.join(pasta, `chromium-${rotulo}-abaixo.png`), animations: 'disabled' });
      await pagina.setViewportSize({ width: Math.ceil(corte), height: 800 });
      await pagina.waitForTimeout(300);
      const acima = await medirCorte(pagina);
      await pagina.screenshot({ path: path.join(pasta, `chromium-${rotulo}-acima.png`), animations: 'disabled' });
      expect(abaixo.fonte).toBe(fonte);
      expect(acima.fonte).toBe(fonte);
      expect(abaixo.estreita).toBe(true);
      expect(abaixo.barra).toBe('fixed');
      expect(acima.estreita).toBe(false);
      expect(acima.barra).toBe('sticky');
      expect(acima.colunas).not.toBe(abaixo.colunas);
      medicoes.push({ fonte, corte, emBranco, abaixo, acima });
    } finally {
      await fechar();
    }
  }
  gravar('BK-321-O2', 'assert-chromium.json', {
    mecanismo:
      'Chromium lançado com user-data-dir e Preferences webkit.webprefs.default_font_size 20 (125%) e 24 (150%). A página em branco já mede essa fonte, antes de qualquer CSS da aplicação.',
    medicoes,
  });
});
