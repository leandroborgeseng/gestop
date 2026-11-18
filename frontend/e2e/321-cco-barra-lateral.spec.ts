import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pastaEvidencias } from './evidencia-local';

/**
 * 321 — barra de detalhes do mapa do CCO.
 * Dados sintéticos via route mock (nada de produção).
 * Tela cheia: Chromium tenta a Fullscreen API. Se o headless recusar, o app cai no
 * fallback CSS (`.sigma-map-fullscreen`). No WebKit o requestFullscreen é recusado de
 * propósito: o Safari do iPhone não coloca `div` em fullscreen, e o SIGMA usa esse fallback.
 */
const OUT = pastaEvidencias('321');
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { w: 1440, h: 900 },
  { w: 1280, h: 800 },
  { w: 1024, h: 768 },
  { w: 768, h: 1024 },
  { w: 390, h: 844 },
  { w: 844, h: 390 },
  { w: 360, h: 640 },
  { w: 640, h: 360 },
  { w: 320, h: 568 },
] as const;

const NOME = 'EMEB ZZ Barra 321 — Próprio sintético com nome longo para ocupar duas linhas no cabeçalho';
const CHAMADO = 'ZZ Chamado Barra 321';

const USER = {
  id: 'u-321',
  nome: 'Tester ZZ',
  email: 'zz321@exemplo.local',
  perfis: ['Gestor CCO'],
  permissoes: ['dashboard.visualizar'],
  secretaria: { id: 'sec-1', nome: 'Educação', sigla: 'SME' },
  perfilAtivo: { id: 'p-1', nome: 'Gestor CCO' },
  perfisDisponiveis: [{ id: 'p-1', nome: 'Gestor CCO' }],
  secretariaAtiva: { id: 'sec-1', nome: 'Educação', sigla: 'SME' },
  secretariasDisponiveis: [{ id: 'sec-1', nome: 'Educação', sigla: 'SME' }],
};

function unidadeBase() {
  return {
    id: 'zz-321',
    codigoPatrimonial: 'ZZ-321',
    nome: NOME,
    tipo: 'ESCOLA',
    endereco: 'Rua Sintética, 321',
    bairro: 'Centro',
    cep: '14400-000',
    latitude: -20.5386,
    longitude: -47.4007,
    raioValidacaoMetros: 50,
    ativo: true,
    situacao: 'COM_PENDENCIAS',
    secretaria: { id: 'sec-1', nome: 'Educação', sigla: 'SME', responsavelNome: 'Ana ZZ' },
    pendencias: {
      naoConformidadesAbertas: 18,
      naoConformidadesSemChamadoAberto: 18,
      chamadosAbertos: 0,
      semVistoria: false,
      vistoriaAtrasada: null,
    },
    pendenciasUnicas: 18,
    totais: { fiscalizacoes: 0, naoConformidadesAbertas: 18, chamadosAbertos: 0 },
    slaMapa: 'DENTRO',
    ultimaVistoriaNota: null,
  };
}

function detalhe() {
  const ncs = Array.from({ length: 18 }, (_, i) => ({
    id: `nc-${i}`,
    descricao: `Descrição sintética ${i + 1} para a rolagem interna da barra de detalhes do mapa.`,
    severidade: 'MEDIA',
    status: 'ABERTA',
    situacaoVisual: 'ABERTA',
    pendenteAtiva: true,
    registradaEm: '2026-01-15T12:00:00.000Z',
    item: {
      id: `item-${i}`,
      codigo: `ITEM-${i}`,
      titulo: i === 17 ? 'ZZ-FIM-ROLAGEM' : `Item sintético ${i + 1}`,
    },
  }));
  return {
    ...unidadeBase(),
    ultimasFiscalizacoes: [],
    pendenciasDetalhadas: { naoConformidades: ncs, chamados: [] },
  };
}

