import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

/**
 * 322-A8 L1 — o que a pessoa escolheu ver fica na URL.
 * Usuário sintético só no mock. A spec de UX (U-A8-1..10) vale sobre o critérios.md.
 */
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../evidencias/322');
mkdirSync(OUT, { recursive: true });

const SENHA = 'Zzteste322!Aa';
const EMAIL = 'zzteste-cco@aion.local';
const AVISO = 'Registro não encontrado ou sem acesso';
const CHAMADO_ID = 'ch-l1';
const TAREFA_ID = 't-l1';
const DOC_ID = 'doc-l1';
const VISTORIA_ID = '11111111-1111-4111-8111-111111111111';
const SECRETARIA = { id: 'sec-322', nome: 'Secretaria Fictícia 322', sigla: 'ZZ322' };

const USUARIO = {
  id: 'user-zzteste-cco',
  nome: 'ZZTESTE 322 CCO',
  email: EMAIL,
  perfis: ['ZZTESTE 322 CCO'],
  permissoes: [
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
    'cronograma.visualizar',
  ],
  secretaria: SECRETARIA,
  perfilAtivo: { id: 'perfil-cco-322', nome: 'ZZTESTE 322 CCO' },
  perfisDisponiveis: [{ id: 'perfil-cco-322', nome: 'ZZTESTE 322 CCO' }],
  secretariaAtiva: SECRETARIA,
  secretariasDisponiveis: [SECRETARIA],
};

const CHAMADO = {
  id: CHAMADO_ID,
  codigo: 'CH-L1',
  titulo: 'ZZ Chamado L1',
  descricao: 'Chamado sintético L1.',
  status: 'ABERTO',
  prioridade: 'ALTA',
  origem: 'INTERNO',
  prazoEm: '2026-12-31T00:00:00.000Z',
  previstaExecucaoEm: null,
  impedimentoMotivo: null,
  excluidoEm: null,
  enderecoTexto: 'Rua Sintética, 1',
  enderecoBairro: 'Centro',
  latitude: -20.53,
  longitude: -47.4,
  mapaLatitude: -20.53,
  mapaLongitude: -47.4,
  slaMapa: 'DENTRO',
  createdAt: '2026-11-01T12:00:00.000Z',
  solicitanteNome: 'ZZTESTE',
  secretaria: SECRETARIA,
  unidade: { id: 'u-l1', nome: 'EMEB ZZ L1', codigoPatrimonial: 'ZZ-L1' },
  equipe: { id: 'eq-l1', nome: 'Equipe ZZ L1' },
  tipoChamado: { id: 'tc-l1', nome: 'Elétrica' },
  responsavel: { id: 'u-l1', nome: 'Ana ZZ' },
  observadores: [],
  historico: [],
};

const TAREFA = {
  id: TAREFA_ID,
  titulo: 'Trocar lâmpadas do pátio',
  descricao: null,
  prazo: '2026-12-20T12:00:00.000Z',
  prioridade: 'ALTA',
  status: 'NOVA',
  justificativa: null,
  conclusaoTexto: null,
  observacao: null,
  atrasada: true,
  createdAt: '2026-11-01T12:00:00.000Z',
  concluidaEm: null,
  visualizadaEm: null,
  secretaria: SECRETARIA,
  equipe: { id: 'eq-l1', nome: 'Equipe ZZ L1' },
  responsavel: { id: 'u-l1', nome: 'Ana ZZ' },
  criadaPor: null,
  concluidaPor: null,
  anexos: [],
  podeTratar: true,
  podeAlterarDados: false,
  podeAndamento: true,
  podeConcluir: true,
  podeCancelar: false,
  podeVerHistorico: true,
  podeVerAnexos: true,
  historico: [],
  chamado: {
    id: CHAMADO_ID,
    codigo: 'CH-L1',
    titulo: 'ZZ Chamado L1',
    descricao: '',
    status: 'EM_EXECUCAO',
    prioridade: 'ALTA',
    enderecoTexto: 'Rua Sintética, 1',
    prazoEm: null,
    latitude: -20.53,
    longitude: -47.4,
    tipoChamado: { id: 'tc-l1', nome: 'Elétrica' },
    unidade: { id: 'u-l1', nome: 'EMEB ZZ L1' },
    secretaria: SECRETARIA,
    equipe: null,
  },
};

