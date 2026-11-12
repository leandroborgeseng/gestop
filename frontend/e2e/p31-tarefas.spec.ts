import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

/**
 * P3.1 — lista de tarefas, pin, filtros e resumo.
 * Usuário e chamados sintéticos só no mock de /api-gestop.
 */
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../evidencias/p31');
mkdirSync(OUT, { recursive: true });

const RESUMO =
  'ZZ resumo completo do chamado P31 com texto longo o bastante para cortar na lista e revelar no mouse';

/** 322 C-2 só abre a sheet com UUID. `t1` permanece na URL e mostra o aviso. */
const ID_TAREFA_1 = 'a31a0001-0000-4000-8000-000000000001';
const ID_TAREFA_2 = 'a31a0002-0000-4000-8000-000000000002';

const USER = {
  id: 'u-p31',
  nome: 'ZZTESTE P31',
  email: 'zzteste-p31@aion.local',
  perfis: ['ZZTESTE P31'],
  permissoes: [
    'chamados.executar',
    'matriz.execucao.tarefas.visualizar',
    'dashboard.visualizar',
  ],
  secretaria: { id: 'sec-p31', nome: 'Secretaria Fictícia P31', sigla: 'ZZP31' },
  perfilAtivo: { id: 'perfil-p31', nome: 'ZZTESTE P31' },
  perfisDisponiveis: [{ id: 'perfil-p31', nome: 'ZZTESTE P31' }],
  secretariaAtiva: { id: 'sec-p31', nome: 'Secretaria Fictícia P31', sigla: 'ZZP31' },
  secretariasDisponiveis: [{ id: 'sec-p31', nome: 'Secretaria Fictícia P31', sigla: 'ZZP31' }],
};

function tarefa(id: string, titulo: string, codigo: string, comResponsavel: boolean, lat: number) {
  return {
    id,
    titulo,
    descricao: null,
    prazo: '2026-10-20T15:00:00.000Z',
    prioridade: 'MEDIA',
    status: 'NOVA',
    justificativa: null,
    conclusaoTexto: null,
    observacao: null,
    atrasada: false,
    createdAt: '2026-10-01T12:00:00.000Z',
    concluidaEm: null,
    visualizadaEm: null,
    secretaria: { id: 'sec-p31', nome: 'Secretaria Fictícia P31', sigla: 'ZZP31' },
    equipe: { id: 'eq-p31', nome: 'Equipe ZZ P31' },
    responsavel: comResponsavel ? { id: 'u-ana', nome: 'Ana ZZ' } : null,
    criadaPor: null,
    concluidaPor: null,
    anexos: [],
    podeTratar: true,
    historico: [],
    chamado: {
      id: `c-${id}`,
      codigo,
      titulo: RESUMO,
      descricao: 'Descrição sintética do chamado P31.',
      status: 'EM_EXECUCAO',
      prioridade: 'MEDIA',
      enderecoTexto: 'Rua Sintética, 31',
      prazoEm: null,
      latitude: lat,
      longitude: -47.4007,
      tipoChamado: { id: 'tp-p31', nome: 'Tipo sintético P31' },
      unidade: null,
      secretaria: null,
      equipe: null,
    },
  };
}

const TAREFAS = [
  tarefa(ID_TAREFA_1, 'Laudo da praça', 'CH-P31-0001', true, -20.2),
  tarefa(ID_TAREFA_2, 'Segunda medição', 'CH-P31-0002', false, -21.0),
];

const LISTA = {
  total: TAREFAS.length,
  contadores: { novas: 2, emAndamento: 0, atrasadas: 0 },
  items: TAREFAS,
};

const RELATORIO = {
  total: 1,
  limite: 500,
  indicadores: {
    abertas: 1,
    novas: 1,
    emAndamento: 0,
    impedidas: 0,
    concluidas: 0,
    atrasadas: 0,
    porSecretaria: [],
    porEquipe: [],
    porResponsavel: [],
    porTipoChamado: [],
  },
  items: [{ ...TAREFAS[0], situacaoPrazo: 'NO_PRAZO' }],
};

