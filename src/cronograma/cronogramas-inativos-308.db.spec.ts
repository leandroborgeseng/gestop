/**
 * 308 — integração com Postgres LOCAL descartável: Inativar/Reativar cronograma.
 * Só roda com ESCOPO_306_TEST_DATABASE_URL (mesmo seed fictício 306 + 307). Só inserções novas por execução.
 */
import { randomBytes } from 'node:crypto';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedResponsaveis307, Seed307, T307 } from '../../scripts/seed-responsaveis-307-core';
import { AuthService } from '../auth/auth.service';
import { JwtPayload } from '../auth/jwt';
import { CronogramaService } from './cronograma.service';
import { startOfDay, toDateKey } from './cronograma.rules';

const URL = process.env.ESCOPO_306_TEST_DATABASE_URL;

describe.skipIf(!URL)('308 — cronogramas inativos (Postgres local)', () => {
  let prisma: PrismaClient;
  let seed: Seed307;
  let svc: CronogramaService;
  let auth: AuthService;
  const sessao = async (usuarioId: string): Promise<JwtPayload> => {
    const s = await auth.resolveActiveSession(usuarioId);
    return { sub: usuarioId, nome: 'Fictício', email: 'x@teste306.invalid', ...s } as JwtPayload;
  };
  const novoCronograma = async (proxima: Date, frequencia: 'SEMANAL' | 'MENSAL' = 'SEMANAL') => {
    const ck = await prisma.checklist.create({ data: { nome: `Checklist Fictício 308 ${randomBytes(4).toString('hex')}` } });
    return prisma.cronogramaChecagem.create({
      data: { unidadeId: seed.unidadeA, checklistId: ck.id, frequencia, proximaChecagemEm: proxima, observacoes: T307.observacao },
    });
  };
  const hoje = startOfDay(new Date());
  const diasAtras = (n: number) => new Date(hoje.getTime() - n * 86_400_000);
  const periodo = { from: toDateKey(diasAtras(30)), to: toDateKey(new Date(hoje.getTime() + 60 * 86_400_000)) };

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL! }) });
    seed = await seedResponsaveis307(prisma, randomBytes(24).toString('base64url'), URL!);
    svc = new CronogramaService(prisma as never);
    auth = new AuthService(prisma as never, {} as never, {} as never, {} as never);
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('inativar: sai do calendário e das vistorias programadas; auditoria STATUS_CHANGE; repetir → 409', async () => {
    const c = await novoCronograma(new Date(hoje.getTime() + 3 * 86_400_000));
    const u = await sessao(seed.usuarios.gestorA);
    expect(JSON.stringify(await svc.getCalendario({ ...periodo, secretariaId: [] } as never, u))).toContain(c.id);
    const r = await svc.deactivateCronograma(c.id, u);
    expect(r.ativo).toBe(false);
    expect(JSON.stringify(await svc.getCalendario({ ...periodo, secretariaId: [] } as never, u))).not.toContain(c.id);
    expect(JSON.stringify(await svc.listVistoriasProgramadas(periodo, u))).not.toContain(c.id);
    const lista = await svc.listCronogramas(undefined, u);
    expect(lista.find((x) => x.id === c.id)?.ativo).toBe(false); // continua listado (sanfona de inativos)
    const log = await prisma.logAuditoria.findFirstOrThrow({ where: { entidadeId: c.id, acao: 'STATUS_CHANGE' } });
    expect(log.usuarioId).toBe(seed.usuarios.gestorA);
    expect(log.descricao).toBe('Cronograma inativado');
    expect((log.valorAntigo as { ativo: boolean }).ativo).toBe(true);
    expect((log.valorNovo as { ativo: boolean }).ativo).toBe(false);
    await expect(svc.deactivateCronograma(c.id, u)).rejects.toBeInstanceOf(ConflictException);
  });

  it('reativar: recalcula só a próxima data (>= hoje, no passo da frequência), sem checagens retroativas; auditoria com antes/depois', async () => {
    const antiga = diasAtras(20); // semanal: 20 dias atrás → +21 = amanhã
    const c = await novoCronograma(antiga);
    const u = await sessao(seed.usuarios.gestorA);
    await svc.deactivateCronograma(c.id, u);
    const r = await svc.reactivateCronograma(c.id, u);
    expect(r.ativo).toBe(true);
    expect(toDateKey(r.proximaChecagemEm)).toBe(toDateKey(new Date(antiga.getTime() + 21 * 86_400_000)));
    expect(r.proximaChecagemEm >= hoje).toBe(true);
    const cal = await svc.getCalendario({ ...periodo, secretariaId: [] } as never, u);
    const doCron = JSON.stringify(cal).split(c.id).length - 1;
    expect(doCron).toBeGreaterThan(0);
    const eventos = (JSON.parse(JSON.stringify(cal)).eventos ?? []) as Array<{ cronogramaId?: string; data: string; tipo: string }>;
    const deste = eventos.filter((e) => e.cronogramaId === c.id);
    expect(deste.every((e) => e.tipo !== 'ATRASADA' && e.data >= toDateKey(hoje))).toBe(true);
    const log = await prisma.logAuditoria.findFirstOrThrow({ where: { entidadeId: c.id, descricao: 'Cronograma reativado' } });
    expect((log.valorAntigo as { proximaChecagemEm: string }).proximaChecagemEm).toBe(antiga.toISOString());
    expect((log.valorNovo as { proximaChecagemEm: string }).proximaChecagemEm).toBe(r.proximaChecagemEm.toISOString());
    await expect(svc.reactivateCronograma(c.id, u)).rejects.toBeInstanceOf(ConflictException);
  });

  it('reativar com próxima data futura mantém a data', async () => {
    const futura = new Date(hoje.getTime() + 10 * 86_400_000);
    const c = await novoCronograma(futura, 'MENSAL');
    const u = await sessao(seed.usuarios.gestorA);
    await svc.deactivateCronograma(c.id, u);
    const r = await svc.reactivateCronograma(c.id, u);
    expect(r.proximaChecagemEm.toISOString()).toBe(futura.toISOString());
  });

  it('Secretaria: gestor de B não inativa nem reativa cronograma de A', async () => {
    const c = await novoCronograma(new Date(hoje.getTime() + 5 * 86_400_000));
    const b = await sessao(seed.usuarios.gestorB);
    const erro = await svc.deactivateCronograma(c.id, b).catch((e) => e);
    expect(erro instanceof NotFoundException || erro instanceof ForbiddenException).toBe(true);
    await svc.deactivateCronograma(c.id, await sessao(seed.usuarios.gestorA));
    const erro2 = await svc.reactivateCronograma(c.id, b).catch((e) => e);
    expect(erro2 instanceof NotFoundException || erro2 instanceof ForbiddenException).toBe(true);
    expect((await prisma.cronogramaChecagem.findUniqueOrThrow({ where: { id: c.id } })).ativo).toBe(false);
  });

  it('editar não reativa: PUT com ativo=true num inativo mantém inativo', async () => {
    const c = await novoCronograma(new Date(hoje.getTime() + 5 * 86_400_000));
    const u = await sessao(seed.usuarios.gestorA);
    await svc.deactivateCronograma(c.id, u);
    const r = await svc.updateCronograma(
      c.id,
      { unidadeId: c.unidadeId, checklistId: c.checklistId, frequencia: 'SEMANAL', proximaChecagemEm: toDateKey(diasAtras(40)), ativo: true, responsavelIds: [] },
      u,
    );
    expect(r.ativo).toBe(false);
  });
});