const DOCUMENTO = {
  id: DOC_ID,
  codigo: 'DOC-L1',
  titulo: 'ZZ Documento L1',
  tipo: 'NOTIFICACAO',
  situacao: 'GERADO',
  codigoValidacao: 'ZZL1',
  linkValidacao: '/documento/validar/ZZL1',
  createdAt: '2026-11-01T12:00:00.000Z',
  unidade: { id: 'u-l1', nome: 'EMEB ZZ L1' },
  chamado: null,
  chamados: [],
  podeCancelar: false,
  podePreencher: false,
  assinaturas: [],
  pedidosAssinatura: [],
};

const VISTORIA = {
  id: VISTORIA_ID,
  status: 'CONCLUIDA',
  origem: 'CAMPO',
  avulsaPorConflito: true,
  iniciadaEm: '2026-11-01T12:00:00.000Z',
  concluidaEm: '2026-11-01T13:00:00.000Z',
  dentroRaioPermitido: true,
  distanciaCheckinMetros: 10,
  createdAt: '2026-11-01T12:00:00.000Z',
  secretaria: SECRETARIA,
  unidade: { id: 'u-l1', nome: 'EMEB ZZ L1', codigoPatrimonial: 'ZZ-L1', tipo: 'ESCOLA' },
  agente: { id: 'u-l1', nome: 'Ana ZZ' },
  checklistVersao: { id: 'cv-l1', versao: 1, checklist: { id: 'ck-l1', nome: 'Checklist ZZ L1' } },
  nota: null,
  respostas: [],
  secoes: [],
};

test.use({ serviceWorkers: 'block' });

function engineDe(projectName: string) {
  return projectName.includes('webkit') ? 'webkit' : 'chromium';
}

async function mockApi(page: Page) {
  const trocas: string[] = [];
  await page.route('**/api-gestop/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path.includes('/auth/login') && method === 'POST') {
      return json({ accessToken: 'token-l1', tokenType: 'Bearer', expiresInSeconds: 30 * 24 * 3600, user: USUARIO });
    }
    if (path.includes('/auth/refresh') && method === 'POST') {
      return json({ accessToken: 'token-l1-r', tokenType: 'Bearer', expiresInSeconds: 30 * 24 * 3600, user: USUARIO });
    }
    if (path.includes('/auth/me')) return json(USUARIO);
    if (path.includes('/auth/perfil-ativo') || path.includes('/auth/secretaria-ativa')) {
      trocas.push(path);
      return json({ message: 'a URL não troca perfil nem secretaria' }, 500);
    }
    if (path.includes('/documentos/pendencias-abertura-diaria')) return json({ abrir: false, pendencias: { total: 0, grupos: [] } });
    if (path.includes('/operacional/resumo')) {
      return json({
        totalUnidades: 0, unidadesAtivas: 0, totalSecretarias: 1, fiscalizacoesConcluidas: 0,
        naoConformidadesAbertas: 0, chamadosAbertos: 1, vistoriasAtrasadas: 0, totalPendencias: 0, eventosSyncPendentes: 0,
      });
    }
    if (path.includes('/chamados/programacao')) {
      return json({ from: '', to: '', equipeId: null, totalProgramados: 0, totalPendentes: 0, pendentesTruncados: false, pendentes: [], porDia: [] });
    }
    if (path.includes('/chamados/em-execucao')) return json({ total: 0, minhasEquipeIds: [], grupos: [] });
    if (path.includes('/chamado-tarefas/execucao')) {
      return json({ total: 1, contadores: { novas: 1, emAndamento: 0, atrasadas: 1 }, items: [TAREFA] });
    }
    if (path.includes('/chamado-tarefas/por-chamado/')) return json({ total: 0, pendentes: 0, items: [] });
    if (path.endsWith(`/chamado-tarefas/${TAREFA_ID}`)) return json(TAREFA);
    if (path.includes('/chamado-tarefas/')) return json({ message: 'não encontrado' }, 404);
    if (path.endsWith(`/chamados/${CHAMADO_ID}`)) return json(CHAMADO);
    if (/\/chamados\/[^/]+$/.test(path)) return json({ message: 'não encontrado' }, 404);
    if (path.endsWith('/chamados') || path.endsWith('/meus-chamados')) {
      return json({ items: [CHAMADO], total: 1, limit: 50, offset: 0, hasMore: false, statusCounts: { TODOS: 1, ABERTO: 1 } });
    }
    if (path.endsWith(`/documentos/${DOC_ID}`)) return json(DOCUMENTO);
    if (/\/documentos\/[^/]+$/.test(path) && !path.includes('pendencias')) return json({ message: 'não encontrado' }, 404);
    if (path.includes('/documentos')) return json({ items: [DOCUMENTO], total: 1, limit: 50, offset: 0, hasMore: false });
    if (path.includes('/cronograma/calendario')) {
      return json({ from: '', to: '', resumo: { total: 0, agendadas: 0, realizadas: 0, atrasadas: 0 }, eventos: [] });
    }
    if (path.includes('/cronograma')) return json([]);
    if (path.endsWith(`/fiscalizacoes/${VISTORIA_ID}`)) return json(VISTORIA);
    if (/\/fiscalizacoes\/[^/]+$/.test(path)) return json({ message: 'não encontrado' }, 404);
    if (path.includes('/fiscalizacoes')) return json({ items: [VISTORIA], total: 1, limit: 50, offset: 0, hasMore: false });
    if (path.includes('/mobile/field-package')) {
      return json({ unidades: [], checklists: [], programacoes: [], contadores: { unidades: 0, checklists: 0, programacoes: 0 } });
    }
    if (method === 'GET') return json([]);
    return json({});
  });
  return { trocas: () => [...trocas] };
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

