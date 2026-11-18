import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

/**
 * R-1 — a grade mostra o aviso de corte e os cartões do filtro inteiro.
 * Os números vêm do mock (a agregação no banco está no vitest). Dados sintéticos.
 */
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../evidencias/p31/R-1');
mkdirSync(OUT, { recursive: true });

const USER = {
  id: 'u-p31-r1',
  nome: 'ZZTESTE P31 R1',
  email: 'zzteste-p31-r1@aion.local',
  perfis: ['ZZTESTE P31'],
  permissoes: ['dashboard.visualizar'],
  secretaria: { id: 'sec-edu', nome: 'Educação', sigla: 'EDU' },
  perfilAtivo: { id: 'perfil-p31', nome: 'ZZTESTE P31' },
  perfisDisponiveis: [{ id: 'perfil-p31', nome: 'ZZTESTE P31' }],
  secretariaAtiva: { id: 'sec-edu', nome: 'Educação', sigla: 'EDU' },
  secretariasDisponiveis: [{ id: 'sec-edu', nome: 'Educação', sigla: 'EDU' }],
};

function tarefa(i: number) {
  return {
    id: `t-${i}`,
    titulo: `Tarefa sintética ${i}`,
    descricao: null,
    prazo: '2026-12-01T12:00:00.000Z',
    prioridade: 'MEDIA',
    status: 'NOVA',
    justificativa: null,
    conclusaoTexto: null,
    observacao: null,
    atrasada: false,
    createdAt: '2026-10-01T12:00:00.000Z',
    concluidaEm: null,
    visualizadaEm: null,
    secretaria: { id: 'sec-edu', nome: 'Educação', sigla: 'EDU' },
    equipe: null,
    responsavel: null,
    criadaPor: null,
    concluidaPor: null,
    anexos: [],
    situacaoPrazo: 'No prazo',
    chamado: {
      id: 'ch-1',
      codigo: `CH-ZZ-${String(i).padStart(4, '0')}`,
      titulo: 'Chamado sintético P31',
      descricao: 'Descrição sintética.',
      status: 'ABERTO',
      prioridade: 'MEDIA',
      enderecoTexto: null,
      prazoEm: null,
      latitude: null,
      longitude: null,
      tipoChamado: { id: 'tp', nome: 'Vazamento' },
      unidade: null,
      secretaria: null,
      equipe: null,
    },
  };
}

const ITENS_500 = Array.from({ length: 500 }, (_, i) => tarefa(i));

function relatorio(total: number, indicadores: Record<string, unknown>) {
  return {
    total,
    limite: 500,
    indicadores,
    items: ITENS_500,
  };
}

const CENARIOS = {
  '604': relatorio(604, {
    abertas: 404,
    novas: 250,
    emAndamento: 150,
    impedidas: 4,
    concluidas: 180,
    atrasadas: 254,
    porSecretaria: [
      { nome: 'EDU', total: 330, pendentes: 250, atrasadas: 200 },
      { nome: 'SAU', total: 274, pendentes: 150, atrasadas: 54 },
    ],
    porEquipe: [
      { nome: 'Equipe A', total: 330, pendentes: 250, atrasadas: 200 },
      { nome: 'Sem equipe', total: 274, pendentes: 150, atrasadas: 54 },
    ],
    porResponsavel: [{ nome: 'Sem responsável', total: 604, pendentes: 400, atrasadas: 254 }],
    porTipoChamado: [{ nome: 'Vazamento', total: 604, pendentes: 400, atrasadas: 254 }],
  }),
  '500': relatorio(500, {
    abertas: 500,
    novas: 500,
    emAndamento: 0,
    impedidas: 0,
    concluidas: 0,
    atrasadas: 0,
    porSecretaria: [{ nome: 'EDU', total: 500, pendentes: 500, atrasadas: 0 }],
    porEquipe: [{ nome: 'Equipe A', total: 500, pendentes: 500, atrasadas: 0 }],
    porResponsavel: [{ nome: 'Sem responsável', total: 500, pendentes: 500, atrasadas: 0 }],
    porTipoChamado: [{ nome: 'Vazamento', total: 500, pendentes: 500, atrasadas: 0 }],
  }),
  '501': relatorio(501, {
    abertas: 501,
    novas: 501,
    emAndamento: 0,
    impedidas: 0,
    concluidas: 0,
    atrasadas: 0,
    porSecretaria: [{ nome: 'EDU', total: 501, pendentes: 501, atrasadas: 0 }],
    porEquipe: [{ nome: 'Equipe A', total: 501, pendentes: 501, atrasadas: 0 }],
    porResponsavel: [{ nome: 'Sem responsável', total: 501, pendentes: 501, atrasadas: 0 }],
    porTipoChamado: [{ nome: 'Vazamento', total: 501, pendentes: 501, atrasadas: 0 }],
  }),
};

