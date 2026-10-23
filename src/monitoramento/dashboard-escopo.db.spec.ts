/**
 * 306 — integração com Postgres LOCAL descartável: escopo de Secretaria no Dashboard.
 * Só roda com ESCOPO_306_TEST_DATABASE_URL (banco local migrado). Usa o seed fictício T306A/T306B
 * (scripts/seed-escopo-306-core.ts). Sessão montada pelo mesmo AuthService.resolveActiveSession do AuthGuard.
 */
import { ForbiddenException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedEscopo306, Seed306, T306 } from '../../scripts/seed-escopo-306-core';
import { AuthService } from '../auth/auth.service';
import { JwtPayload } from '../auth/jwt';
import { ChamadoTarefasService } from '../chamados/chamado-tarefas.service';
import { MonitoramentoService } from './monitoramento.service';

const URL = process.env.ESCOPO_306_TEST_DATABASE_URL;

describe.skipIf(!URL)('306 — Dashboard respeita a Secretaria ativa (Postgres local)', () => {
  let prisma: PrismaClient;
  let seed: Seed306;
  let svc: MonitoramentoService;
  let auth: AuthService;
  const sessao = async (usuarioId: string): Promise<JwtPayload> => {
    const s = await auth.resolveActiveSession(usuarioId);
    return { sub: usuarioId, nome: 'Fictício', email: 'x@teste306.invalid', ...s } as JwtPayload;
  };
  const siglasT306 = (lista: Array<{ sigla?: string | null; secretaria?: { sigla: string } | null }>) =>
    [...new Set(lista.map((x) => x.sigla ?? x.secretaria?.sigla).filter((s): s is string => Boolean(s && s.startsWith('T306'))))].sort();

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL! }) });
    seed = await seedEscopo306(prisma, 'Teste306-ficticio!');
    svc = new MonitoramentoService(prisma as never);
    auth = new AuthService(prisma as never, {} as never, {} as never, {} as never);
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('S1/S7: gestor de A vê só dados de A em todas as consultas do Dashboard (zero linhas de B)', async () => {
    const u = await sessao(seed.usuarios.gestorA);
    expect(u.secretariaId).toBe(seed.secretarias.A);
    const d = await svc.getDashboard({}, u);
    const e = T306.esperado.A;
    expect(d.indicadores.totalUnidades).toBe(e.unidades);
    expect(d.indicadores.fiscalizacoes).toBe(e.fiscalizacoes);
    expect(d.indicadores.naoConformidades).toBe(e.naoConformidades);
    expect(d.indicadores.chamados.abertos).toBe(e.chamadosAbertos);
    expect(d.indicadores.chamados.concluidos).toBe(e.chamadosConcluidos);
    expect(d.indicadores.syncPendentes).toBe(e.syncFalhas);
    expect(d.pendenciasPorSecretaria.map((s) => s.sigla)).toEqual([T306.siglas.A]);
    expect(d.analise.chamadosPorSecretaria.map((s) => s.chave)).toEqual([seed.secretarias.A]);
    expect(d.analise.totalVistoriasAnalisadas).toBe(e.fiscalizacoes);

    const alertas = await svc.getAlertasOperacionais(u);
    expect(siglasT306(alertas.chamadosAtrasados)).toEqual([T306.siglas.A]);
    expect(alertas.resumo.chamadosUrgentes).toBe(e.urgentes);
    expect(alertas.resumo.syncFalhas).toBe(e.syncFalhas);

    const logs = await svc.listAuditoria(u);
    expect(logs.length).toBe(e.auditoria);
    expect(logs.every((l) => l.secretariaAtivaId === seed.secretarias.A)).toBe(true);
  });

  it('S1/S7: gestor de B vê só B (volumes diferentes de A)', async () => {
    const u = await sessao(seed.usuarios.gestorB);
    const d = await svc.getDashboard({}, u);
    const e = T306.esperado.B;
    expect(d.indicadores.fiscalizacoes).toBe(e.fiscalizacoes);
    expect(d.indicadores.naoConformidades).toBe(e.naoConformidades);
    expect(d.indicadores.chamados.abertos).toBe(e.chamadosAbertos);
    expect(d.indicadores.syncPendentes).toBe(e.syncFalhas);
    expect(d.pendenciasPorSecretaria.map((s) => s.sigla)).toEqual([T306.siglas.B]);
    expect((await svc.listAuditoria(u)).length).toBe(e.auditoria);
  });

  it('S4: filtro/URL/API forçando outra Secretaria → 403 (Dashboard, alertas e opções de tarefas)', async () => {
    const u = await sessao(seed.usuarios.gestorA);
    await expect(svc.getDashboard({ secretariaId: seed.secretarias.B }, u)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.getAlertasOperacionais(u, seed.secretarias.B)).rejects.toBeInstanceOf(ForbiddenException);
    const tarefas = new ChamadoTarefasService(prisma as never, {} as never, {} as never);
    await expect(tarefas.opcoes(u, seed.secretarias.B)).rejects.toBeInstanceOf(ForbiddenException);
    const op = await tarefas.opcoes(u);
    expect(op.secretarias.map((s) => s.sigla)).toEqual([T306.siglas.A]);
    // filtro dentro do escopo funciona
    const d = await svc.getDashboard({ secretariaId: seed.secretarias.A }, u);
    expect(d.indicadores.naoConformidades).toBe(T306.esperado.A.naoConformidades);
  });

  it('S5: selecionar Secretaria não dá erro na contagem de NC e bate com a lista', async () => {
    const admin = await sessao(seed.usuarios.admin);
    for (const lado of ['A', 'B'] as const) {
      const d = await svc.getDashboard({ secretariaId: seed.secretarias[lado] }, admin);
      const lista = await prisma.naoConformidade.findMany({
        where: { status: { not: 'RESOLVIDA' }, fiscalizacao: { secretariaId: seed.secretarias[lado] } },
      });
      expect(d.indicadores.naoConformidades).toBe(lista.length);
      expect(d.indicadores.naoConformidades).toBe(T306.esperado[lado].naoConformidades);
    }
  });

  it('S2: admin em "Todas" vê as duas; usuário com vínculos A+B e ativa A vê só A (a ativa)', async () => {
    const admin = await sessao(seed.usuarios.admin);
    expect(admin.secretariaId ?? null).toBeNull();
    const d = await svc.getDashboard({}, admin);
    expect(siglasT306(d.pendenciasPorSecretaria)).toEqual([T306.siglas.A, T306.siglas.B]);
    expect(d.indicadores.naoConformidades).toBeGreaterThanOrEqual(T306.esperado.A.naoConformidades + T306.esperado.B.naoConformidades);

    const multi = await sessao(seed.usuarios.multi);
    const dm = await svc.getDashboard({}, multi);
    expect(siglasT306(dm.pendenciasPorSecretaria)).toEqual([T306.siglas.A]);
    await expect(svc.getDashboard({ secretariaId: seed.secretarias.B }, multi)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('S3 (backend): trocar a Secretaria ativa muda o escopo na próxima requisição, sem novo login', async () => {
    const multi = seed.usuarios.multi;
    await prisma.usuario.update({ where: { id: multi }, data: { secretariaAtivaId: seed.secretarias.B } });
    try {
      const u = await sessao(multi);
      const d = await svc.getDashboard({}, u);
      expect(d.pendenciasPorSecretaria.map((s) => s.sigla)).toEqual([T306.siglas.B]);
      expect(d.indicadores.naoConformidades).toBe(T306.esperado.B.naoConformidades);
    } finally {
      await prisma.usuario.update({ where: { id: multi }, data: { secretariaAtivaId: seed.secretarias.A } });
    }
  });
});