function chamadoItem() {
  const linhas = Array.from({ length: 24 }, (_, i) => `Linha sintética ${i + 1} da descrição do chamado.`).join('\n');
  return {
    id: 'ch-321',
    codigo: 'CH-ZZ-321',
    titulo: CHAMADO,
    descricao: `${linhas}\nZZ-FIM-CHAMADO`,
    status: 'ABERTO',
    prioridade: 'MEDIA',
    origem: 'INTERNO',
    prazoEm: '2026-12-31T00:00:00.000Z',
    previstaExecucaoEm: null,
    enderecoTexto: 'Rua Sintética, 321',
    enderecoBairro: 'Centro',
    latitude: -20.5386,
    longitude: -47.4007,
    mapaLatitude: -20.5386,
    mapaLongitude: -47.4007,
    slaMapa: 'DENTRO',
    createdAt: '2026-02-01T12:00:00.000Z',
    secretaria: { id: 'sec-1', nome: 'Educação', sigla: 'SME' },
    unidade: {
      id: 'zz-321',
      nome: NOME,
      codigoPatrimonial: 'ZZ-321',
      endereco: 'Rua Sintética, 321',
      bairro: 'Centro',
      latitude: -20.5386,
      longitude: -47.4007,
    },
    equipe: { id: 'eq-1', nome: 'Equipe ZZ' },
    tipoChamado: { id: 'tc-1', nome: CHAMADO },
    responsavel: { id: 'u-1', nome: 'Ana ZZ' },
  };
}

async function mockApi(page: Page) {
  await page.route(/basemaps\.cartocdn\.com|arcgisonline\.com|openstreetmap\.org/, (route) => route.abort());
  await page.route('**/api-gestop/**', async (route) => {
    const pathName = new URL(route.request().url()).pathname.replace(/^\/api-gestop/, '');
    const send = (body: unknown) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (pathName === '/auth/me') return send(USER);
    if (pathName === '/operacional/resumo') {
      return send({
        totalUnidades: 1,
        unidadesAtivas: 1,
        totalSecretarias: 1,
        fiscalizacoesConcluidas: 0,
        naoConformidadesAbertas: 18,
        chamadosAbertos: 1,
        vistoriasAtrasadas: 0,
        totalPendencias: 18,
        eventosSyncPendentes: 0,
      });
    }
    if (pathName === '/operacional/opcoes-filtro') {
      return send({
        secretarias: [{ id: 'sec-1', nome: 'Educação', sigla: 'SME' }],
        bairros: ['Centro'],
        tipos: ['ESCOLA'],
        responsaveis: [],
        emails: [],
        equipes: [],
        tiposChamado: [{ id: 'tc-1', nome: CHAMADO }],
      });
    }
    if (pathName === '/operacional/unidades') return send([unidadeBase()]);
    if (pathName === '/operacional/unidades/zz-321') return send(detalhe());
    if (pathName === '/operacional/chamados-mapa') {
      return send({ items: [chamadoItem()], total: 1, truncado: false });
    }
    if (pathName === '/monitoramento/alertas') {
      return send({
        resumo: { chamadosAtrasados: 0, chamadosSemTriagem: 0, syncFalhas: 0, chamadosUrgentes: 0 },
        chamadosAtrasados: [],
        chamadosSemTriagem: [],
      });
    }
    if (pathName === '/documentos/pendencias-resumo') return send({ total: 0, grupos: [] });
    if (pathName === '/mapa/camadas') {
      return send([
        {
          id: 'g-zz',
          titulo: 'ZZ Grupo',
          camadas: [
            {
              id: 'webmap:zz',
              camadaId: 'zz',
              nomeOriginal: 'ZZ Camada 321',
              geometriaTipo: 'Point',
              estilo: null,
              totalElementos: 1,
              versaoAtual: 'v1',
              ligadaPorPadrao: false,
              pesada: false,
            },
          ],
        },
      ]);
    }
    if (pathName.includes('disponiveis')) return send([]);
    return send([]);
  });
}

async function preparar(page: Page, browserName: string) {
  if (browserName === 'webkit') {
    await page.addInitScript(() => {
      const rejeita = () => Promise.reject(new DOMException('Safari no iPhone não coloca div em fullscreen', 'TypeError'));
      Element.prototype.requestFullscreen = rejeita;
    });
  }
  await page.addInitScript((auth) => {
    localStorage.setItem(
      'sigma.auth',
      JSON.stringify({ accessToken: 'token-sintetico-321', user: auth, expiresAt: Date.now() + 86_400_000 }),
    );
  }, USER);
  await mockApi(page);
}

async function vista(page: Page) {
  return page.locator('.sigma-map-shell').evaluate((el) => {
    const container = el.querySelector('.leaflet-container') as (HTMLElement & { _leaflet_id?: number }) | null;
    return {
      lat: el.getAttribute('data-map-lat'),
      lng: el.getAttribute('data-map-lng'),
      zoom: el.getAttribute('data-map-zoom'),
      id: container?._leaflet_id ?? null,
    };
  });
}

