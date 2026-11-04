/**
 * 310 — integração com Postgres LOCAL descartável: troca da Secretaria responsável pela execução.
 * Só roda com ESCOPO_306_TEST_DATABASE_URL (seed fictício 306 + 307). Só inserções novas por execução.
 */
import { randomBytes } from 'node:crypto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedResponsaveis307, Seed307 } from '../../scripts/seed-responsaveis-307-core';
import { AuthService } from '../auth/auth.service';
import { JwtPayload } from '../auth/jwt';
import { ChamadosService } from './chamados.service';
import { MSG_REVISAR_EQUIPE } from './secretaria-execucao-310';

const URL = process.env.ESCOPO_306_TEST_DATABASE_URL;

describe.skipIf(!URL)('310 — Secretaria responsável pela execução (Postgres local)', () => {
  let prisma: PrismaClient;
  let seed: Seed307;
  let svc: ChamadosService;
  let auth: AuthService;
  // Chamados/equipes/Secretarias criados aqui são removidos no fim: o Dashboard (306) conta chamados das Secretarias do seed.
  const criados = { chamados: [] as string[], equipes: [] as string[], secretarias: [] as string[] };
  const sessao = async (usuarioId: string, permissoes = ['chamados.gerenciar']): Promise<JwtPayload> => {
    const s = await auth.resolveActiveSession(usuarioId);
    return { sub: usuarioId, nome: 'Fictício', email: 'x@teste306.invalid', ...s, permissoes } as JwtPayload;
  };
  const novoChamado = async (opts: { equipeA?: boolean; responsavelId?: string } = {}) => {
    const suf = randomBytes(4).toString('hex');
    const equipe = opts.equipeA
      ? await prisma.equipe.create({ data: { codigo: `EQ310-${suf}`, nome: `Equipe Fictícia 310 ${suf}`, secretariaId: seed.secretarias.A } })
      : null;
    if (equipe) criados.equipes.push(equipe.id);
    const ch = await prisma.chamado.create({
      data: {
        codigo: `CH-310-${suf}`,
        secretariaId: seed.secretarias.A,
        unidadeId: seed.unidadeA,
        descricao: 'Chamado fictício 310',
        equipeId: equipe?.id ?? null,
        responsavelId: opts.responsavelId ?? null,
      },
    });
    criados.chamados.push(ch.id);
    return ch;
  };

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL! }) });
    seed = await seedResponsaveis307(prisma, randomBytes(24).toString('base64url'), URL!);
    svc = new ChamadosService(prisma as never, {} as never, {} as never, {} as never, {} as never);
    auth = new AuthService(prisma as never, {} as never, {} as never, {} as never);
  });
  afterAll(async () => {
    if (prisma) {
      await prisma.historicoStatus.deleteMany({ where: { entidadeId: { in: criados.chamados } } });
      await prisma.logAuditoria.deleteMany({ where: { entidadeId: { in: criados.chamados } } });
      await prisma.chamado.deleteMany({ where: { id: { in: criados.chamados } } });
      await prisma.equipe.deleteMany({ where: { id: { in: criados.equipes } } });
      await prisma.secretaria.deleteMany({ where: { id: { in: criados.secretarias } } });
    }
    await prisma?.$disconnect();
  });

  it('lista de destino traz TODAS as Secretarias ativas, mesmo com a sessão na Secretaria A', async () => {
    const inativa = await prisma.secretaria.create({ data: { sigla: `T310X${randomBytes(2).toString('hex')}`, nome: 'Secretaria Fictícia Inativa 310', ativo: false } });
    criados.secretarias.push(inativa.id);
    const ids = (await svc.listSecretariasDestinoExecucao()).map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([seed.secretarias.A, seed.secretarias.B]));
    expect(ids).not.toContain(inativa.id);
    expect(ids.length).toBe(await prisma.secretaria.count({ where: { ativo: true } }));
  });

  it('gestor de A transfere para B: aceita, histórico e auditoria com origem → destino, próprio intacto, orienta revisar equipe e responsável', async () => {
    const c = await novoChamado({ equipeA: true, responsavelId: seed.usuarios.gestorA });
    const u = await sessao(seed.usuarios.gestorA);
    const unidadeAntes = await prisma.unidadePublica.findUniqueOrThrow({ where: { id: seed.unidadeA } });
    const r = (await svc.updateAbertura(c.id, { secretariaId: seed.secretarias.B }, u)) as unknown as {
      secretaria: { id: string };
      transferenciaExecucao: { origem: { id: string }; destino: { id: string }; revisar: { equipe?: unknown; responsavel?: { id: string } }; saiuDoEscopo: boolean };
    };
    expect(r.secretaria.id).toBe(seed.secretarias.B);
    expect(r.transferenciaExecucao.origem.id).toBe(seed.secretarias.A);
    expect(r.transferenciaExecucao.destino.id).toBe(seed.secretarias.B);
    expect(r.transferenciaExecucao.revisar.equipe).toBeTruthy();
    expect(r.transferenciaExecucao.revisar.responsavel?.id).toBe(seed.usuarios.gestorA);
    expect(r.transferenciaExecucao.saiuDoEscopo).toBe(false); // a equipe de A ainda dá acesso ao gestor de A

    const depois = await prisma.chamado.findUniqueOrThrow({ where: { id: c.id } });
    expect(depois.secretariaId).toBe(seed.secretarias.B);
    expect(depois.equipeId).toBe(c.equipeId); // só orienta, não limpa
    expect(depois.responsavelId).toBe(seed.usuarios.gestorA);
    expect((await prisma.unidadePublica.findUniqueOrThrow({ where: { id: seed.unidadeA } })).secretariaId).toBe(unidadeAntes.secretariaId);

    const hist = await prisma.historicoStatus.findFirstOrThrow({ where: { entidadeId: c.id }, orderBy: { createdAt: 'desc' } });
    const meta = hist.metadata as { alteracoes: Array<{ de: string; para: string; label: string }>; secretariaExecucao: { origem: { id: string }; destino: { id: string } } };
    expect(meta.secretariaExecucao.origem.id).toBe(seed.secretarias.A);
    expect(meta.secretariaExecucao.destino.id).toBe(seed.secretarias.B);
    expect(meta.alteracoes.some((a) => a.label === 'Secretaria responsável pela execução')).toBe(true);

    const log = await prisma.logAuditoria.findFirstOrThrow({ where: { entidadeId: c.id, funcao: 'secretaria_execucao' } });
    expect(log.usuarioId).toBe(seed.usuarios.gestorA);
    expect(log.descricao).toMatch(/→/);
    expect((log.valorAntigo as { secretariaId: string }).secretariaId).toBe(seed.secretarias.A);
    expect((log.valorNovo as { secretariaId: string }).secretariaId).toBe(seed.secretarias.B);
    expect(MSG_REVISAR_EQUIPE).toContain('Revise a equipe');
  });

  it('responsável com vínculo na Secretaria de destino não precisa de revisão; sem equipe nada a revisar', async () => {
    const c = await novoChamado({ responsavelId: seed.usuarios.multi });
    const r = (await svc.updateAbertura(c.id, { secretariaId: seed.secretarias.B }, await sessao(seed.usuarios.gestorA))) as unknown as {
      transferenciaExecucao: { revisar: Record<string, unknown> };
    };
    expect(r.transferenciaExecucao.revisar).toEqual({});
    expect((r.transferenciaExecucao as unknown as { saiuDoEscopo: boolean }).saiuDoEscopo).toBe(true); // sem equipe de A: gestor de A perde acesso
  });

  it('sem permissão de alterar → 403; Secretaria inativa → 400; outra Secretaria sem acesso ao chamado → 403', async () => {
    const c = await novoChamado();
    await expect(svc.updateAbertura(c.id, { secretariaId: seed.secretarias.B }, await sessao(seed.usuarios.gestorA, ['chamados.visualizar']))).rejects.toBeInstanceOf(ForbiddenException);
    const inativa = await prisma.secretaria.create({ data: { sigla: `T310Y${randomBytes(2).toString('hex')}`, nome: 'Secretaria Fictícia Inativa 310 B', ativo: false } });
    criados.secretarias.push(inativa.id);
    await expect(svc.updateAbertura(c.id, { secretariaId: inativa.id }, await sessao(seed.usuarios.gestorA))).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.updateAbertura(c.id, { secretariaId: seed.secretarias.B }, await sessao(seed.usuarios.gestorB))).rejects.toBeInstanceOf(ForbiddenException);
    expect((await prisma.chamado.findUniqueOrThrow({ where: { id: c.id } })).secretariaId).toBe(seed.secretarias.A);
  });

  it('sem troca de Secretaria não grava auditoria de transferência', async () => {
    const c = await novoChamado();
    const r = (await svc.updateAbertura(c.id, { secretariaId: seed.secretarias.A, solicitanteNome: 'Fictício' }, await sessao(seed.usuarios.gestorA))) as unknown as { transferenciaExecucao?: unknown };
    expect(r.transferenciaExecucao).toBeUndefined();
    expect(await prisma.logAuditoria.count({ where: { entidadeId: c.id, funcao: 'secretaria_execucao' } })).toBe(0);
  });
});
