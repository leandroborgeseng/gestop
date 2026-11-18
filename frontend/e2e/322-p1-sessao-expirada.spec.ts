import { expect, test, type Page } from '@playwright/test';

/**
 * P-1: token vencido em focus ou pageshow vai ao login com a URL completa no returnTo.
 * Depois do novo login, a query do L1 (aba, filtros e id) continua.
 * Usuário sintético só no mock. A senha é fixture local.
 */
const SENHA = 'Zzteste322!Aa';
const EMAIL = 'zzteste-cco@aion.local';
const MENSAGEM = 'Sua sessão expirou. Entre de novo para continuar de onde parou.';
const DESTINO = '/chamados?aba=programacao&status=aberto&search=ZZ322&id=ch-l1';

const USUARIO = {
  id: 'user-zzteste-cco',
  nome: 'ZZTESTE 322 CCO',
  email: EMAIL,
  perfis: ['ZZTESTE 322 CCO'],
  permissoes: ['matriz.cco._tela.visualizar', 'matriz.chamados._tela.visualizar', 'chamados.gerenciar'],
  secretaria: { id: 'sec-322', nome: 'Secretaria Fictícia 322', sigla: 'ZZ322' },
  perfilAtivo: { id: 'perfil-cco-322', nome: 'ZZTESTE 322 CCO' },
  perfisDisponiveis: [{ id: 'perfil-cco-322', nome: 'ZZTESTE 322 CCO' }],
  secretariaAtiva: { id: 'sec-322', nome: 'Secretaria Fictícia 322', sigla: 'ZZ322' },
  secretariasDisponiveis: [{ id: 'sec-322', nome: 'Secretaria Fictícia 322', sigla: 'ZZ322' }],
};

async function mockApi(page: Page) {
  await page.route('**/api-gestop/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (url.pathname.endsWith('/auth/login') && method === 'POST') {
      return json({ accessToken: 'token-p1', tokenType: 'Bearer', expiresInSeconds: 30 * 24 * 3600, user: USUARIO });
    }
    if (url.pathname.endsWith('/auth/me')) return json(USUARIO);
    if (url.pathname.endsWith('/auth/refresh')) {
      return json({ accessToken: 'token-p1-novo', tokenType: 'Bearer', expiresInSeconds: 30 * 24 * 3600, user: USUARIO });
    }
    if (url.pathname.includes('/documentos/pendencias-abertura-diaria')) {
      return json({ abrir: false, pendencias: { total: 0, grupos: [] } });
    }
    if (url.pathname.includes('/chamados/programacao')) {
      return json({ from: '', to: '', equipeId: null, totalProgramados: 0, totalPendentes: 0, pendentesTruncados: false, pendentes: [], porDia: [] });
    }
    if (method === 'GET' && url.pathname.endsWith('/chamados/ch-l1')) return json({ message: 'não encontrado' }, 404);
    if (method === 'GET' && url.pathname.endsWith('/chamados')) {
      return json({ items: [], total: 0, limit: 20, offset: 0, hasMore: false, statusCounts: { TODOS: 0 } });
    }
    if (method === 'GET') return json([]);
    return json({});
  });
}

async function entrar(page: Page) {
  await page.goto('/login');
  const email = page.getByPlaceholder('seu.email@franca.sp.gov.br');
  const senha = page.locator('input[type="password"]');
  await expect(async () => {
    await email.fill(EMAIL);
    await senha.fill(SENHA);
    await expect(email).toHaveValue(EMAIL);
  }).toPass();
  await page.getByRole('checkbox', { name: /manter conectado/i }).check();
  await page.getByRole('button', { name: /^entrar$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
}

async function abrirComQuery(page: Page) {
  await page.goto(DESTINO);
  await expect(page).toHaveURL(/\/chamados\?/);
  await expect(page.getByRole('heading', { name: 'Chamados' })).toBeVisible();
}

async function vencerToken(page: Page) {
  await page.evaluate(() => {
    const bruto = window.localStorage.getItem('sigma.auth');
    if (!bruto) throw new Error('sem sessão');
    const auth = JSON.parse(bruto) as { expiresAt: number };
    auth.expiresAt = Date.now() - 1_000;
    window.localStorage.setItem('sigma.auth', JSON.stringify(auth));
  });
}

async function conferirLoginEQuery(page: Page) {
  await expect(page).toHaveURL(/\/login\?/, { timeout: 20_000 });
  const login = new URL(page.url());
  expect(login.searchParams.get('reason')).toBe('expired');
  const returnTo = login.searchParams.get('returnTo') ?? '';
  expect(returnTo).toContain('/chamados?');
  expect(returnTo).toContain('aba=programacao');
  expect(returnTo).toContain('status=aberto');
  expect(returnTo).toContain('search=ZZ322');
  expect(returnTo).toContain('id=ch-l1');
  await expect(page.getByRole('status')).toHaveText(MENSAGEM);
  await expect(page.getByRole('alert', { name: MENSAGEM })).toHaveCount(0);

  const email = page.getByPlaceholder('seu.email@franca.sp.gov.br');
  const senha = page.locator('input[type="password"]');
  await expect(async () => {
    await email.fill(EMAIL);
    await senha.fill(SENHA);
    await expect(email).toHaveValue(EMAIL);
  }).toPass();
  await page.getByRole('button', { name: /^entrar$/i }).click();
  await expect(page).toHaveURL(/\/chamados\?/, { timeout: 20_000 });
  const volta = new URL(page.url());
  expect(volta.searchParams.get('aba')).toBe('programacao');
  expect(volta.searchParams.get('status')).toBe('aberto');
  expect(volta.searchParams.get('search')).toBe('ZZ322');
  expect(volta.searchParams.get('id')).toBe('ch-l1');
}

test.use({ serviceWorkers: 'block' });

test('só o focus de um token vencido preserva a query depois do login', async ({ page }) => {
  await mockApi(page);
  await entrar(page);
  await abrirComQuery(page);
  await vencerToken(page);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await conferirLoginEQuery(page);
});

test('só o pageshow de um token vencido preserva a query depois do login', async ({ page }) => {
  await mockApi(page);
  await entrar(page);
  await abrirComQuery(page);
  await vencerToken(page);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
  await conferirLoginEQuery(page);
});