async function assertFallbackCobreViewport(page: Page, modo: string) {
  if (modo !== 'fallback-css') return;
  const cobre = await page.evaluate(() => {
    const shell = document.querySelector('.sigma-map-shell')!.getBoundingClientRect();
    const geometria = shell.top <= 1 && shell.left <= 1 && shell.right >= window.innerWidth - 1 && shell.bottom >= window.innerHeight - 1;
    const hit = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 8);
    return geometria && Boolean(hit?.closest('.sigma-map-shell'));
  });
  expect(cobre, 'fallback CSS cobre a viewport (100dvh), inclusive a barra inferior').toBe(true);
}

async function modoTelaCheia(page: Page) {
  return page.evaluate(() => {
    const shell = document.querySelector('.sigma-map-shell');
    if (document.fullscreenElement) return 'native';
    if (shell?.classList.contains('sigma-map-fullscreen')) return 'fallback-css';
    return shell?.getAttribute('data-fullscreen-mode') ?? 'off';
  });
}

async function abrirProprio(page: Page) {
  await page.locator('.cco-list-panel').getByRole('button', { name: /EMEB ZZ Barra 321/ }).click();
  await expect(page.getByTestId('cco-detalhe-barra')).toBeVisible();
  await expect(page.getByTestId('cco-detalhe-titulo')).toBeFocused();
}

/** Em tela cheia a lista fica fora do shell. O clique vai direto no pin, mesmo com o balão por cima. Se o pin já estava selecionado, o primeiro clique limpa e o segundo abre. */
async function clicarPin(page: Page) {
  await page.evaluate(() => {
    const marker = document.querySelector('.leaflet-marker-pane .sigma-map-marker');
    marker?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  });
}

async function abrirPeloMarcador(page: Page) {
  const barra = page.getByTestId('cco-detalhe-barra');
  await expect(page.locator('.leaflet-marker-pane .sigma-map-marker').first()).toBeVisible();
  await clicarPin(page);
  const abriu = await barra.waitFor({ state: 'visible', timeout: 2000 }).then(() => true).catch(() => false);
  if (!abriu) await clicarPin(page);
  await expect(barra).toBeVisible();
  await expect(page.getByTestId('cco-detalhe-titulo')).toBeFocused();
}

async function pilhaDoFechar(page: Page) {
  const info = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="cco-detalhe-fechar"]') as HTMLElement | null;
    const titulo = document.querySelector('[data-testid="cco-detalhe-titulo"]') as HTMLElement | null;
    const barra = document.querySelector('[data-testid="cco-detalhe-barra"]') as HTMLElement | null;
    const shell = document.querySelector('.sigma-map-shell');
    if (!btn || !titulo || !barra || !shell) return { ok: false, motivo: 'ausente' };
    const r = btn.getBoundingClientRect();
    const t = titulo.getBoundingClientRect();
    const dentro = (box: DOMRect) =>
      box.width >= 44 &&
      box.height >= 44 &&
      box.top >= -0.5 &&
      box.left >= -0.5 &&
      box.right <= window.innerWidth + 0.5 &&
      box.bottom <= window.innerHeight + 0.5;
    const hit = (x: number, y: number) => document.elementFromPoint(x, y);
    const noMeio = hit(r.left + r.width / 2, r.top + r.height / 2);
    const noTitulo = hit(Math.min(t.right - 4, t.left + 8), t.top + t.height / 2);
    const header = document.querySelector('.cco-detalhe-header') as HTMLElement | null;
    return {
      ok: true,
      fecharDentro: dentro(r),
      fecharLargura: r.width,
      fecharAltura: r.height,
      tituloDentro: t.top >= -0.5 && t.left >= -0.5 && t.bottom <= window.innerHeight + 0.5 && t.right <= window.innerWidth + 0.5 && t.width > 0,
      hitFechar: Boolean(noMeio && (noMeio === btn || btn.contains(noMeio))),
      hitTitulo: Boolean(noTitulo && (noTitulo === titulo || titulo.contains(noTitulo) || header?.contains(noTitulo))),
      filhaDoShell: shell.contains(barra) && barra.parentElement === shell,
      headerAltura: header?.getBoundingClientRect().height ?? 0,
      barra: barra.getBoundingClientRect().toJSON(),
      shell: shell.getBoundingClientRect().toJSON(),
    };
  });
  expect(info.ok, JSON.stringify(info)).toBe(true);
  expect(info.fecharDentro).toBe(true);
  expect(info.fecharLargura).toBeGreaterThanOrEqual(44);
  expect(info.fecharAltura).toBeGreaterThanOrEqual(44);
  expect(info.tituloDentro).toBe(true);
  expect(info.hitFechar).toBe(true);
  expect(info.hitTitulo).toBe(true);
  expect(info.filhaDoShell).toBe(true);
  return info;
}

