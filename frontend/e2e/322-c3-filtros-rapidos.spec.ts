import { expect, test, type Page } from '@playwright/test';

/**
 * 322 C-3: três filtros em sequência, sem esperar a URL de cada um.
 * No fim, a query e os chips têm os três. Usuário sintético só no mock.
 */
const SENHA = 'Zzteste322!Aa';
const EMAIL = 'zzteste-cco@aion.local';

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

test.use({ serviceWorkers: 'block' });

async function mockApi(page: Page) {
  await page.route('**/api-gestop/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (url.pathname.includes('/auth/login') && method === 'POST') {
      return json({ accessToken: 'token-c3', tokenType: 'Bearer', expiresInSeconds: 8 * 3600, user: USUARIO });
    }
    if (url.pathname.includes('/auth/me')) return json(USUARIO);
    if (url.pathname.includes('/auth/refresh')) {
      return json({ accessToken: 'token-c3-r', tokenType: 'Bearer', expiresInSeconds: 8 * 3600, user: USUARIO });
    }
    if (url.pathname.includes('/documentos/pendencias-abertura-diaria')) {
      return json({ abrir: false, pendencias: { total: 0, grupos: [] } });
    }
    if (url.pathname.includes('/chamados/programacao')) {
      return json({ from: '', to: '', equipeId: null, totalProgramados: 0, totalPendentes: 0, pendentesTruncados: false, pendentes: [], porDia: [] });
    }
    if (url.pathname.endsWith('/chamados') || url.pathname.endsWith('/meus-chamados')) {
      return json({ items: [], total: 0, limit: 50, offset: 0, hasMore: false, statusCounts: { TODOS: 0 } });
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
  await page.getByRole('button', { name: /^entrar$/i }).click();
  await expect(page).toHaveURL(/\/cco(?:\/|$|\?)/, { timeout: 20_000 });
}

test('cliques seguidos em Alta, Fora do prazo e Programação ficam os três', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await mockApi(page);
  await entrar(page);
  await page.goto('/chamados');
  await expect(page.getByRole('heading', { name: 'Chamados', exact: true })).toBeVisible();
  const alta = page.getByRole('button', { name: 'Alta', exact: true });
  const fora = page.getByRole('button', { name: 'Fora do prazo', exact: true });
  const programacao = page.getByRole('button', { name: 'Programação', exact: true });
  await expect(alta).toBeVisible();

  await alta.click();
  await fora.click();
  await programacao.click();

  await expect(page).toHaveURL(/prioridade=alta/);
  await expect(page).toHaveURL(/sla=fora/);
  await expect(page).toHaveURL(/aba=programacao/);
  await expect(programacao).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Triagem', exact: true }).click();
  await expect(alta).toHaveClass(/bg-\[var\(--brand\)\]/);
  await expect(fora).toHaveClass(/bg-\[var\(--brand\)\]/);
});
