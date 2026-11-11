import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * 322 — tela inicial por permissão.
 * Usuários sintéticos só no mock de /api-gestop (nada de banco real nem de produção).
 * A senha do formulário é fixture local; o mock não a confere.
 * Tamanhos do critério (criterios.md): 1440×900, 768×1024, 360×640 e 640×360.
 * A6 no aparelho (PWA em segundo plano) fica para o Leandro; aqui só o que o navegador dispara.
 */
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../evidencias/322');
mkdirSync(OUT, { recursive: true });

const SENHA = 'Zzteste322!Aa';
const CCO_EMAIL = 'zzteste-cco@aion.local';
const SEM_CCO_EMAIL = 'zzteste-semcco@aion.local';
const MATRIZ_EMAIL = 'zzteste-cco-matriz@aion.local';
const PERFIL_CCO = 'ZZTESTE 322 CCO';
const PERFIL_SEM = 'ZZTESTE 322 Sem CCO';
const SIGLA = 'ZZ322';

const TAMANHOS = [
  { w: 1440, h: 900 },
  { w: 768, h: 1024 },
  { w: 360, h: 640 },
  { w: 640, h: 360 },
] as const;

const SECRETARIA = { id: 'sec-322', nome: 'Secretaria Fictícia 322', sigla: SIGLA };

type Usuario = {
  id: string;
  nome: string;
  email: string;
  perfis: string[];
  permissoes: string[];
  secretaria: typeof SECRETARIA;
  perfilAtivo: { id: string; nome: string };
  perfisDisponiveis: Array<{ id: string; nome: string }>;
  secretariaAtiva: typeof SECRETARIA;
  secretariasDisponiveis: Array<typeof SECRETARIA>;
};

function usuario(email: string, nome: string, perfilNome: string, permissoes: string[]): Usuario {
  const perfil = { id: `perfil-${email}`, nome: perfilNome };
  return {
    id: `user-${email}`,
    nome,
    email,
    perfis: [perfilNome],
    permissoes,
    secretaria: SECRETARIA,
    perfilAtivo: perfil,
    perfisDisponiveis: [perfil],
    secretariaAtiva: SECRETARIA,
    secretariasDisponiveis: [SECRETARIA],
  };
}

const USUARIOS: Record<string, Usuario> = {
  [CCO_EMAIL]: usuario(CCO_EMAIL, 'ZZTESTE 322 CCO', PERFIL_CCO, [
    'matriz.cco._tela.visualizar',
    'dashboard.visualizar',
    'matriz.vistoria_campo._tela.visualizar',
    'fiscalizacoes.executar',
    'matriz.chamados._tela.visualizar',
    'chamados.gerenciar',
    'matriz.documentos._tela.visualizar',
    'documentos.visualizar',
    'matriz.execucao._tela.visualizar',
    'chamados.executar',
  ]),
  [SEM_CCO_EMAIL]: usuario(SEM_CCO_EMAIL, 'ZZTESTE 322 Sem CCO', PERFIL_SEM, [
    'matriz.chamados._tela.visualizar',
    'chamados.gerenciar',
  ]),
  [MATRIZ_EMAIL]: usuario(MATRIZ_EMAIL, 'ZZTESTE 322 Matriz CCO', PERFIL_CCO, [
    'matriz.cco._tela.visualizar',
  ]),
};

function engineDe(projectName: string) {
  return projectName.includes('webkit') ? 'webkit' : 'chromium';
}

