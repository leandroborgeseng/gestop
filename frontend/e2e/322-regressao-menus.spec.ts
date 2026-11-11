import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { PERFIS_REGRESSAO_322 } from '../lib/regressao-322-perfis';

/**
 * 322 L6 — menu lateral, barra inferior e matriz de Permissões
 * iguais ao retrato gravado em main 6f7c642.
 * Usuários sintéticos só no mock. Nada de banco real.
 */
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../evidencias/322');
mkdirSync(OUT, { recursive: true });

type Retrato = {
  colunasMatriz: string[];
  perfis: Record<
    string,
    {
      lateral: Array<{ titulo: string; itens: Array<{ id: string; label: string; href: string }> }>;
      inferior: {
        primaria: Array<{ id: string; label: string; href: string }>;
        secundaria: Array<{ id: string; label: string; href: string }>;
        mais: boolean;
      };
    }
  >;
  matriz: Array<{ id: string; label: string; funcoes: Array<{ id: string; label: string; acoes: string[] }> }>;
};

const BASELINE = JSON.parse(
  readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../lib/regressao-322-menus.baseline.json'), 'utf8'),
) as Retrato;

const SENHA = 'Zzteste322!Aa';
const SECRETARIA = { id: 'sec-322', nome: 'Secretaria Fictícia 322', sigla: 'ZZ322' };

const PERFIS_NA_TELA = ['cco-322', 'sem-cco-322', 'so-vistoria', 'admin-permissoes'] as const;

function usuarioDe(chave: string) {
  const perfil = PERFIS_REGRESSAO_322[chave];
  const email = `zzteste-${chave}@aion.local`;
  return {
    id: `user-${chave}`,
    nome: `ZZTESTE 322 ${chave}`,
    email,
    perfis: perfil.user?.perfis ?? [chave],
    permissoes: perfil.permissoes,
    secretaria: SECRETARIA,
    perfilAtivo: { id: `perfil-${chave}`, nome: perfil.user?.perfilAtivo?.nome ?? chave },
    perfisDisponiveis: [{ id: `perfil-${chave}`, nome: perfil.user?.perfilAtivo?.nome ?? chave }],
    secretariaAtiva: SECRETARIA,
    secretariasDisponiveis: [SECRETARIA],
  };
}

const USUARIOS = Object.fromEntries(PERFIS_NA_TELA.map((chave) => [usuarioDe(chave).email, usuarioDe(chave)]));

function catalogoDaMatriz() {
  return BASELINE.matriz.map((tela) => ({
    id: tela.id,
    label: tela.label,
    functions: tela.funcoes.map((funcao) => ({
      id: funcao.id,
      label: funcao.label,
      actions: funcao.acoes,
    })),
  }));
}

async function mockApi(page: Page) {
  const trocas: string[] = [];
  let sessao: (typeof USUARIOS)[string] | null = null;
  const perfil = {
    id: 'perfil-l6',
    nome: 'ZZTESTE 322 Matriz',
    descricao: '',
    sistema: false,
    ativo: true,
    natureza: 'INTERNO' as const,
    usuariosVinculados: 0,
  };

  await page.route('**/api-gestop/**', async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (url.includes('/auth/login') && method === 'POST') {
      const body = req.postDataJSON() as { email?: string };
      const user = USUARIOS[body.email ?? ''];
      if (!user) return json({}, 401);
      sessao = user;
      return json({ accessToken: `token-${user.id}`, tokenType: 'Bearer', expiresInSeconds: 8 * 3600, user });
    }
    if (url.includes('/auth/me')) {
      if (!sessao) return json({}, 401);
      return json(sessao);
    }
    if (url.includes('/auth/perfil-ativo') || url.includes('/auth/secretaria-ativa')) {
      trocas.push(new URL(url).pathname);
      return json({ message: 'L6 não troca perfil nem secretaria' }, 500);
    }
    if (url.includes('/admin/perfis/configuraveis')) return json([perfil]);
    if (/\/admin\/perfis\/[^/]+\/matriz/.test(new URL(url).pathname)) {
      return json({ perfil, catalogo: catalogoDaMatriz(), chaves: [] });
    }
    if (url.includes('/documentos/pendencias-abertura-diaria')) {
      return json({ abrir: false, pendencias: { total: 0, grupos: [] } });
    }
    if (url.includes('/mobile/field-package')) {
      return json({
        unidades: [],
        checklists: [],
        programacoes: [],
        contadores: { unidades: 0, checklists: 0, programacoes: 0 },
      });
    }
    if (url.includes('/operacional/opcoes-filtro')) {
      return json({ secretarias: [], bairros: [], tipos: [], responsaveis: [], emails: [] });
    }
    if (url.includes('/operacional/resumo')) {
      return json({
        totalUnidades: 0,
        unidadesAtivas: 0,
        totalSecretarias: 1,
        fiscalizacoesConcluidas: 0,
        naoConformidadesAbertas: 0,
        chamadosAbertos: 0,
        vistoriasAtrasadas: 0,
        totalPendencias: 0,
        eventosSyncPendentes: 0,
      });
    }
    if (method === 'GET') return json([]);
    return json({});
  });

  return { trocas: () => [...trocas] };
}