function motor(nome: string) {
  return nome.includes('webkit') ? 'webkit' : 'chromium';
}

function gravar(item: string, nome: string, dados: unknown) {
  const pasta = path.join(OUT, item);
  mkdirSync(pasta, { recursive: true });
  writeFileSync(path.join(pasta, nome), JSON.stringify(dados, null, 2));
}

async function mockApi(page: Page) {
  const cargas: string[] = [];
  await page.route(/basemaps\.cartocdn\.com|arcgisonline\.com|openstreetmap\.org/, (route) => route.abort());
  await page.route('**/api-gestop/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const pathName = url.pathname.replace(/^\/api-gestop/, '');
    const send = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (pathName === '/auth/me' || pathName === '/auth/login') return send(pathName.endsWith('me') ? USER : { accessToken: 'token-p31', tokenType: 'Bearer', expiresInSeconds: 3600, user: USER });
    if (pathName.includes('/documentos/pendencias-abertura-diaria')) return send({ abrir: false, pendencias: { total: 0, grupos: [] } });
    if (pathName === '/operacional/secretarias') return send([{ id: 'sec-p31', nome: 'Secretaria Fictícia P31', sigla: 'ZZP31' }]);
    if (pathName.includes('/chamados/equipes')) return send([{ id: 'eq-p31', nome: 'Equipe ZZ P31' }]);
    if (pathName.includes('/chamados/usuarios/ativos')) return send([{ id: 'u-ana', nome: 'Ana ZZ' }]);
    if (pathName.includes('/chamados/tipos/opcoes')) return send([{ id: 'tp-p31', nome: 'Tipo sintético P31' }]);
    if (pathName.includes('/chamados/em-execucao')) return send({ total: 0, minhasEquipeIds: [], grupos: [] });
    if (pathName.includes('/chamado-tarefas/execucao')) {
      cargas.push(url.search);
      return send(LISTA);
    }
    if (pathName.includes('/chamado-tarefas/relatorio')) return send(RELATORIO);
    if (pathName === `/chamado-tarefas/${ID_TAREFA_1}` || pathName === `/chamado-tarefas/${ID_TAREFA_2}`) {
      return send(TAREFAS.find((item) => pathName.endsWith(item.id)));
    }
    if (pathName.includes('/chamado-tarefas/') && pathName.includes('/chamado/')) {
      return send({ message: 'não encontrado' }, 404);
    }
    if (pathName.includes('/monitoramento/dashboard')) {
      return send({
        indicadores: { totalUnidades: 0, fiscalizacoes: 0, naoConformidades: 0, chamados: { abertos: 0, emAtendimento: 0, emExecucao: 0, impedidos: 0, concluidos: 0 }, syncPendentes: 0 },
        pendenciasPorSecretaria: [],
      });
    }
    if (pathName.includes('/monitoramento/alertas')) {
      return send({ resumo: { chamadosAtrasados: 0, chamadosSemTriagem: 0, syncFalhas: 0, chamadosUrgentes: 0 }, chamadosAtrasados: [], chamadosSemTriagem: [] });
    }
    if (req.method() === 'GET') return send([]);
    return send({});
  });
  return { cargas: () => [...cargas] };
}

async function entrar(page: Page) {
  await page.addInitScript((auth) => {
    localStorage.setItem('sigma.auth', JSON.stringify({ accessToken: 'token-p31', user: auth, expiresAt: Date.now() + 86_400_000 }));
  }, USER);
  return mockApi(page);
}

async function abrirTarefas(page: Page) {
  await entrar(page);
  await page.goto('/execucao?aba=tarefas');
  await expect(page.getByRole('button', { name: /Laudo da praça/ })).toBeVisible({ timeout: 30_000 });
}

