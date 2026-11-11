import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });
import { barraEmpilhada } from '../lib/cco-detalhe-barra';

/**
 * P3.1 — vista manual do mapa e corte da barra em 80rem.
 * Dados sintéticos só no mock. 125% e 150% são a fonte inicial do navegador:
 * o Playwright não troca essa fonte, então o número entra pela mesma função do corte
 * e o navegador cruza o 80rem vivo.
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

test('BK-321-O2 a barra e a grade cruzam juntas o corte de 80rem', async ({ page, browserName }) => {
  const tag = motor(browserName);
  expect(barraEmpilhada(1599, 20)).toBe(true);
  expect(barraEmpilhada(1600, 20)).toBe(false);
  expect(barraEmpilhada(1919, 24)).toBe(true);
  expect(barraEmpilhada(1920, 24)).toBe(false);

  await page.setViewportSize({ width: 1440, height: 900 });
  await preparar(page);
  await page.goto('/cco');
  const todos = page.getByRole('button', { name: 'Todos os chamados' });
  await expect(todos).toBeVisible({ timeout: 20_000 });
  await todos.click();
  const botao = page.locator('.cco-list-panel').getByRole('button', { name: CHAMADO });
  await expect(botao).toBeVisible({ timeout: 30_000 });
  await botao.click();
  await expect(page.getByTestId('cco-detalhe-barra')).toBeVisible();

  const fonte = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  const corte = 80 * fonte;
  async function medir() {
    return page.evaluate(() => {
      const barra = document.querySelector('[data-testid="cco-detalhe-barra"]');
      const grade = document.querySelector('.cco-workspace');
      return {
        barra: barra ? getComputedStyle(barra).position : 'ausente',
        colunas: grade ? getComputedStyle(grade).gridTemplateColumns : 'ausente',
        estreita: window.matchMedia('(max-width: 79.999rem)').matches,
      };
    });
  }
  await page.setViewportSize({ width: Math.floor(corte) - 1, height: 800 });
  await page.waitForTimeout(300);
  const abaixo = await medir();
  const pasta = path.join(OUT, 'BK-321-O2');
  mkdirSync(pasta, { recursive: true });
  await page.screenshot({ path: path.join(pasta, `${tag}-abaixo.png`), animations: 'disabled' });
  await page.setViewportSize({ width: Math.ceil(corte), height: 800 });
  await page.waitForTimeout(300);
  const acima = await medir();
  await page.screenshot({ path: path.join(pasta, `${tag}-acima.png`), animations: 'disabled' });

  expect(abaixo.estreita).toBe(true);
  expect(abaixo.barra).toBe('fixed');
  expect(acima.estreita).toBe(false);
  expect(acima.barra).toBe('sticky');
  expect(acima.colunas).not.toBe(abaixo.colunas);
  gravar('BK-321-O2', `assert-${tag}.json`, { fonte, corte, abaixo, acima, fonte125: 20 * 80, fonte150: 24 * 80 });
});