async function entrar(page: Page, email: string) {
  await page.goto('/login');
  const emailInput = page.getByPlaceholder('seu.email@franca.sp.gov.br');
  const senha = page.locator('input[type="password"]');
  await expect(emailInput).toBeVisible();
  await expect(async () => {
    await emailInput.fill(email);
    await senha.fill(SENHA);
    await expect(emailInput).toHaveValue(email);
  }).toPass();
  await page.getByRole('button', { name: /^entrar$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

function hrefsLaterais(chave: string) {
  return BASELINE.perfis[chave].lateral.flatMap((grupo) => grupo.itens.map((item) => item.href));
}

function labelsLaterais(chave: string) {
  return BASELINE.perfis[chave].lateral.flatMap((grupo) => grupo.itens.map((item) => item.label));
}

function labelsBarra(chave: string) {
  const inferior = BASELINE.perfis[chave].inferior;
  return [...inferior.primaria.map((item) => item.label), ...(inferior.mais ? ['Mais'] : [])];
}

test.use({ serviceWorkers: 'block' });

test.describe('322 L6 menu e matriz', () => {
  test('lateral, barra inferior e matriz batem com o retrato de main', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    const api = await mockApi(page);
    const engine = testInfo.project.name.includes('webkit') ? 'webkit' : 'chromium';
    const vistos: Record<string, { lateral: string[]; barra: string[] }> = {};

    for (const chave of PERFIS_NA_TELA) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await entrar(page, USUARIOS[usuarioDe(chave).email].email);
      await page.goto('/conta');
      await expect(page.getByRole('heading', { name: 'Minha conta' })).toBeVisible({ timeout: 20_000 });
      const nav = page.getByRole('navigation', { name: 'Navegação principal' });
      await expect(nav).toBeVisible();
      const hrefs = await nav.locator('a').evaluateAll((els) => els.map((el) => el.getAttribute('href')));
      const labels = (await nav.locator('a').allTextContents()).map((texto) => texto.replace(/\s+/g, ' ').trim());
      expect(hrefs, chave).toEqual(hrefsLaterais(chave));
      expect(labels, chave).toEqual(labelsLaterais(chave));

      await page.setViewportSize({ width: 390, height: 844 });
      const barra = page.getByRole('navigation', { name: 'Navegação mobile' });
      await expect(barra).toBeVisible();
      const textos = (await barra.locator('a, button').allTextContents()).map((texto) => texto.replace(/\s+/g, ' ').trim());
      expect(textos, chave).toEqual(labelsBarra(chave));
      vistos[chave] = { lateral: labels, barra: textos };

      await page.evaluate(() => window.localStorage.clear());
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page, usuarioDe('admin-permissoes').email);
    await page.goto('/admin?aba=permissoes');
    const tabela = page.locator('table');
    await expect(tabela).toBeVisible({ timeout: 20_000 });
    const cabecalhos = (await tabela.locator('thead th').allTextContents()).map((texto) => texto.trim()).filter(Boolean);
    expect(cabecalhos[0]).toBe('Tela / Função');
    expect(cabecalhos.slice(1)).toEqual(BASELINE.colunasMatriz);

    const botoes = tabela.getByRole('button');
    await expect(botoes).toHaveCount(BASELINE.matriz.length);
    const telas = (await botoes.allTextContents()).map((texto) => texto.replace(/\s+/g, ' ').trim());
    expect(telas).toEqual(BASELINE.matriz.map((tela) => tela.label));

    for (const tela of BASELINE.matriz) {
      await tabela.getByRole('button', { name: tela.label, exact: true }).click();
    }
    const funcoesVisiveis = (await tabela.locator('tbody tr td:first-child').allTextContents())
      .map((texto) => texto.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const esperadas = BASELINE.matriz.flatMap((tela) => [
      tela.label,
      ...tela.funcoes.filter((funcao) => funcao.id !== '_tela').map((funcao) => funcao.label),
    ]);
    expect(funcoesVisiveis).toEqual(esperadas);
    expect(api.trocas()).toEqual([]);

    await page.screenshot({ path: path.join(OUT, `${engine}-l6-matriz.png`), fullPage: true });
    writeFileSync(
      path.join(OUT, `assert-${engine}-l6.json`),
      JSON.stringify({ criterio: '322-L6', engine, origem: 'main 6f7c642', vistos, telas }, null, 2),
    );
  });
});