test('UX-03 Tab chega em cada tarefa e Enter abre a sheet certa', async ({ page, browserName }) => {
  const tag = motor(browserName);
  await page.setViewportSize({ width: 1280, height: 800 });
  await abrirTarefas(page);
  let foco = '';
  for (let i = 0; i < 40 && !foco.includes('CH-P31-0001'); i += 1) {
    await page.keyboard.press('Tab');
    foco = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
  }
  expect(foco).toContain('Tarefa Laudo da praça');
  expect(foco).toContain('CH-P31-0001');
  const outline = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    const estilo = el ? getComputedStyle(el) : null;
    return { largura: estilo?.outlineWidth ?? '0px', estilo: estilo?.outlineStyle ?? 'none' };
  });
  expect(parseFloat(outline.largura)).toBeGreaterThanOrEqual(2);
  expect(outline.estilo).not.toBe('none');
  const pasta = path.join(OUT, 'UX-03');
  mkdirSync(pasta, { recursive: true });
  await page.screenshot({ path: path.join(pasta, `${tag}-foco.png`), animations: 'disabled' });
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Laudo da praça');
  await expect(dialog).toContainText('CH-P31-0001');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator(`[data-tarefa-id="${ID_TAREFA_1}"]`)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator(`[data-tarefa-id="${ID_TAREFA_2}"]`)).toBeFocused();
  const anuncio = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');
  expect(anuncio).toContain('Segunda medição');
  expect(anuncio).toContain('CH-P31-0002');
  await page.keyboard.press(' ');
  await expect(page.getByRole('dialog')).toContainText('Segunda medição');
  gravar('UX-03', `assert-${tag}.json`, { foco, outline, anuncio });
});

test('UX-10 o pop-up do pin mostra tarefa, chamado e responsável', async ({ page, browserName }) => {
  const tag = motor(browserName);
  await page.setViewportSize({ width: 1280, height: 800 });
  await abrirTarefas(page);
  const mapa = page.locator('.sigma-map-shell').last();
  await expect(async () => {
    await mapa.scrollIntoViewIfNeeded({ timeout: 3_000 });
  }).toPass();
  await expect(page.locator('.leaflet-marker-pane .sigma-map-marker').first()).toBeVisible({ timeout: 20_000 });
  const textos: string[] = [];
  const tamanhos: Array<{ largura: number; altura: number }> = [];
  for (const id of [ID_TAREFA_1, ID_TAREFA_2]) {
    const pin = page.locator('.sigma-map-shell').last().locator('.leaflet-marker-icon').filter({ has: page.locator(`[data-pin="${id}"]`) });
    await pin.click({ force: true });
    const popup = page.locator('.leaflet-popup-content').last();
    await expect(popup).toBeVisible({ timeout: 5_000 });
    textos.push((await popup.innerText()).replace(/\s+/g, ' '));
    const box = await popup.locator('button').boundingBox();
    expect(box, textos.join(' | ')).not.toBeNull();
    tamanhos.push({ largura: box!.width, altura: box!.height });
    expect(box!.width).toBeGreaterThanOrEqual(24);
    expect(box!.height).toBeGreaterThanOrEqual(32);
    await page.keyboard.press('Escape');
  }
  expect(textos.every((texto) => texto.includes('Tarefa:') && texto.includes('Chamado:')), textos.join('\n')).toBe(true);
  expect(textos.some((texto) => texto.includes('Ana ZZ')), textos.join('\n')).toBe(true);
  expect(textos.some((texto) => texto.includes('Sem responsável')), textos.join('\n')).toBe(true);
  const pasta = path.join(OUT, 'UX-10');
  mkdirSync(pasta, { recursive: true });
  await page.screenshot({ path: path.join(pasta, `${tag}-popup.png`), animations: 'disabled' });
  gravar('UX-10', `assert-${tag}.json`, { textos, tamanhos });
});