const DASHBOARD = {
  indicadores: {
    totalUnidades: 0,
    fiscalizacoes: 0,
    naoConformidades: 0,
    chamados: { abertos: 0, emAtendimento: 0, emExecucao: 0, impedidos: 0, concluidos: 0 },
    syncPendentes: 0,
  },
  pendenciasPorSecretaria: [],
};

function motor(nome: string) {
  return nome.includes('webkit') ? 'webkit' : 'chromium';
}

async function preparar(page: Page, cenario: keyof typeof CENARIOS) {
  await page.unroute('**/api-gestop/**').catch(() => undefined);
  await page.addInitScript((auth) => {
    localStorage.setItem('sigma.auth', JSON.stringify({ accessToken: 'token-p31-r1', user: auth, expiresAt: Date.now() + 86_400_000 }));
  }, USER);
  await page.route('**/api-gestop/**', async (route) => {
    const pathName = new URL(route.request().url()).pathname.replace(/^\/api-gestop/, '');
    const send = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (pathName === '/auth/me') return send(USER);
    if (pathName.startsWith('/monitoramento/dashboard')) return send(DASHBOARD);
    if (pathName.startsWith('/monitoramento/alertas')) {
      return send({ resumo: { chamadosAtrasados: 0, chamadosSemTriagem: 0, syncFalhas: 0, chamadosUrgentes: 0 }, chamadosAtrasados: [], chamadosSemTriagem: [] });
    }
    if (pathName.startsWith('/chamado-tarefas/relatorio')) return send(CENARIOS[cenario]);
    if (route.request().method() === 'GET') return send([]);
    return send({});
  });
}

test('R-1 a grade avisa o corte e mostra os cartões do filtro inteiro', async ({ page, browserName }) => {
  test.setTimeout(90_000);
  const tag = motor(browserName);
  await page.setViewportSize({ width: 1440, height: 900 });
  const casos = [
    { id: '604' as const, aviso: 'Mostrando 500 de 604 tarefas', pendentes: ['250 pendentes', '150 pendentes'], abertas: '404' },
    { id: '500' as const, aviso: null, pendentes: ['500 pendentes'], abertas: '500' },
    { id: '501' as const, aviso: 'Mostrando 500 de 501 tarefas', pendentes: ['501 pendentes'], abertas: '501' },
  ];
  const asserts: unknown[] = [];
  for (const caso of casos) {
    await preparar(page, caso.id);
    await page.goto('/dashboard');
    const atualizar = page.getByRole('button', { name: 'Atualizar' });
    await expect(atualizar).toBeVisible({ timeout: 20_000 });
    await atualizar.click();
    const aviso = page.getByTestId('aviso-corte-tarefas');
    if (caso.aviso) await expect(aviso).toHaveText(caso.aviso);
    else await expect(aviso).toHaveCount(0);
    const secao = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Tarefas de chamados' }) });
    await secao.scrollIntoViewIfNeeded();
    const texto = await secao.innerText();
    for (const trecho of caso.pendentes) expect(texto).toContain(trecho);
    expect(texto).toContain(caso.abertas);
    await secao.screenshot({ path: path.join(OUT, `${tag}-${caso.id}.png`), animations: 'disabled' });
    asserts.push({ cenario: caso.id, aviso: caso.aviso, pendentes: caso.pendentes, abertas: caso.abertas });
  }
  writeFileSync(path.join(OUT, `assert-${tag}.json`), JSON.stringify({ asserts }, null, 2));
});