async function scrollPagina(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('main.sigma-main > .overflow-y-auto') as HTMLElement | null;
    return { janela: window.scrollY, pagina: el?.scrollTop ?? 0 };
  });
}

/** Fora da tela cheia. Até 1279 a lista empilha (barra fixed). A partir de 1280, lado a lado (sticky). */
async function assertJanela(page: Page, w: number) {
  await expect.poll(async () => {
    return page.evaluate(({ empilhada, comNav }) => {
      const btn = document.querySelector('[data-testid="cco-detalhe-fechar"]') as HTMLElement | null;
      const barra = document.querySelector('[data-testid="cco-detalhe-barra"]') as HTMLElement | null;
      if (!btn || !barra) return 'ausente';
      const r = btn.getBoundingClientRect();
      const box = barra.getBoundingClientRect();
      const dentro = (b: DOMRect) =>
        b.width > 0 && b.height > 0 && b.top >= -1 && b.left >= -1 && b.right <= window.innerWidth + 1 && b.bottom <= window.innerHeight + 1;
      if (!dentro(r) || r.width < 44 || r.height < 44) return `fechar ${Math.round(r.top)}..${Math.round(r.bottom)}`;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit || (hit !== btn && !btn.contains(hit))) return 'hit';
      if (!empilhada) {
        if (!dentro(box)) return `barra ${Math.round(box.top)}..${Math.round(box.bottom)}`;
        return 'ok';
      }
      if (box.top > 1) return `topo ${Math.round(box.top)}`;
      if (box.bottom < window.innerHeight - 8) return `rodape ${Math.round(box.bottom)}`;
      const rodape = document.querySelector('.cco-detalhe-rodape');
      if (rodape) {
        const rr = rodape.getBoundingClientRect();
        if (rr.height > 0 && (rr.top < -1 || rr.bottom > window.innerHeight + 1)) return `rodape ${Math.round(rr.top)}..${Math.round(rr.bottom)}`;
      }
      if (!document.body.classList.contains('cco-detalhe-trava')) return 'sem trava';
      const pagina = document.querySelector('main.sigma-main > .overflow-y-auto') as HTMLElement | null;
      if (!pagina || getComputedStyle(pagina).overflowY !== 'hidden') return 'pagina rola';
      if (comNav) {
        const nav = document.querySelector('nav[aria-label="Navegação mobile"]');
        if (!nav) return 'sem nav';
        const navTop = nav.getBoundingClientRect().top;
        if (r.bottom > navTop - 8) return `nav ${Math.round(navTop)} x ${Math.round(r.bottom)}`;
      }
      return 'ok';
    }, { empilhada: w < 1280, comNav: w < 1024 });
  }, { timeout: 4_000 }).toBe('ok');
}

async function assertRodapeNoViewport(page: Page) {
  await expect.poll(async () => {
    return page.evaluate(() => {
      const btn = document.querySelector('[data-testid="cco-detalhe-fechar"]') as HTMLElement | null;
      const link = [...document.querySelectorAll('a')].find((a) => (a.textContent ?? '').includes('Abrir em Chamados')) as HTMLElement | undefined;
      if (!btn || !link) return false;
      const dentro = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top >= -1 && r.left >= -1 && r.bottom <= window.innerHeight + 1 && r.right <= window.innerWidth + 1;
      };
      const r = btn.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return dentro(btn) && dentro(link) && Boolean(hit && (hit === btn || btn.contains(hit)));
    });
  }, { timeout: 4_000 }).toBe(true);
}

function esperaLargura(w: number, h: number, shellW: number) {
  if (h < 500) return Math.min(shellW, 480);
  if (w >= 1024) return Math.min(440, shellW);
  if (w >= 600) return Math.min(420, shellW * 0.75);
  return shellW;
}