for (const vp of [
  { w: 390, h: 844 },
  { w: 360, h: 640 },
] as const) {
  test(`UX-11 ${vp.w}px esconde colunas secundárias e não rola na horizontal`, async ({ page, browserName }) => {
    const tag = motor(browserName);
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await abrirTarefas(page);
    const medida = await page.evaluate(() => {
      const visivel = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? getComputedStyle(el).display : 'ausente';
      };
      const largura = document.documentElement.clientWidth;
      const direita = (sel: string) => {
        const el = document.querySelector(sel);
        return el ? el.getBoundingClientRect().right - largura : 0;
      };
      return {
        secundaria: visivel('[data-col="secundaria"]'),
        codigo: visivel('[data-col="codigo"]'),
        tarefa: visivel('[data-col="tarefa"]'),
        status: visivel('[data-col="status"]'),
        prazo: visivel('[data-col="prazo"]'),
        estouro: Math.max(direita('.tarefas-lista'), direita('.tarefas-workspace'), direita('main.sigma-main')),
      };
    });
    expect(medida.secundaria).toBe('none');
    expect(medida.codigo).not.toBe('none');
    expect(medida.tarefa).not.toBe('none');
    expect(medida.status).not.toBe('none');
    expect(medida.prazo).not.toBe('none');
    expect(medida.estouro).toBeLessThanOrEqual(1);
    const pasta = path.join(OUT, 'UX-11');
    mkdirSync(pasta, { recursive: true });
    await page.screenshot({ path: path.join(pasta, `${tag}-${vp.w}.png`), animations: 'disabled' });
    gravar('UX-11', `assert-${tag}-${vp.w}.json`, medida);
  });
}

test('UX-11 no desktop as colunas secundárias continuam visíveis', async ({ page, browserName }) => {
  const tag = motor(browserName);
  await page.setViewportSize({ width: 1280, height: 800 });
  await abrirTarefas(page);
  const display = await page.locator('[data-col="secundaria"]').first().evaluate((el) => getComputedStyle(el).display);
  expect(display).not.toBe('none');
  gravar('UX-11', `assert-${tag}-desktop.json`, { display });
});

test('UX-12 cinco filtros cabem no resumo e Limpar filtros recarrega o padrão', async ({ page, browserName }) => {
  test.setTimeout(60_000);
  const tag = motor(browserName);
  await page.setViewportSize({ width: 390, height: 844 });
  const sessao = await entrar(page);
  await page.goto('/execucao?aba=tarefas');
  await expect(page.getByRole('button', { name: /Laudo da praça/ })).toBeVisible({ timeout: 30_000 });
  const campo = (rotulo: string) => page.locator('label').filter({ hasText: rotulo }).locator('select, input');
  const botaoFiltros = page.getByRole('button', { name: /Filtros de tarefas/ });
  // O replace da URL pode remontar o painel e fechar os campos no meio da ação.
  const abrirFiltros = async () => {
    const status = campo('Status');
    if (!(await status.isVisible())) await botaoFiltros.click();
    await expect(status).toBeVisible();
  };
  const aplicar = async (rotulo: string, opcao: string | { label: string }, valor: string) => {
    await expect(async () => {
      await abrirFiltros();
      if (typeof opcao === 'string') await campo(rotulo).selectOption(opcao, { timeout: 3_000 });
      else await campo(rotulo).selectOption(opcao, { timeout: 3_000 });
      await expect(campo(rotulo)).toHaveValue(valor);
    }).toPass();
  };
  await aplicar('Status', 'NOVA', 'NOVA');
  await aplicar('Secretaria da tarefa', { label: 'ZZP31' }, 'sec-p31');
  await aplicar('Equipe', { label: 'Equipe ZZ P31' }, 'eq-p31');
  await aplicar('Prioridade', { label: 'Alta' }, 'ALTA');
  await expect(async () => {
    await abrirFiltros();
    await campo('Prazo de').fill('2026-10-01', { timeout: 3_000 });
    await expect(campo('Prazo de')).toHaveValue('2026-10-01');
  }).toPass();
  await expect(async () => {
    await abrirFiltros();
    await campo('Prazo até').fill('2026-10-05', { timeout: 3_000 });
    await expect(campo('Prazo até')).toHaveValue('2026-10-05');
  }).toPass();
  await expect(page.getByTestId('contagem-filtros-tarefas')).toHaveText('(5 filtros)');
  const resumo = page.locator('p[title]').filter({ hasText: 'Status: Nova' });
  await expect(async () => {
    if (!(await resumo.isVisible())) await botaoFiltros.click();
    await expect(resumo).toBeVisible();
  }).toPass();
  const texto = await resumo.getAttribute('title');
  expect(texto).toContain('Status: Nova');
  expect(texto).toContain('Secretaria: ZZP31');
  expect(texto).toContain('Equipe: Equipe ZZ P31');
  expect(texto).toContain('Prioridade: Alta');
  expect(texto).toContain('Prazo: 01/10 a 05/10');
  const linhas = await resumo.evaluate((el) => getComputedStyle(el).webkitLineClamp);
  expect(linhas).toBe('2');
  const pasta = path.join(OUT, 'UX-12');
  mkdirSync(pasta, { recursive: true });
  await page.screenshot({ path: path.join(pasta, `${tag}-390.png`), animations: 'disabled' });
  const antes = sessao.cargas().length;
  await expect(async () => {
    await abrirFiltros();
    await page.getByRole('button', { name: 'Limpar filtros' }).click({ timeout: 3_000 });
    await expect(campo('Status')).toHaveValue('');
  }).toPass();
  await expect(page.getByTestId('contagem-filtros-tarefas')).toHaveCount(0);
  const padrao = page.locator('p[title]').filter({ hasText: 'Status: não finalizados' });
  await expect(async () => {
    if (!(await padrao.isVisible())) await botaoFiltros.click();
    await expect(padrao).toBeVisible();
  }).toPass();
  await expect.poll(() => sessao.cargas().length).toBeGreaterThan(antes);
  gravar('UX-12', `assert-${tag}.json`, { texto, cargas: sessao.cargas().length });
});