async function mockApi(page: Page, usuarioInicial?: Usuario) {
  const trocas: string[] = [];
  let sessao: Usuario | null = usuarioInicial ?? null;

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
      return json({
        accessToken: `token-${user.id}`,
        tokenType: 'Bearer',
        expiresInSeconds: 30 * 24 * 3600,
        user,
      });
    }

    if (url.includes('/auth/me')) {
      if (!sessao) return json({}, 401);
      return json(sessao);
    }

    if (url.includes('/auth/perfil-ativo') || url.includes('/auth/secretaria-ativa')) {
      trocas.push(new URL(url).pathname);
      return json({ message: '322 não troca perfil nem secretaria para abrir a tela inicial' }, 500);
    }

    if (url.includes('/documentos/pendencias-abertura-diaria')) {
      return json({ abrir: false, pendencias: { total: 0, grupos: [] } });
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

    if (url.includes('/operacional/opcoes-filtro')) {
      return json({ secretarias: [], bairros: [], tipos: [], responsaveis: [], emails: [] });
    }

    const path = new URL(url).pathname;
    if (method === 'GET' && path.includes('/chamados/programacao')) {
      return json({
        from: '',
        to: '',
        equipeId: null,
        totalProgramados: 0,
        totalPendentes: 0,
        pendentesTruncados: false,
        pendentes: [],
        porDia: [],
      });
    }
    if (method === 'GET' && path.includes('/chamados/em-execucao')) {
      return json({ total: 0, minhasEquipeIds: [], grupos: [] });
    }
    if (method === 'GET' && (path.includes('/chamados/equipes') || path.includes('/chamados/usuarios'))) {
      return json([]);
    }
    if (method === 'GET' && /\/chamados$/.test(path)) {
      return json({ items: [], total: 0, limit: 20, offset: 0, hasMore: false, statusCounts: { TODOS: 0 } });
    }
    if (method === 'GET' && path.includes('/chamado-tarefas/execucao')) {
      return json({ total: 0, contadores: { novas: 0, emAndamento: 0, atrasadas: 0 }, items: [] });
    }
    if (method === 'GET' && path.includes('/cronograma/calendario')) {
      return json({
        from: '',
        to: '',
        resumo: { total: 0, agendadas: 0, realizadas: 0, atrasadas: 0 },
        eventos: [],
      });
    }
    if (method === 'GET' && path.includes('/mobile/field-package')) {
      return json({
        unidades: [],
        checklists: [],
        programacoes: [],
        contadores: { unidades: 0, checklists: 0, programacoes: 0 },
      });
    }
    if (method === 'GET' && /\/documentos\/[^/]+$/.test(path)) {
      return json({ message: 'não encontrado' }, 404);
    }
    if (method === 'GET' && path.includes('/documentos') && !path.includes('/pendencias')) {
      return json({ items: [], total: 0, limit: 20, offset: 0, hasMore: false });
    }

    if (method === 'GET') return json([]);
    return json({});
  });

  return { trocas: () => [...trocas] };
}

async function preencherLogin(page: Page, email: string, remember = false) {
  const emailInput = page.getByPlaceholder('seu.email@franca.sp.gov.br');
  const senha = page.locator('input[type="password"]');
  await expect(emailInput).toBeVisible();
  // O formulário é controlado: preenche de novo se a hidratação limpar o valor.
  await expect(async () => {
    await emailInput.fill(email);
    await senha.fill(SENHA);
    await expect(emailInput).toHaveValue(email);
    await expect(senha).toHaveValue(SENHA);
  }).toPass();
  const lembrar = page.getByRole('checkbox', { name: /manter conectado/i });
  if (remember) await lembrar.check();
  else if (await lembrar.isChecked()) await lembrar.uncheck();
  await page.getByRole('button', { name: /^entrar$/i }).click();
}

async function entrar(page: Page, email: string, remember = false) {
  await page.goto('/login');
  await preencherLogin(page, email, remember);
}

async function contextoSessao(page: Page) {
  return page.evaluate(() => {
    const bruto = window.localStorage.getItem('sigma.auth');
    if (!bruto) return null;
    const auth = JSON.parse(bruto) as {
      user?: {
        perfilAtivo?: { id?: string; nome?: string } | null;
        secretariaAtiva?: { id?: string; sigla?: string } | null;
      };
    };
    const user = auth.user;
    return {
      perfilId: user?.perfilAtivo?.id ?? null,
      perfilNome: user?.perfilAtivo?.nome ?? null,
      secretariaId: user?.secretariaAtiva?.id ?? null,
      secretariaSigla: user?.secretariaAtiva?.sigla ?? null,
    };
  });
}