async function rolarFim(page: Page, marcador: string) {
  await page.getByTestId('cco-detalhe-fechar').scrollIntoViewIfNeeded();
  await page.getByRole('tab', { name: /Não conf/ }).click();
  const fim = page.getByText(marcador);
  await expect(fim).toBeAttached();
  const antes = await page.evaluate(() => window.scrollY);
  const vistaAntes = await vista(page);
  await page.getByTestId('cco-detalhe-corpo').evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  const alcance = await page.evaluate((texto) => {
    const corpo = document.querySelector('[data-testid="cco-detalhe-corpo"]') as HTMLElement;
    const caixa = () => {
      const walker = document.createTreeWalker(corpo, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const valor = node.textContent ?? '';
        const i = valor.indexOf(texto);
        if (i < 0) continue;
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + texto.length);
        return range.getBoundingClientRect();
      }
      return null;
    };
    let a = caixa();
    if (!a) return { ok: false };
    const antesCaixa = corpo.getBoundingClientRect();
    if (a.top < antesCaixa.top) corpo.scrollTop -= antesCaixa.top - a.top;
    else if (a.bottom > antesCaixa.bottom) corpo.scrollTop += a.bottom - antesCaixa.bottom;
    a = caixa();
    const c = corpo.getBoundingClientRect();
    const header = document.querySelector('.cco-detalhe-header')!.getBoundingClientRect();
    const abas = document.querySelector('[data-testid="cco-detalhe-abas"]');
    const ab = abas?.getBoundingClientRect();
    return {
      ok: Boolean(a) && a!.top >= c.top - 2 && a!.bottom <= c.bottom + 2 && header.top >= -1 && header.bottom <= window.innerHeight + 1,
      abasVisiveis: !ab || (ab.top >= header.top - 1 && ab.height > 0),
      aTop: a?.top,
      aBottom: a?.bottom,
      cTop: c.top,
      cBottom: c.bottom,
      headerTop: header.top,
    };
  }, marcador);
  await expect(fim).toBeVisible();
  expect(alcance.ok, JSON.stringify(alcance)).toBe(true);
  expect(alcance.abasVisiveis).toBe(true);
  expect(await page.evaluate(() => window.scrollY)).toBe(antes);
  expect(await vista(page)).toEqual(vistaAntes);
}

async function cliqueCoberto(page: Page) {
  await expect.poll(async () => page.locator('[data-coberto-pela-barra]').count()).toBeGreaterThan(0);
  const ponto = await page.evaluate(() => {
    const barra = document.querySelector('[data-testid="cco-detalhe-barra"]') as HTMLElement;
    const br = barra.getBoundingClientRect();
    const candidatos = [
      ...document.querySelectorAll<HTMLElement>('.sigma-map-controls button, .leaflet-control-zoom a, .leaflet-control-zoom-in'),
    ];
    const interativo = 'a, button, input, select, textarea, [role="tab"]';
    for (const el of candidatos) {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      for (let y = r.top + 1; y < r.bottom; y += 6) {
        for (let x = r.left + 1; x < r.right; x += 6) {
          if (x < br.left || x > br.right || y < br.top || y > br.bottom) continue;
          const hit = document.elementFromPoint(x, y);
          if (!hit || !barra.contains(hit) || hit.closest(interativo)) continue;
          return {
            x,
            y,
            expandido: el.getAttribute('aria-expanded'),
            pressionado: el.getAttribute('aria-pressed'),
            inerte: el.closest('[inert]') != null || el.hasAttribute('inert'),
          };
        }
      }
    }
    return null;
  });
  expect(ponto, 'nenhum controle coberto pela barra').not.toBeNull();
  expect(ponto!.inerte).toBe(true);
  await page.mouse.click(ponto!.x, ponto!.y);
  await expect(page.getByTestId('cco-detalhe-barra')).toBeVisible();
  await expect(page.getByTestId('cco-map-painel')).toHaveCount(0);
  const satelite = page.locator('.sigma-map-controls').getByRole('button', { name: 'Satélite' });
  await expect(satelite).toHaveAttribute('aria-pressed', 'false');
}