test('UX-15 o resumo completo aparece no mouse e é o mesmo da grade', async ({ page, browserName }) => {
  const tag = motor(browserName);
  await page.setViewportSize({ width: 1280, height: 800 });
  await abrirTarefas(page);
  const card = page.locator(`[data-tarefa-id="${ID_TAREFA_1}"]`);
  const titulo = await card.locator('.tarefa-resumo [title]').getAttribute('title');
  expect(titulo).toBe(RESUMO);
  await expect(card.getByText('Resumo do chamado')).toBeVisible();
  await card.locator('.tarefa-resumo').hover();
  await expect(card.locator('.tarefa-resumo [role="tooltip"]')).toBeVisible();
  await expect(card.locator('.tarefa-resumo [role="tooltip"]')).toHaveText(RESUMO);
  const pasta = path.join(OUT, 'UX-15');
  mkdirSync(pasta, { recursive: true });
  await page.screenshot({ path: path.join(pasta, `${tag}-execucao.png`), animations: 'disabled' });
  gravar('UX-15', `assert-${tag}-execucao.json`, { titulo });
});

test('UX-15 a grade do Dashboard usa o mesmo resumo do chamado', async ({ page, browserName }) => {
  const tag = motor(browserName);
  await page.setViewportSize({ width: 1280, height: 800 });
  await entrar(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard operacional' })).toBeVisible({ timeout: 20_000 });
  const secao = page.getByRole('heading', { name: 'Tarefas de chamados' });
  await secao.scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Atualizar' }).click();
  const celula = page.locator('td[title]').filter({ hasText: 'ZZ resumo' });
  await expect(celula).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('columnheader', { name: 'Resumo do chamado' })).toBeVisible();
  expect(await celula.getAttribute('title')).toBe(RESUMO);
  await celula.hover();
  await expect(celula.getByRole('tooltip')).toHaveText(RESUMO);
  const pasta = path.join(OUT, 'UX-15');
  mkdirSync(pasta, { recursive: true });
  await page.screenshot({ path: path.join(pasta, `${tag}-dashboard.png`), animations: 'disabled' });
  gravar('UX-15', `assert-${tag}-dashboard.json`, { titulo: RESUMO });
});