test.use({ serviceWorkers: 'block' });

test.describe('322 tela inicial', () => {
  test('sem sessão, / vai ao login e não à Vistoria', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    await expect(page).not.toHaveURL(/\/mobile/);
  });

  test('novo login com CCO abre o CCO e mantém secretaria e perfil', async ({ page }, testInfo) => {
    const api = await mockApi(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page, CCO_EMAIL, true);
    await expect(page).toHaveURL(/\/cco(?:\/|$|\?)/, { timeout: 20_000 });
    await expect(page).not.toHaveURL(/\/mobile/);
    await expect(page.getByRole('heading', { name: 'Visão operacional dos próprios públicos' })).toBeVisible();

    const antes = await contextoSessao(page);
    expect(antes?.perfilNome).toBe(PERFIL_CCO);
    expect(antes?.secretariaSigla).toBe(SIGLA);
    expect(api.trocas()).toEqual([]);

    await page.goto('/');
    await expect(page).toHaveURL(/\/cco(?:\/|$|\?)/, { timeout: 20_000 });
    const depois = await contextoSessao(page);
    expect(depois).toEqual(antes);
    expect(api.trocas()).toEqual([]);

    const engine = engineDe(testInfo.project.name);
    await page.screenshot({ path: path.join(OUT, `${engine}-1440x900-login-cco.png`) });
    writeFileSync(
      path.join(OUT, `assert-${engine}-a1-a7.json`),
      JSON.stringify({ criterio: ['322-A1', '322-A7'], engine, url: page.url(), contexto: depois, trocas: api.trocas() }, null, 2),
    );
  });

  test('matriz do CCO sem a chave legada ainda abre o CCO', async ({ page }) => {
    await mockApi(page);
    await entrar(page, MATRIZ_EMAIL);
    await expect(page).toHaveURL(/\/cco(?:\/|$|\?)/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Visão operacional dos próprios públicos' })).toBeVisible();
    await expect(page.getByText('Não há nenhuma funcionalidade liberada')).toHaveCount(0);
  });

  test('usuário sem CCO cai em Chamados', async ({ page }, testInfo) => {
    await mockApi(page);
    await page.setViewportSize({ width: 360, height: 640 });
    await entrar(page, SEM_CCO_EMAIL);
    await expect(page).toHaveURL(/\/chamados(?:\/|$|\?)/, { timeout: 20_000 });
    await expect(page).not.toHaveURL(/\/cco/);
    await expect(page).not.toHaveURL(/\/mobile/);
    await expect(page.getByRole('heading', { name: 'Chamados' })).toBeVisible();
    const engine = engineDe(testInfo.project.name);
    await page.screenshot({ path: path.join(OUT, `${engine}-360x640-sem-cco.png`) });
    writeFileSync(
      path.join(OUT, `assert-${engine}-a2.json`),
      JSON.stringify({ criterio: '322-A2', engine, viewport: '360x640', url: page.url() }, null, 2),
    );
  });

  test('F5 mantém Chamados, Execução, Documentos, Cronograma e Vistoria', async ({ page }, testInfo) => {
    await mockApi(page);
    await entrar(page, CCO_EMAIL);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });

    await page.goto('/chamados?aba=programacao&search=ZZ322');
    await expect(page).toHaveURL(/\/chamados\?/);
    await expect(page.getByRole('heading', { name: 'Chamados' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Programação', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page).toHaveURL(/search=ZZ322/);

    await page.reload();
    await expect(page).toHaveURL(/aba=programacao/);
    await expect(page).toHaveURL(/search=ZZ322/);
    await expect(page).not.toHaveURL(/\/cco/);
    await expect(page.getByRole('heading', { name: 'Chamados' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Programação', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('button', { name: 'Triagem', exact: true }).click();
    await expect(page).not.toHaveURL(/aba=programacao/);
    await expect(page).toHaveURL(/search=ZZ322/);
    await expect(page.getByRole('button', { name: 'Triagem', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByPlaceholder('Buscar por código, descrição ou unidade…')).toHaveValue('ZZ322');
    await page.reload();
    await expect(page).toHaveURL(/search=ZZ322/);
    await expect(page).not.toHaveURL(/aba=programacao/);
    await expect(page.getByRole('button', { name: 'Triagem', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByPlaceholder('Buscar por código, descrição ou unidade…')).toHaveValue('ZZ322');

    await page.goto('/execucao?aba=tarefas');
    await expect(page).toHaveURL(/\/execucao\?aba=tarefas/);
    await page.reload();
    await expect(page).toHaveURL(/\/execucao\?aba=tarefas/);
    await expect(page.getByRole('heading', { name: 'Execução' })).toBeVisible();

    await page.goto('/documentos?id=doc-322&search=ZZ322');
    await expect(page).toHaveURL(/\/documentos\?/);
    await page.reload();
    await expect(page).toHaveURL(/id=doc-322/);
    await expect(page).toHaveURL(/search=ZZ322/);
    await expect(page.getByRole('heading', { name: 'Documentos' })).toBeVisible();

    await page.goto('/cronograma');
    await page.reload();
    await expect(page).toHaveURL(/\/cronograma(?:\/|$|\?)/);
    await expect(page).not.toHaveURL(/\/mobile/);
    await expect(page.getByRole('heading', { name: 'Cronograma de checagens' })).toBeVisible();

    await page.goto('/mobile');
    await page.reload();
    await expect(page).toHaveURL(/\/mobile(?:\/|$|\?)/);
    await expect(page).not.toHaveURL(/\/cco/);
    await expect(page.getByRole('heading', { name: 'Vistoria em campo' })).toBeVisible();

    const engine = engineDe(testInfo.project.name);
    await page.screenshot({ path: path.join(OUT, `${engine}-f5-vistoria.png`) });
    writeFileSync(
      path.join(OUT, `assert-${engine}-a4.json`),
      JSON.stringify({ criterio: '322-A4', engine, url: page.url(), permaneceu: '/mobile' }, null, 2),
    );
  });

  test('link direto com permissão permanece; sem permissão vai à tela padrão sem o conteúdo', async ({ page }, testInfo) => {
    await mockApi(page);
    await page.goto('/chamados?aba=programacao&id=direto-322&search=ZZ322');
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
    await expect(page).toHaveURL(/returnTo=/);
    await preencherLogin(page, CCO_EMAIL);
    await expect(page).toHaveURL(/\/chamados\?/, { timeout: 20_000 });
    await expect(page).toHaveURL(/aba=programacao/);
    await expect(page).toHaveURL(/id=direto-322/);
    await expect(page.getByRole('heading', { name: 'Chamados' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Visão operacional dos próprios públicos' })).toHaveCount(0);

    await page.goto('/checklists');
    await expect(page).toHaveURL(/\/cco(?:\/|$|\?)/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Checklists' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Visão operacional dos próprios públicos' })).toBeVisible();

    const engine = engineDe(testInfo.project.name);
    await page.screenshot({ path: path.join(OUT, `${engine}-sem-permissao-cco.png`) });
    writeFileSync(
      path.join(OUT, `assert-${engine}-a5.json`),
      JSON.stringify({ criterio: '322-A5', engine, url: page.url(), conteudoNegado: 'Checklists' }, null, 2),
    );
  });

  test('nova abertura com sessão persistida em / vai para o CCO', async ({ browser }, testInfo) => {
    const origem = await browser.newContext();
    const page = await origem.newPage();
    await mockApi(page);
    await entrar(page, CCO_EMAIL, true);
    await expect(page).toHaveURL(/\/cco(?:\/|$|\?)/, { timeout: 20_000 });
    const antes = await contextoSessao(page);
    const estado = await origem.storageState();
    await origem.close();

    const novo = await browser.newContext({ storageState: estado });
    const reaberto = await novo.newPage();
    await mockApi(reaberto, USUARIOS[CCO_EMAIL]);
    await reaberto.goto('/');
    await expect(reaberto).toHaveURL(/\/cco(?:\/|$|\?)/, { timeout: 20_000 });
    await expect(reaberto).not.toHaveURL(/\/mobile/);
    await expect(reaberto.getByRole('heading', { name: 'Visão operacional dos próprios públicos' })).toBeVisible();
    const depois = await contextoSessao(reaberto);
    expect(depois?.perfilId).toBe(antes?.perfilId);
    expect(depois?.secretariaId).toBe(antes?.secretariaId);
    const engine = engineDe(testInfo.project.name);
    writeFileSync(
      path.join(OUT, `assert-${engine}-a3.json`),
      JSON.stringify(
        {
          criterio: '322-A3',
          engine,
          url: reaberto.url(),
          perfilId: depois?.perfilId,
          secretariaId: depois?.secretariaId,
          manteveContexto: depois?.perfilId === antes?.perfilId && depois?.secretariaId === antes?.secretariaId,
          naoAbriuVistoria: !reaberto.url().includes('/mobile'),
        },
        null,
        2,
      ),
    );
    await novo.close();
  });

  test('voltar do segundo plano no navegador não troca a tela', async ({ page }, testInfo) => {
    await mockApi(page);
    await entrar(page, CCO_EMAIL);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
    await page.goto('/execucao?aba=tarefas');
    await expect(page).toHaveURL(/\/execucao\?aba=tarefas/);
    const antes = page.url();

    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('pageshow'));
    });
    await page.waitForTimeout(400);
    expect(page.url()).toBe(antes);
    await expect(page.getByRole('heading', { name: 'Execução' })).toBeVisible();

    const engine = engineDe(testInfo.project.name);
    writeFileSync(
      path.join(OUT, `assert-${engine}-a6.json`),
      JSON.stringify(
        {
          criterio: '322-A6',
          engine,
          url: page.url(),
          nota: 'visibilitychange, focus e pageshow no navegador não redirecionam. A validação do PWA no aparelho é manual do Leandro.',
        },
        null,
        2,
      ),
    );
  });

  test('prints da tela inicial nos tamanhos do critério', async ({ page }, testInfo) => {
    const engine = engineDe(testInfo.project.name);
    await mockApi(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page, CCO_EMAIL);
    await expect(page).toHaveURL(/\/cco(?:\/|$|\?)/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Visão operacional dos próprios públicos' })).toBeVisible();

    for (const tamanho of TAMANHOS) {
      await page.setViewportSize({ width: tamanho.w, height: tamanho.h });
      await expect(page.getByRole('heading', { name: 'Visão operacional dos próprios públicos' })).toBeVisible();
      const nome = `${engine}-${tamanho.w}x${tamanho.h}`;
      await page.screenshot({ path: path.join(OUT, `${nome}-cco.png`) });
      writeFileSync(
        path.join(OUT, `assert-${nome}.json`),
        JSON.stringify(
          {
            criterio: '322-A1',
            engine,
            viewport: `${tamanho.w}x${tamanho.h}`,
            url: page.url(),
            emCco: /\/cco(?:\/|$|\?)/.test(new URL(page.url()).pathname + '/'),
            headingVisivel: true,
          },
          null,
          2,
        ),
      );
      await expect(page).toHaveURL(/\/cco(?:\/|$|\?)/);
      await expect(page).not.toHaveURL(/\/mobile/);
    }
  });
});