test.describe('321 barra lateral do mapa', () => {
  test.describe.configure({ timeout: 180_000 });
  test.use({ serviceWorkers: 'block' });

  test.beforeEach(async ({ page, browserName }) => {
    await preparar(page, browserName);
  });

  for (const vp of VIEWPORTS) {
    test(`${vp.w}x${vp.h}`, async ({ page, browserName }) => {
      const tag = `${browserName}-${vp.w}x${vp.h}`;
      let listaHits = 0;
      page.on('request', (req) => {
        const nome = new URL(req.url()).pathname;
        if (/\/operacional\/unidades\/?$/.test(nome)) listaHits += 1;
      });
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto('/cco');
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('.cco-list-panel').getByRole('button', { name: /EMEB ZZ Barra 321/ })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator('.sigma-map-shell[data-map-zoom]')).toBeAttached({ timeout: 20_000 });

      const botaoLista = page.locator('.cco-list-panel').getByRole('button', { name: /EMEB ZZ Barra 321/ });
      if (vp.w >= 1280) await page.locator('.sigma-map-shell').scrollIntoViewIfNeeded();
      else if (vp.w < 1024) await botaoLista.scrollIntoViewIfNeeded();
      const scrollAntes = await scrollPagina(page);
      if (vp.w >= 1024) {
        await botaoLista.evaluate((el) => {
          if (!(el instanceof HTMLElement)) return;
          el.focus({ preventScroll: true });
          el.click();
        });
        await expect(page.getByTestId('cco-detalhe-barra')).toBeVisible();
        await expect(page.getByTestId('cco-detalhe-titulo')).toBeFocused();
      } else {
        await abrirProprio(page);
      }
      await assertJanela(page, vp.w);
      expect(await scrollPagina(page)).toEqual(scrollAntes);
      if (vp.w < 1280) {
        const fora = await page.evaluate(() => {
          const barra = document.querySelector('[data-testid="cco-detalhe-barra"]')!.getBoundingClientRect();
          return { x: Math.max(8, barra.left - 12), y: 180 };
        });
        await page.mouse.move(fora.x, fora.y);
        await page.mouse.wheel(0, 700);
        expect(await scrollPagina(page)).toEqual(scrollAntes);
      }
      await page.screenshot({ path: path.join(OUT, `${tag}-topo-janela.png`), animations: 'disabled' });
      await rolarFim(page, 'ZZ-FIM-ROLAGEM');
      await page.screenshot({ path: path.join(OUT, `${tag}-fim-janela.png`), animations: 'disabled' });
      await page.getByTestId('cco-detalhe-fechar').click();
      await expect(page.getByTestId('cco-detalhe-barra')).toHaveCount(0);
      await expect(page.locator('.cco-list-panel').getByRole('button', { name: /EMEB ZZ Barra 321/ })).toBeFocused();
      if (vp.w < 1280) {
        await expect.poll(() => page.evaluate(() => document.body.classList.contains('cco-detalhe-trava'))).toBe(false);
      }

      await abrirProprio(page);
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('cco-detalhe-barra')).toHaveCount(0);
      await expect(page.locator('.cco-list-panel').getByRole('button', { name: /EMEB ZZ Barra 321/ })).toBeFocused();

      await page.getByRole('button', { name: 'Maximizar mapa' }).click();
      await expect.poll(() => modoTelaCheia(page), { timeout: 8_000 }).not.toBe('off');
      const modo = await modoTelaCheia(page);
      await assertFallbackCobreViewport(page, modo);
      writeFileSync(
        path.join(OUT, `modo-${tag}.json`),
        JSON.stringify(
          {
            engine: browserName,
            viewport: `${vp.w}x${vp.h}`,
            fullscreen: modo,
            nota:
              modo === 'native'
                ? 'Fullscreen API aceita neste navegador.'
                : 'Fallback CSS .sigma-map-fullscreen (position:fixed; height:100dvh). No iPhone o Safari não entra em fullscreen com div; o WebKit deste teste recusa requestFullscreen para seguir esse caminho.',
          },
          null,
          2,
        ),
      );
      await page.waitForTimeout(900);
      const zoomAntes = (await vista(page)).zoom;
      const zoomClicado = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('.leaflet-control-zoom-in');
        if (!el || el.classList.contains('leaflet-disabled')) return false;
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return true;
      });
      if (zoomClicado) {
        await expect.poll(async () => (await vista(page)).zoom, { timeout: 4_000 }).not.toBe(zoomAntes);
      }
      const vistaAntes = await vista(page);
      const hitsAntes = listaHits;

      await abrirPeloMarcador(page);
      const info = await pilhaDoFechar(page);
      const shellW = info.shell.width as number;
      const barraW = info.barra.width as number;
      expect(Math.abs(barraW - esperaLargura(vp.w, vp.h, shellW))).toBeLessThanOrEqual(3);
      expect(Math.abs((info.barra.x as number) + barraW - ((info.shell.x as number) + shellW))).toBeLessThanOrEqual(3);
      expect(Math.abs((info.barra.height as number) - (info.shell.height as number))).toBeLessThanOrEqual(3);
      if (vp.h < 500) expect(info.headerAltura).toBeLessThanOrEqual(48);
      expect(await vista(page)).toEqual(vistaAntes);
      await page.screenshot({ path: path.join(OUT, `${tag}-topo.png`), animations: 'disabled' });

      for (const nome of [/Visão geral/, /Vistorias/, /Não conf/, /Chamados/]) {
        await page.getByRole('tab', { name: nome }).click();
        expect(await modoTelaCheia(page)).toBe(modo);
      }
      await rolarFim(page, 'ZZ-FIM-ROLAGEM');
      expect(await modoTelaCheia(page)).toBe(modo);
      await page.screenshot({ path: path.join(OUT, `${tag}-fim.png`), animations: 'disabled' });
      const headerAinda = await page.evaluate(() => {
        const header = document.querySelector('.cco-detalhe-header')!.getBoundingClientRect();
        const btn = document.querySelector('[data-testid="cco-detalhe-fechar"]') as HTMLElement;
        const r = btn.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return header.top >= -1 && header.bottom <= window.innerHeight && Boolean(hit && (hit === btn || btn.contains(hit)));
      });
      expect(headerAinda).toBe(true);

      await page.getByTestId('cco-detalhe-fechar').click();
      await expect(page.getByTestId('cco-detalhe-barra')).toHaveCount(0);
      expect(await modoTelaCheia(page)).toBe(modo);
      expect(await vista(page)).toEqual(vistaAntes);
      expect(listaHits).toBe(hitsAntes);

      await abrirPeloMarcador(page);
      await cliqueCoberto(page);
      await page.getByTestId('cco-detalhe-fechar').click();
      await page.locator('.sigma-map-controls').getByRole('button', { name: 'Satélite' }).click();
      await expect(page.locator('.sigma-map-controls').getByRole('button', { name: 'Satélite' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await page.locator('.sigma-map-controls').getByRole('button', { name: 'Mapa', exact: true }).click();

      if (modo === 'fallback-css') {
        await abrirPeloMarcador(page);
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('cco-detalhe-barra')).toHaveCount(0);
        expect(await modoTelaCheia(page)).toBe('fallback-css');
      }

      const painel = page.getByTestId('cco-map-painel');
      await page.locator('.sigma-map-controls').getByRole('button', { name: 'Filtros' }).click();
      await expect(painel).toBeVisible();
      await painel.getByRole('button', { name: 'Pendências', exact: true }).click();
      await painel.getByRole('button', { name: 'Aplicar filtros' }).click();
      await expect(painel.getByTestId('cco-painel-status')).not.toContainText('Alterações não aplicadas');
      await expect(painel).toBeVisible();
      await page.screenshot({ path: path.join(OUT, `${tag}-topo-filtros.png`), animations: 'disabled' });
      await abrirPeloMarcador(page);
      await expect(painel).toHaveCount(0);
      await expect(page.locator('.sigma-map-shell')).toContainText('1 no mapa');
      await page.getByTestId('cco-detalhe-fechar').click();
      await expect(page.getByTestId('cco-filtros-resumo')).toContainText('Pendências');

      await page.locator('.sigma-map-controls').getByRole('button', { name: 'Camadas' }).click();
      await expect(painel).toBeVisible();
      await painel.getByRole('button', { name: /Webmap QGIS/ }).click();
      await painel.getByRole('button', { name: /ZZ Grupo/ }).click();
      const camada = painel.getByRole('checkbox', { name: /ZZ Camada 321/ });
      await camada.check();
      await expect(camada).toBeChecked();
      await expect(painel).toBeVisible();
      await page.screenshot({ path: path.join(OUT, `${tag}-topo-camadas.png`), animations: 'disabled' });
      await abrirPeloMarcador(page);
      await expect(painel).toHaveCount(0);
      await page.getByTestId('cco-detalhe-fechar').click();
      await page.locator('.sigma-map-controls').getByRole('button', { name: 'Camadas' }).click();
      await expect(painel.getByRole('checkbox', { name: /ZZ Camada 321/ })).toBeChecked();
      await painel.getByRole('button', { name: 'Fechar painel' }).click();
      expect(await modoTelaCheia(page)).toBe(modo);
      expect(await vista(page)).toEqual(vistaAntes);
    });
  }

  for (const vp of [
    { w: 1440, h: 900 },
    { w: 1280, h: 800 },
    { w: 360, h: 640 },
    { w: 640, h: 360 },
  ] as const) {
    test(`chamado ${vp.w}x${vp.h}`, async ({ page, browserName }) => {
      const tag = `${browserName}-${vp.w}x${vp.h}`;
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto('/cco');
      await page.getByRole('button', { name: 'Todos os chamados' }).click();
      await expect(page.locator('.cco-list-panel').getByRole('button', { name: /ZZ Chamado Barra 321/ })).toBeVisible({
        timeout: 30_000,
      });
      const botao = page.locator('.cco-list-panel').getByRole('button', { name: /ZZ Chamado Barra 321/ });
      await botao.scrollIntoViewIfNeeded();
      const scrollAntes = await scrollPagina(page);
      await botao.evaluate((el) => {
        if (!(el instanceof HTMLElement)) return;
        el.focus({ preventScroll: true });
        el.click();
      });
      await expect(page.getByTestId('cco-detalhe-barra')).toBeVisible();
      await assertJanela(page, vp.w);
      expect(await scrollPagina(page)).toEqual(scrollAntes);
      if (vp.w >= 1024) await assertRodapeNoViewport(page);
      await page.getByTestId('cco-detalhe-fechar').click();
      await expect(page.getByTestId('cco-detalhe-barra')).toHaveCount(0);

      await page.getByRole('button', { name: 'Maximizar mapa' }).click();
      await expect.poll(() => modoTelaCheia(page), { timeout: 8_000 }).not.toBe('off');
      const modo = await modoTelaCheia(page);
      await assertFallbackCobreViewport(page, modo);
      await page.waitForTimeout(900);
      await abrirPeloMarcador(page);
      await pilhaDoFechar(page);
      expect(await modoTelaCheia(page)).toBe(modo);
      await page.screenshot({ path: path.join(OUT, `${tag}-topo-chamado.png`), animations: 'disabled' });
      const antes = await vista(page);
      await page.getByTestId('cco-detalhe-corpo').evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await expect(page.getByText('ZZ-FIM-CHAMADO')).toBeVisible();
      await page.screenshot({ path: path.join(OUT, `${tag}-fim-chamado.png`), animations: 'disabled' });
      await cliqueCoberto(page);
      await page.getByTestId('cco-detalhe-fechar').click();
      await expect(page.getByTestId('cco-detalhe-barra')).toHaveCount(0);
      expect(await modoTelaCheia(page)).toBe(modo);
      expect(await vista(page)).toEqual(antes);
    });
  }

  for (const vp of [
    { w: 1024, h: 768 },
    { w: 390, h: 844 },
    { w: 768, h: 1024 },
    { w: 320, h: 568 },
  ] as const) {
    test(`chamado janela ${vp.w}x${vp.h}`, async ({ page, browserName }) => {
      const tag = `${browserName}-${vp.w}x${vp.h}`;
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto('/cco');
      await page.getByRole('button', { name: 'Todos os chamados' }).click();
      const botao = page.locator('.cco-list-panel').getByRole('button', { name: /ZZ Chamado Barra 321/ });
      await expect(botao).toBeVisible({ timeout: 30_000 });
      const scrollAntes = await scrollPagina(page);
      await botao.evaluate((el) => {
        if (!(el instanceof HTMLElement)) return;
        el.focus({ preventScroll: true });
        el.click();
      });
      await expect(page.getByTestId('cco-detalhe-barra')).toBeVisible();
      await assertJanela(page, vp.w);
      expect(await scrollPagina(page)).toEqual(scrollAntes);
      await assertRodapeNoViewport(page);
      if (vp.w !== 1024) {
        await page.screenshot({ path: path.join(OUT, `${tag}-topo-janela-chamado.png`), animations: 'disabled' });
      }
      await page.getByTestId('cco-detalhe-fechar').click();
      await expect(page.getByTestId('cco-detalhe-barra')).toHaveCount(0);
    });
  }
});
