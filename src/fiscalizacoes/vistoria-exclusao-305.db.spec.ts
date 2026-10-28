/**
 * 305 — integração com Postgres LOCAL descartável (`_test` no nome): exclusão lógica de vistorias (E1 a E7).
 * Só roda com ESCOPO_306_TEST_DATABASE_URL (banco migrado; antes: npx prisma generate).
 * Seed fictício 305 (@aion.local). Cada teste cria vistorias NOVAS; nada é apagado.
 * Os services recebem o client com os filtros centrais (o mesmo do PrismaService).
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedExclusao305, Seed305 } from '../../scripts/seed-exclusao-305-core';
import { AuthService } from '../auth/auth.service';
import { JwtPayload } from '../auth/jwt';
import { CronogramaService } from '../cronograma/cronograma.service';
import { startOfDay, toDateKey } from '../cronograma/cronograma.rules';
import { MonitoramentoService } from '../monitoramento/monitoramento.service';
import { OperacionalService } from '../operacional/operacional.service';
import { withFiltrosOperacionais } from '../prisma/filtros-operacionais';
import { PrismaService } from '../prisma/prisma.service';
import { RelatoriosService } from '../relatorios/relatorios.service';
import { FiscalizacoesService } from './fiscalizacoes.service';

const URL = process.env.ESCOPO_306_TEST_DATABASE_URL;
const MOTIVO = 'Vistoria lançada em duplicidade (teste fictício 305)';

describe.skipIf(!URL)('305 — exclusão lógica de vistorias (Postgres local)', () => {
  let raw: PrismaClient;
  let prisma: PrismaClient;
  let seed: Seed305;
  let auth: AuthService;
  let svc: FiscalizacoesService;
  let cronograma: CronogramaService;
  let monitoramento: MonitoramentoService;
  let operacional: OperacionalService;
  let relatorios: RelatoriosService;
  let gestor: JwtPayload;
  let excluidor: JwtPayload;
  let leitor: JwtPayload;
  let gestorB: JwtPayload;

  const sessao = async (usuarioId: string): Promise<JwtPayload> => {
    const s = await auth.resolveActiveSession(usuarioId);
    return { sub: usuarioId, nome: 'Fictício 305', email: 'ficticio.305@aion.local', ...s } as JwtPayload;
  };

  /** Vistoria CONCLUÍDA fictícia com resposta (nota), NC, evidência e documento ligados. */
  const criarVistoria = async (
    opts: { lado?: 'A' | 'B'; valor?: boolean; cronogramaId?: string; concluidaEm?: Date; unidadeId?: string } = {},
  ) => {
    const lado = opts.lado ?? 'A';
    const concluidaEm = opts.concluidaEm ?? new Date();
    const unidadeId = opts.unidadeId ?? (lado === 'A' ? seed.unidadeA : seed.unidadeB);
    const f = await raw.fiscalizacao.create({
      data: {
        secretariaId: lado === 'A' ? seed.secretariaA : seed.secretariaB,
        unidadeId,
        checklistVersaoId: seed.versao,
        agenteId: lado === 'A' ? seed.gestor : seed.gestorB,
        status: 'CONCLUIDA',
        origem: 'ROTINA',
        iniciadaEm: new Date(concluidaEm.getTime() - 60_000),
        concluidaEm,
        cronogramaId: opts.cronogramaId ?? null,
        dataProgramada: opts.cronogramaId ? startOfDay(concluidaEm) : null,
      },
    });
    const resposta = await raw.respostaChecklist.create({
      data: { fiscalizacaoId: f.id, itemId: seed.item, valorBooleano: opts.valor ?? false, conformidade: opts.valor ? 'CONFORME' : 'NAO_CONFORME' },
    });
    const nc = await raw.naoConformidade.create({
      data: {
        fiscalizacaoId: f.id,
        respostaId: resposta.id,
        itemId: seed.item,
        unidadeId,
        registradaPorId: lado === 'A' ? seed.gestor : seed.gestorB,
        descricao: 'NC fictícia 305',
        status: 'ABERTA',
      },
    });
    await raw.evidencia.create({
      data: { fiscalizacaoId: f.id, respostaId: resposta.id, tipo: 'FOTO', url: 'https://exemplo.invalid/ficticia-305.jpg', capturadaEm: concluidaEm },
    });
    const sufixo = randomBytes(5).toString('hex');
    const doc = await raw.documento.create({
      data: {
        codigo: `T305-${sufixo}`,
        codigoValidacao: `T305V-${sufixo}`,
        tipo: 'RELATORIO_VISTORIA',
        origem: 'VISTORIA',
        titulo: 'Relatório fictício 305',
        secretariaId: lado === 'A' ? seed.secretariaA : seed.secretariaB,
        fiscalizacaoId: f.id,
      },
    });
    return { id: f.id, respostaId: resposta.id, ncId: nc.id, documentoId: doc.id };
  };

  const erroDe = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e) {
      return e;
    }
    throw new Error('esperava erro');
  };

  beforeAll(async () => {
    raw = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL! }) });
    prisma = withFiltrosOperacionais(raw) as unknown as PrismaClient;
    seed = await seedExclusao305(raw, randomBytes(24).toString('base64url'), URL!);
    auth = new AuthService(raw as never, {} as never, {} as never, {} as never);
    cronograma = new CronogramaService(prisma as never);
    svc = new FiscalizacoesService(prisma as never, {} as never, {} as never, cronograma, {} as never);
    monitoramento = new MonitoramentoService(prisma as never);
    operacional = new OperacionalService(prisma as never);
    relatorios = new RelatoriosService(prisma as never);
    gestor = await sessao(seed.gestor);
    excluidor = await sessao(seed.excluidor);
    leitor = await sessao(seed.leitor);
    gestorB = await sessao(seed.gestorB);
  });
  beforeEach(async () => {
    // Cronograma fictício 305: próxima = hoje, sem baixa (só UPDATE em dado fictício).
    await raw.cronogramaChecagem.update({
      where: { id: seed.cronograma },
      data: { ativo: true, frequencia: 'SEMANAL', proximaChecagemEm: startOfDay(new Date()), ultimaChecagemEm: null },
    });
  });
  afterAll(async () => {
    await raw?.$disconnect();
  });

  it('E1: sem a permissão Excluir → 403; sem motivo ou motivo curto → 400; nada muda', async () => {
    const v = await criarVistoria();
    expect(await erroDe(svc.excluir(v.id, MOTIVO, leitor))).toBeInstanceOf(ForbiddenException);
    for (const motivo of [undefined, '', '   ', 'abc', 'x'.repeat(1001), 'curto demais 19 car', 42]) {
      expect(await erroDe(svc.excluir(v.id, motivo, gestor))).toBeInstanceOf(BadRequestException);
    }
    const f = await raw.fiscalizacao.findUniqueOrThrow({ where: { id: v.id } });
    expect(f).toMatchObject({ status: 'CONCLUIDA', excluidoEm: null, exclusaoMotivo: null });
    expect(await raw.logAuditoria.count({ where: { entidadeTipo: 'Fiscalizacao', entidadeId: v.id } })).toBe(0);
  });

  it('E2/E7: vai para Excluída com quem, quando e motivo; nada é apagado (respostas, NC, evidências, documento)', async () => {
    const v = await criarVistoria();
    const totalAntes = await raw.fiscalizacao.count({ where: { OR: [{ excluidoEm: null }, { excluidoEm: { not: null } }] } });
    const t0 = Date.now();
    const r = await svc.excluir(v.id, `  ${MOTIVO}  `, gestor);
    expect(r).toMatchObject({ id: v.id, status: 'EXCLUIDA', excluida: true, exclusaoMotivo: MOTIVO });

    const f = await raw.fiscalizacao.findUniqueOrThrow({ where: { id: v.id } });
    expect(f.status).toBe('EXCLUIDA');
    expect(f.statusAntesExclusao).toBe('CONCLUIDA');
    expect(f.excluidoPorId).toBe(seed.gestor);
    expect(f.exclusaoMotivo).toBe(MOTIVO);
    expect(f.excluidoEm!.getTime()).toBeGreaterThanOrEqual(t0 - 1000);

    const log = await raw.logAuditoria.findFirstOrThrow({ where: { entidadeTipo: 'Fiscalizacao', entidadeId: v.id } });
    expect(log).toMatchObject({ acao: 'DELETE', usuarioId: seed.gestor, tela: 'vistorias', funcao: 'excluir' });
    expect(log.valorAntigo).toMatchObject({ excluida: false, status: 'CONCLUIDA' });
    expect(log.valorNovo).toMatchObject({ excluida: true, status: 'EXCLUIDA', motivo: MOTIVO, excluidoPorId: seed.gestor });
    const hist = await raw.historicoStatus.findFirstOrThrow({ where: { entidadeTipo: 'Fiscalizacao', entidadeId: v.id } });
    expect(hist).toMatchObject({ statusAnterior: 'CONCLUIDA', statusNovo: 'EXCLUIDA', motivo: MOTIVO, alteradoPorId: seed.gestor });

    // Nenhum registro apagado.
    expect(await raw.fiscalizacao.count({ where: { OR: [{ excluidoEm: null }, { excluidoEm: { not: null } }] } })).toBe(totalAntes);
    expect(await raw.respostaChecklist.count({ where: { fiscalizacaoId: v.id } })).toBe(1);
    expect(await raw.evidencia.count({ where: { fiscalizacaoId: v.id } })).toBe(1);
    const nc = await raw.naoConformidade.findUniqueOrThrow({ where: { id: v.ncId } });
    expect(nc.status).toBe('ABERTA');
    const doc = await raw.documento.findUniqueOrThrow({ where: { id: v.documentoId } });
    expect(doc.fiscalizacaoId).toBe(v.id);
  });

  it('E2: excluir de novo → 409 sem duplicar auditoria; dois cliques ao mesmo tempo = uma exclusão', async () => {
    const v = await criarVistoria();
    const resultados = await Promise.allSettled([svc.excluir(v.id, MOTIVO, gestor), svc.excluir(v.id, MOTIVO, gestor)]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const falha = resultados.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(falha.reason).toBeInstanceOf(ConflictException);
    expect(await erroDe(svc.excluir(v.id, MOTIVO, gestor))).toBeInstanceOf(ConflictException);
    expect(await raw.logAuditoria.count({ where: { entidadeTipo: 'Fiscalizacao', entidadeId: v.id } })).toBe(1);
  });

  it('E2: só vistoria realizada (concluída) pode ser excluída → em andamento responde 409', async () => {
    const v = await criarVistoria();
    await raw.fiscalizacao.update({ where: { id: v.id }, data: { status: 'EM_ANDAMENTO', concluidaEm: null } });
    expect(await erroDe(svc.excluir(v.id, MOTIVO, gestor))).toBeInstanceOf(ConflictException);
    expect((await raw.fiscalizacao.findUniqueOrThrow({ where: { id: v.id } })).excluidoEm).toBeNull();
  });

  it('E3: some da lista, Dashboard, CCO (contagem, NC, nota), resumo e relatório — cada contagem cai exatamente 1', async () => {
    // Vistoria antiga com nota 100% e a nova (mais recente) com 0%: excluída a nova, a nota do próprio volta à antiga.
    await criarVistoria({ valor: true, concluidaEm: new Date(Date.now() - 3_600_000) });
    const v = await criarVistoria({ valor: false });
    const medir = async () => {
      const lista = await svc.list({ unidadeId: seed.unidadeA, limit: 100 }, gestor);
      const dash = await monitoramento.getDashboard({}, gestor);
      const resumo = await operacional.getResumo(gestor);
      const cco = await operacional.getUnidadeDetalhe(seed.unidadeA);
      const rel = await relatorios.exportFiscalizacoes({ secretariaId: seed.secretariaA } as never);
      return {
        lista: lista.total,
        naLista: lista.items.some((i) => i.id === v.id),
        dashVistorias: dash.indicadores.fiscalizacoes,
        dashNc: dash.indicadores.naoConformidades,
        dashSecretaria: dash.pendenciasPorSecretaria.find((s) => s.id === seed.secretariaA)?.fiscalizacoes,
        resumoConcluidas: resumo.fiscalizacoesConcluidas,
        resumoNc: resumo.naoConformidadesAbertas,
        ccoVistorias: cco.totais.fiscalizacoes,
        ccoNc: cco.totais.naoConformidadesAbertas,
        ccoUltimas: cco.ultimasFiscalizacoes.some((f) => f.id === v.id),
        ccoNota: cco.ultimaVistoriaNota?.fiscalizacaoId,
        relatorio: rel.length,
        noRelatorio: rel.some((f) => f.id === v.id),
      };
    };
    const antes = await medir();
    expect(antes.naLista).toBe(true);
    expect(antes.ccoUltimas).toBe(true);
    expect(antes.ccoNota).toBe(v.id);
    expect(antes.noRelatorio).toBe(true);

    await svc.excluir(v.id, MOTIVO, gestor);
    const depois = await medir();
    expect(depois.lista).toBe(antes.lista - 1);
    expect(depois.naLista).toBe(false);
    expect(depois.dashVistorias).toBe(antes.dashVistorias - 1);
    expect(depois.dashNc).toBe(antes.dashNc - 1);
    expect(depois.dashSecretaria).toBe(antes.dashSecretaria! - 1);
    expect(depois.resumoConcluidas).toBe(antes.resumoConcluidas - 1);
    expect(depois.resumoNc).toBe(antes.resumoNc - 1);
    expect(depois.ccoVistorias).toBe(antes.ccoVistorias - 1);
    expect(depois.ccoNc).toBe(antes.ccoNc - 1);
    expect(depois.ccoUltimas).toBe(false);
    expect(depois.ccoNota).not.toBe(v.id);
    expect(depois.relatorio).toBe(antes.relatorio - 1);
    expect(depois.noRelatorio).toBe(false);
  });

  it('E4: "Mostrar excluídas" exige Visualizar excluídas; com ela a vistoria vem com a tag e somente leitura', async () => {
    const v = await criarVistoria();
    await svc.excluir(v.id, MOTIVO, gestor);

    expect(await erroDe(svc.list({ incluirExcluidas: 'true' }, leitor))).toBeInstanceOf(ForbiddenException);
    expect(await erroDe(svc.list({ incluirExcluidas: 'true' }, excluidor))).toBeInstanceOf(ForbiddenException);
    // Sem a subfunção, nem pelo id.
    expect(await erroDe(svc.getById(v.id, excluidor))).toBeInstanceOf(NotFoundException);
    expect(await erroDe(svc.getById(v.id, leitor))).toBeInstanceOf(NotFoundException);

    const padrao = await svc.list({ unidadeId: seed.unidadeA, limit: 100 }, gestor);
    expect(padrao.items.some((i) => i.id === v.id)).toBe(false);
    const comExcluidas = await svc.list({ unidadeId: seed.unidadeA, incluirExcluidas: 'true', limit: 100 }, gestor);
    const item = comExcluidas.items.find((i) => i.id === v.id);
    expect(item).toMatchObject({ status: 'EXCLUIDA', excluida: true, somenteLeitura: true });
    expect(comExcluidas.total).toBeGreaterThan(padrao.total);

    // O filtro padrão da tela é "Concluídas": com Mostrar excluídas, a excluída que estava concluída também vem.
    const concluidas = await svc.list({ unidadeId: seed.unidadeA, status: 'CONCLUIDA', incluirExcluidas: 'true', limit: 100 }, gestor);
    expect(concluidas.items.some((i) => i.id === v.id)).toBe(true);
    const soConcluidas = await svc.list({ unidadeId: seed.unidadeA, status: 'CONCLUIDA', limit: 100 }, gestor);
    expect(soConcluidas.items.some((i) => i.id === v.id)).toBe(false);

    const detalhe = await svc.getById(v.id, gestor);
    expect(detalhe).toMatchObject({ id: v.id, status: 'EXCLUIDA', excluida: true, somenteLeitura: true, exclusaoMotivo: MOTIVO });
    expect(detalhe.excluidoPor?.id).toBe(seed.gestor);
  });

  it('E5: não exclui vistoria de fora da Secretaria (404, nada muda); a da própria Secretaria B o gestor B exclui', async () => {
    const vb = await criarVistoria({ lado: 'B' });
    expect(await erroDe(svc.excluir(vb.id, MOTIVO, gestor))).toBeInstanceOf(NotFoundException);
    expect((await raw.fiscalizacao.findUniqueOrThrow({ where: { id: vb.id } })).excluidoEm).toBeNull();
    const va = await criarVistoria({ lado: 'A' });
    expect(await erroDe(svc.excluir(va.id, MOTIVO, gestorB))).toBeInstanceOf(NotFoundException);
    expect((await raw.fiscalizacao.findUniqueOrThrow({ where: { id: va.id } })).excluidoEm).toBeNull();
    await expect(svc.excluir(vb.id, MOTIVO, gestorB)).resolves.toMatchObject({ excluida: true });
    // id inexistente → 404
    expect(await erroDe(svc.excluir(randomUUID(), MOTIVO, gestor))).toBeInstanceOf(NotFoundException);
  });

  it('E6: a programação baixada pela vistoria fica sinalizada e NÃO reabre sozinha', async () => {
    const hoje = new Date();
    const v = await criarVistoria({ cronogramaId: seed.cronograma, concluidaEm: hoje });
    await cronograma.registrarChecagemRealizadaTx(raw as never, {
      cronogramaId: seed.cronograma,
      unidadeId: seed.unidadeA,
      checklistId: seed.checklist,
      concluidaEm: hoje,
    });
    const baixada = await raw.cronogramaChecagem.findUniqueOrThrow({ where: { id: seed.cronograma } });
    expect(baixada.ultimaChecagemEm).not.toBeNull();
    const periodo = { from: toDateKey(startOfDay(hoje)), to: toDateKey(startOfDay(new Date(hoje.getTime() + 14 * 86_400_000))) };
    const calAntes = await cronograma.getCalendario({ ...periodo, unidadeId: seed.unidadeA } as never, gestor);
    const progAntes = await cronograma.listVistoriasProgramadas({ ...periodo, unidadeId: seed.unidadeA }, gestor);

    const r = await svc.excluir(v.id, MOTIVO, gestor);
    expect(r.programacaoSinalizadaId).toBe(seed.cronograma);

    // Não reabre: a baixa e a próxima data continuam as mesmas.
    const depois = await raw.cronogramaChecagem.findUniqueOrThrow({ where: { id: seed.cronograma } });
    expect(depois.ultimaChecagemEm?.getTime()).toBe(baixada.ultimaChecagemEm?.getTime());
    expect(depois.proximaChecagemEm.getTime()).toBe(baixada.proximaChecagemEm.getTime());

    const progDepois = await cronograma.listVistoriasProgramadas({ ...periodo, unidadeId: seed.unidadeA }, gestor);
    expect(progDepois.items.map((i) => i.id)).toEqual(progAntes.items.map((i) => i.id));
    const doCronograma = progDepois.items.filter((i) => i.cronogramaId === seed.cronograma);
    expect(doCronograma.length).toBeGreaterThan(0);
    expect(doCronograma.every((i) => i.baixaPorVistoriaExcluida?.fiscalizacaoId === v.id)).toBe(true);
    // Nenhum card de hoje voltou como pendente.
    expect(doCronograma.some((i) => i.data === toDateKey(startOfDay(hoje)))).toBe(false);

    const calDepois = await cronograma.getCalendario({ ...periodo, unidadeId: seed.unidadeA } as never, gestor);
    expect(calDepois.resumo.realizadas).toBe(calAntes.resumo.realizadas - 1);
    expect(calDepois.resumo.baixadasPorVistoriaExcluida).toBe(calAntes.resumo.baixadasPorVistoriaExcluida + 1);
    expect(calDepois.resumo.agendadas).toBe(calAntes.resumo.agendadas);
    expect(calDepois.resumo.atrasadas).toBe(calAntes.resumo.atrasadas);
    const ev = calDepois.eventos.find((e) => e.id === `realizada-${v.id}`);
    expect(ev?.vistoriaExcluida).toBe(true);

    // Sem Visualizar excluídas, o evento continua (data baixada) mas sem o id da vistoria.
    const calExcluidor = await cronograma.getCalendario({ ...periodo, unidadeId: seed.unidadeA } as never, excluidor);
    expect(calExcluidor.eventos.some((e) => e.vistoriaExcluida && e.fiscalizacaoId === v.id)).toBe(false);

    // Uma baixa nova depois resolve a sinalização.
    await raw.cronogramaChecagem.update({
      where: { id: seed.cronograma },
      data: { ultimaChecagemEm: startOfDay(new Date(hoje.getTime() + 7 * 86_400_000)) },
    });
    const progResolvida = await cronograma.listVistoriasProgramadas({ ...periodo, unidadeId: seed.unidadeA }, gestor);
    expect(progResolvida.items.filter((i) => i.cronogramaId === seed.cronograma).every((i) => i.baixaPorVistoriaExcluida === null)).toBe(true);
  });

  it('E6: vistoria sem vínculo que realizou a data (sem baixa gravada) → depois de excluída a data NÃO volta como pendente', async () => {
    // Data única desta execução (o banco é reaproveitado): programação nessa data, sem baixa gravada; a vistoria
    // avulsa do mesmo próprio+checklist realiza a data pela regra antiga (unidade+checklist+dia).
    // Próprio T305-C só deste teste; data futura (400 dias). O horário da conclusão cresce a cada execução, para que
    // a vistoria desta execução seja a mais recente mesmo com o banco reaproveitado.
    const hoje = startOfDay(new Date(Date.now() + 400 * 86_400_000));
    await raw.cronogramaChecagem.update({
      where: { id: seed.cronogramaC },
      data: { ativo: true, frequencia: 'SEMANAL', proximaChecagemEm: hoje, ultimaChecagemEm: null },
    });
    const periodo = { from: toDateKey(hoje), to: toDateKey(hoje) };
    const v = await criarVistoria({ unidadeId: seed.unidadeC, concluidaEm: new Date(hoje.getTime() + (Date.now() - startOfDay(new Date()).getTime())) });
    const antes = await cronograma.listVistoriasProgramadas({ ...periodo, unidadeId: seed.unidadeC }, gestor);
    expect(antes.items.some((i) => i.cronogramaId === seed.cronogramaC)).toBe(false);

    await svc.excluir(v.id, MOTIVO, gestor);
    const depois = await cronograma.listVistoriasProgramadas({ ...periodo, unidadeId: seed.unidadeC }, gestor);
    expect(depois.items.some((i) => i.cronogramaId === seed.cronogramaC)).toBe(false);
    const c = await raw.cronogramaChecagem.findUniqueOrThrow({ where: { id: seed.cronogramaC } });
    expect(c.ultimaChecagemEm).toBeNull();
    expect(c.proximaChecagemEm.getTime()).toBe(hoje.getTime());
    // e a programação aparece sinalizada quando o período inclui a próxima data seguinte
    const prox = await cronograma.listVistoriasProgramadas(
      { from: toDateKey(hoje), to: toDateKey(new Date(hoje.getTime() + 14 * 86_400_000)), unidadeId: seed.unidadeC },
      gestor,
    );
    const itens = prox.items.filter((i) => i.cronogramaId === seed.cronogramaC);
    expect(itens.length).toBeGreaterThan(0);
    expect(itens.some((i) => i.data === toDateKey(hoje))).toBe(false);
    expect(itens.every((i) => i.baixaPorVistoriaExcluida?.fiscalizacaoId === v.id)).toBe(true);
  });

  it('E3: o PrismaService da aplicação aplica o mesmo filtro central (excluída fora de findMany/count)', async () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = URL;
    const app = new PrismaService();
    try {
      const v = await criarVistoria();
      await svc.excluir(v.id, MOTIVO, gestor);
      expect(await app.fiscalizacao.count({ where: { id: v.id } })).toBe(0);
      expect(await app.fiscalizacao.findMany({ where: { id: v.id } })).toHaveLength(0);
      expect(await app.fiscalizacao.count({ where: { id: v.id, excluidoEm: { not: null } } })).toBe(1);
      // findUnique (por id) não é lista: continua achando, para auditoria e reenvio do app.
      expect((await app.fiscalizacao.findUnique({ where: { id: v.id } }))?.status).toBe('EXCLUIDA');
    } finally {
      await app.$disconnect();
      process.env.DATABASE_URL = original;
    }
  });
});