async function abrirCopia(page: Page, url: string) {
  const outra = await page.context().newPage();
  await mockApi(outra);
  await outra.goto(url);
  return outra;
}

test.describe('322 L1 estado na URL', () => {
  test.setTimeout(60_000);
  test('U-A8-1/2/4/5/6/7/9 Chamados', async ({ page }, testInfo) => {
    const api = await mockApi(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await entrar(page);

    const url = `/chamados?status=aberto&prioridade=alta&search=ZZ322&id=${CHAMADO_ID}`;
    await page.goto(url);
    await expect(page.getByRole('heading', { name: 'Chamados', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Triagem', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('CH-L1').first()).toBeVisible();
    await page.reload();
    await expect(page).not.toHaveURL(/aba=/);
    await expect(page).toHaveURL(/status=aberto/);
    await expect(page).toHaveURL(/prioridade=alta/);
    await expect(page).toHaveURL(/search=ZZ322/);
    await expect(page).toHaveURL(new RegExp(`id=${CHAMADO_ID}`));
    await expect(page.getByRole('button', { name: 'Triagem', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByPlaceholder('Buscar por código, descrição ou unidade…')).toHaveValue('ZZ322');
    await expect(page.getByText('CH-L1').first()).toBeVisible();
    await expect(page.getByText('Não foi possível carregar')).toHaveCount(0);

    await page.goto('/chamados?aba=programacao&mes=2026-12&search=ZZ322');
    await page.reload();
    await expect(page).toHaveURL(/aba=programacao/);
    await expect(page).toHaveURL(/mes=2026-12/);
    await expect(page.getByRole('button', { name: 'Programação', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.goto(url);

    const copia = await abrirCopia(page, page.url());
    await expect(copia.getByText('CH-L1').first()).toBeVisible();
    await expect(copia).toHaveURL(/status=aberto/);
    await copia.close();

    await page.goto('/cco');
    await page.goto('/chamados');
    await page.getByRole('button', { name: /^Aberto \d/ }).click();
    await page.getByRole('button', { name: 'Alta', exact: true }).click();
    await page.getByRole('button', { name: 'Fora do prazo', exact: true }).click();
    await expect(page).toHaveURL(/sla=fora/);
    await page.goBack();
    await expect(page).toHaveURL(/\/cco(?:\/|$|\?)/);

    await page.goto(`/chamados?status=aberto&id=chamado-inexistente`);
    await expect(page.getByText(AVISO)).toBeVisible();
    await expect(page).toHaveURL(/status=aberto/);
    await expect(page.getByText('Não foi possível carregar')).toHaveCount(0);

    await page.goto('/chamados?status=xyz&prioridade=alta');
    await expect(page).not.toHaveURL(/status=xyz/);
    await expect(page).toHaveURL(/prioridade=alta/);

    await page.goto('/chamados?secProprio=sec-fora-do-contexto&status=aberto');
    await expect(page).not.toHaveURL(/secProprio=/);
    await expect(page).toHaveURL(/status=aberto/);
    expect(api.trocas()).toEqual([]);

    await page.goto('/');
    await expect(page).toHaveURL(/\/cco(?:\/|$|\?)/);
    await expect(page).not.toHaveURL(/status=/);

    const engine = engineDe(testInfo.project.name);
    await page.screenshot({ path: path.join(OUT, `${engine}-l1-chamados-inicial.png`) });
  });

  test('U-A8-1/2/4/5/6 Execução', async ({ page }, testInfo) => {
    await mockApi(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await entrar(page);
    await page.goto(`/execucao?aba=tarefas&status=nova&atrasadas=1&tarefa=${TAREFA_ID}`);
    await expect(page.getByRole('heading', { name: 'Execução' })).toBeVisible();
    await expect(page.getByText('Trocar lâmpadas do pátio').first()).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/aba=tarefas/);
    await expect(page).toHaveURL(/status=nova/);
    await expect(page).toHaveURL(/atrasadas=1/);
    await expect(page).toHaveURL(new RegExp(`tarefa=${TAREFA_ID}`));
    await expect(page.getByText('Trocar lâmpadas do pátio').first()).toBeVisible();

    const copia = await abrirCopia(page, page.url());
    await expect(copia.getByText('Trocar lâmpadas do pátio').first()).toBeVisible();
    await copia.close();

    await page.goto('/cco');
    await page.goto('/execucao');
    await page.getByRole('button', { name: 'Tarefas', exact: true }).click();
    await page.getByRole('button', { name: /Filtros de tarefas/ }).click();
    await page.getByRole('button', { name: 'Atrasadas', exact: true }).click();
    await page.getByRole('button', { name: 'Histórico', exact: true }).click();
    await expect(page).toHaveURL(/atrasadas=1/);
    await expect(page).toHaveURL(/historico=1/);
    await page.goBack();
    await expect(page).toHaveURL(/\/cco(?:\/|$|\?)/);

    await page.goto(`/execucao?aba=tarefas&tarefa=tarefa-inexistente&status=nova`);
    await expect(page.getByText(AVISO)).toBeVisible();
    await expect(page).toHaveURL(/status=nova/);

    await page.goto('/execucao?aba=tarefas&status=xyz&atrasadas=1');
    await expect(page).not.toHaveURL(/status=xyz/);
    await expect(page).toHaveURL(/atrasadas=1/);

    const engine = engineDe(testInfo.project.name);
    await page.screenshot({ path: path.join(OUT, `${engine}-l1-execucao.png`) });
  });

  test('U-A8-1/2/4/5/6 Documentos', async ({ page }, testInfo) => {
    await mockApi(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await entrar(page);
    await page.goto(`/documentos?search=ZZ322&tipo=notificacao&historico=1&id=${DOC_ID}`);
    await expect(page.getByRole('heading', { name: 'Documentos' })).toBeVisible();
    await expect(page.getByText('DOC-L1').first()).toBeVisible();
    await expect(page.getByPlaceholder(/Buscar código/)).toHaveValue('ZZ322');
    await expect(page.getByTestId('toggle-historico')).toBeChecked();
    await page.reload();
    await expect(page).toHaveURL(/tipo=notificacao/);
    await expect(page).toHaveURL(/historico=1/);
    await expect(page).toHaveURL(new RegExp(`id=${DOC_ID}`));
    await expect(page.getByText('DOC-L1').first()).toBeVisible();

    const copia = await abrirCopia(page, page.url());
    await expect(copia.getByText('DOC-L1').first()).toBeVisible();
    await copia.close();

    await page.goto('/cco');
    await page.goto('/documentos');
    await page.locator('select').first().selectOption('NOTIFICACAO');
    await page.getByTestId('toggle-historico').check();
    await page.getByPlaceholder(/Buscar código/).fill('ZZ');
    await expect(page).toHaveURL(/tipo=notificacao/);
    await page.goBack();
    await expect(page).toHaveURL(/\/cco(?:\/|$|\?)/);

    await page.goto('/documentos?tipo=notificacao&id=doc-inexistente');
    await expect(page.getByText(AVISO)).toBeVisible();
    await expect(page).toHaveURL(/tipo=notificacao/);
    await expect(page.getByText('Não foi possível carregar')).toHaveCount(0);

    await page.goto('/documentos?tipo=xyz&historico=1');
    await expect(page).not.toHaveURL(/tipo=/);
    await expect(page).toHaveURL(/historico=1/);

    const engine = engineDe(testInfo.project.name);
    await page.screenshot({ path: path.join(OUT, `${engine}-l1-documentos.png`) });
  });

  test('U-A8-1/2/4/6/7 Cronograma', async ({ page }, testInfo) => {
    const api = await mockApi(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await entrar(page);
    await page.goto('/cronograma?mes=2026-12&dia=2026-12-03');
    await expect(page.getByRole('heading', { name: 'Cronograma de checagens' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /dezembro de 2026/i })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/mes=2026-12/);
    await expect(page).toHaveURL(/dia=2026-12-03/);
    await expect(page.getByRole('heading', { name: /dezembro de 2026/i })).toBeVisible();

    const copia = await abrirCopia(page, page.url());
    await expect(copia.getByRole('heading', { name: /dezembro de 2026/i })).toBeVisible();
    await copia.close();

    await page.goto('/cco');
    await page.goto('/cronograma');
    const antes = await page.evaluate(() => history.length);
    await page.getByRole('button', { name: 'Próximo →' }).click();
    await expect(page).toHaveURL(/mes=2026-12/);
    await page.getByRole('button', { name: 'Próximo →' }).click();
    await expect(page).toHaveURL(/mes=2027-01/);
    const depois = await page.evaluate(() => history.length);
    expect(depois, `histórico cresceu de ${antes} para ${depois}`).toBe(antes);
    await page.goBack();
    await expect(page).toHaveURL(/\/cco(?:\/|$|\?)/);

    await page.goto('/cronograma?mes=13-2026&dia=2026-12-03');
    await expect(page).not.toHaveURL(/mes=/);
    await expect(page).toHaveURL(/dia=2026-12-03/);

    await page.goto('/cronograma?secretaria=sec-fora-do-contexto&mes=2026-12');
    await expect(page).not.toHaveURL(/secretaria=/);
    await expect(page).toHaveURL(/mes=2026-12/);
    expect(api.trocas()).toEqual([]);

    const engine = engineDe(testInfo.project.name);
    await page.screenshot({ path: path.join(OUT, `${engine}-l1-cronograma.png`) });
  });

  test('U-A8-1/2/4/5/6 Vistorias', async ({ page }, testInfo) => {
    await mockApi(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    await entrar(page);
    await page.goto(`/vistorias?status=todas&tipoUnidade=escola&avulsa=sim&search=ZZ322&id=${VISTORIA_ID}`);
    await expect(page.getByRole('heading', { name: 'Vistorias realizadas' })).toBeVisible();
    await expect(page.getByText('EMEB ZZ L1').first()).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/status=todas/);
    await expect(page).toHaveURL(/tipoUnidade=escola/);
    await expect(page).toHaveURL(/avulsa=sim/);
    await expect(page).toHaveURL(/search=ZZ322/);
    await expect(page).toHaveURL(new RegExp(`id=${VISTORIA_ID}`));
    await expect(page.getByText('EMEB ZZ L1').first()).toBeVisible();

    const copia = await abrirCopia(page, page.url());
    await expect(copia.getByText('EMEB ZZ L1').first()).toBeVisible();
    await copia.close();

    await page.goto('/cco');
    await page.goto('/vistorias');
    await page.locator('select').first().selectOption('');
    await page.locator('select').nth(2).selectOption('ESCOLA');
    await expect(page).toHaveURL(/status=todas/);
    await expect(page).toHaveURL(/tipoUnidade=escola/);
    await page.goBack();
    await expect(page).toHaveURL(/\/cco(?:\/|$|\?)/);

    await page.goto(`/vistorias?status=todas&id=${'22222222-2222-4222-8222-222222222222'}`);
    await expect(page.getByText(AVISO)).toBeVisible();
    await expect(page).toHaveURL(/status=todas/);
    await expect(page.getByText('Não foi possível carregar')).toHaveCount(0);

    await page.goto('/vistorias?status=xyz&tipoUnidade=escola');
    await expect(page).not.toHaveURL(/status=/);
    await expect(page).toHaveURL(/tipoUnidade=escola/);
    await page.goto(`/vistorias?id=nao-e-uuid&tipoUnidade=escola`);
    await expect(page).not.toHaveURL(/id=/);
    await expect(page).toHaveURL(/tipoUnidade=escola/);

    const engine = engineDe(testInfo.project.name);
    await page.screenshot({ path: path.join(OUT, `${engine}-l1-vistorias.png`) });
  });

  test('U-A8-4 no celular o Voltar fecha o detalhe e mantém o filtro', async ({ page }, testInfo) => {
    await mockApi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await entrar(page);

    await page.goto('/chamados?status=aberto&prioridade=alta');
    await page.getByRole('button', { name: /CH-L1/ }).click();
    await expect(page).toHaveURL(new RegExp(`id=${CHAMADO_ID}`));
    await page.goBack();
    await expect(page).not.toHaveURL(/id=/);
    await expect(page).toHaveURL(/status=aberto/);
    await expect(page).toHaveURL(/prioridade=alta/);
    await expect(page).toHaveURL(/\/chamados/);

    await page.goto(`/documentos?tipo=notificacao`);
    await page.getByRole('button', { name: /DOC-L1/ }).click();
    await expect(page).toHaveURL(new RegExp(`id=${DOC_ID}`));
    await page.goBack();
    await expect(page).not.toHaveURL(/id=/);
    await expect(page).toHaveURL(/tipo=notificacao/);

    await page.goto('/vistorias?status=todas&tipoUnidade=escola');
    await page.getByRole('button', { name: /EMEB ZZ L1/ }).click();
    await expect(page).toHaveURL(new RegExp(`id=${VISTORIA_ID}`));
    await page.goBack();
    await expect(page).not.toHaveURL(/id=/);
    await expect(page).toHaveURL(/status=todas/);
    await expect(page).toHaveURL(/tipoUnidade=escola/);

    const engine = engineDe(testInfo.project.name);
    await page.screenshot({ path: path.join(OUT, `${engine}-l1-mobile-voltar.png`) });
  });

  test('U-A8-8 retomada não troca a URL e U-A8-10 nos quatro tamanhos', async ({ page }, testInfo) => {
    await mockApi(page);
    await entrar(page);
    const url = '/chamados?aba=programacao&status=aberto&prioridade=alta&search=ZZ322';
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(url);
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    await expect(page).toHaveURL(/aba=programacao/);
    await expect(page).toHaveURL(/status=aberto/);
    await expect(page).toHaveURL(/\/chamados/);

    const engine = engineDe(testInfo.project.name);
    for (const [w, h] of [[390, 844], [768, 1024], [1024, 768], [1280, 800]] as const) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(url);
      await page.reload();
      await expect(page).toHaveURL(/status=aberto/);
      await expect(page).toHaveURL(/prioridade=alta/);
      await expect(page.getByRole('heading', { name: 'Chamados', exact: true })).toBeVisible();
      await page.screenshot({ path: path.join(OUT, `${engine}-l1-${w}x${h}.png`) });
    }
  });
});
