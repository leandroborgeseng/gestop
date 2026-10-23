/**
 * 307 — integração com Postgres LOCAL descartável: responsáveis do cronograma no escopo da sessão.
 * Só roda com ESCOPO_306_TEST_DATABASE_URL (banco local migrado; antes: npx prisma generate).
 * Usa o seed fictício 306 + 307 (mesma trava de banco local/NODE_ENV). Senha aleatória por execução.
 * Conta só registros do seed (e-mails @teste306.invalid), para passar em banco já usado.
 */
import { randomBytes } from 'node:crypto';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedResponsaveis307, Seed307, T307 } from '../../scripts/seed-responsaveis-307-core';
import { AuthService } from '../auth/auth.service';
import { JwtPayload } from '../auth/jwt';
import { CronogramaService } from './cronograma.service';

const URL = process.env.ESCOPO_306_TEST_DATABASE_URL;
const doSeed = (u: { email: string }) => u.email.endsWith(T307.dominio);

describe.skipIf(!URL)('307 — responsáveis do cronograma no escopo (Postgres local)', () => {
  let prisma: PrismaClient;
  let seed: Seed307;
  let svc: CronogramaService;
  let auth: AuthService;
  let cronogramaId: string;
  let checklistId: string;
  const sessao = async (usuarioId: string): Promise<JwtPayload> => {
    const s = await auth.resolveActiveSession(usuarioId);
    return { sub: usuarioId, nome: 'Fictício', email: 'x@teste306.invalid', ...s } as JwtPayload;
  };
  const dtoA = (responsavelIds: string[]) => ({
    unidadeId: seed.unidadeA,
    checklistId,
    frequencia: 'MENSAL' as const,
    proximaChecagemEm: '2026-12-01',
    responsavelIds,
    observacoes: T307.observacao,
  });

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL! }) });
    seed = await seedResponsaveis307(prisma, randomBytes(24).toString('base64url'), URL!);
    svc = new CronogramaService(prisma as never);
    auth = new AuthService(prisma as never, {} as never, {} as never, {} as never);
    // Cronograma fictício NOVO por execução (só inserções, nada é apagado): gestor A, inativo e gestor B.
    const sufixo = randomBytes(4).toString('hex');
    const checklist = await prisma.checklist.create({ data: { nome: `Checklist Fictício 307 ${sufixo}` } });
    const cron = await prisma.cronogramaChecagem.create({
      data: {
        unidadeId: seed.unidadeA,
        checklistId: checklist.id,
        frequencia: 'MENSAL',
        proximaChecagemEm: new Date(Date.UTC(2026, 11, 1)),
        observacoes: T307.observacao,
        responsaveis: { create: [seed.usuarios.gestorA, seed.inativo, seed.usuarios.gestorB].map((usuarioId) => ({ usuarioId })) },
      },
    });
    cronogramaId = cron.id;
    checklistId = checklist.id;
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('R3: Secretaria ativa A → só usuários ativos com principal ou vínculo em A (inclui multi A+B; nunca B nem inativo)', async () => {
    const u = await sessao(seed.usuarios.gestorA);
    const ids = (await svc.listResponsaveisOpcoes(u)).filter(doSeed).map((x) => x.id);
    expect(ids).toContain(seed.usuarios.gestorA);
    expect(ids).toContain(seed.usuarios.multi);
    expect(ids).not.toContain(seed.usuarios.gestorB);
    expect(ids).not.toContain(seed.inativo);
    expect(ids).toEqual(expect.arrayContaining(seed.extrasA));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('R3: Secretaria ativa B → gestor B e multi; nada de A-only', async () => {
    const u = await sessao(seed.usuarios.gestorB);
    const ids = (await svc.listResponsaveisOpcoes(u)).filter(doSeed).map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining([seed.usuarios.gestorB, seed.usuarios.multi]));
    expect(ids).not.toContain(seed.usuarios.gestorA);
    expect(ids.some((id) => seed.extrasA.includes(id))).toBe(false);
  });

  it('R3: "Todas" (admin) → A e B, multi aparece UMA vez com as 2 Secretarias; "Todas" de não-admin = só vínculos', async () => {
    const admin = await sessao(seed.usuarios.admin);
    const rows = (await svc.listResponsaveisOpcoes(admin)).filter(doSeed);
    const multi = rows.filter((r) => r.id === seed.usuarios.multi);
    expect(multi).toHaveLength(1);
    expect(multi[0].secretarias.map((s) => s.id).sort()).toEqual([seed.secretarias.A, seed.secretarias.B].sort());
    expect(rows.map((r) => r.id)).toEqual(expect.arrayContaining([seed.usuarios.gestorA, seed.usuarios.gestorB]));

    // Usuário sem "todas": em "Todas" o escopo são os vínculos (aqui só A) — B não aparece.
    const gA = await sessao(seed.usuarios.gestorA);
    const todasDeA = { ...gA, secretariaId: undefined, secretariasIds: [seed.secretarias.A] } as JwtPayload;
    const idsA = (await svc.listResponsaveisOpcoes(todasDeA)).filter(doSeed).map((x) => x.id);
    expect(idsA).not.toContain(seed.usuarios.gestorB);
  });

  it('R4: situação no escopo de A → gestor A OK, inativo INATIVO, gestor B OUTRA_SECRETARIA (sem expor Secretarias de B)', async () => {
    const u = await sessao(seed.usuarios.gestorA);
    const sit = await svc.situacaoResponsaveis(u, [seed.usuarios.gestorA, seed.inativo, seed.usuarios.gestorB]);
    const por = Object.fromEntries(sit.map((s) => [s.id, s]));
    expect(por[seed.usuarios.gestorA].situacao).toBe('OK');
    expect(por[seed.inativo].situacao).toBe('INATIVO');
    expect(por[seed.usuarios.gestorB].situacao).toBe('OUTRA_SECRETARIA');
    expect(por[seed.usuarios.gestorB].secretarias).toEqual([]);
    expect(por[seed.usuarios.gestorB].secretaria).toBeNull();
  });

  it('R4: editar mantendo inativo e de outra Secretaria salva sem perder ninguém', async () => {
    const u = await sessao(seed.usuarios.gestorA);
    const ids = [seed.usuarios.gestorA, seed.inativo, seed.usuarios.gestorB];
    const r = await svc.updateCronograma(cronogramaId, dtoA(ids), u);
    expect(r.responsaveis.map((x) => x.usuarioId).sort()).toEqual([...ids].sort());
  });

  it('R4/R5: adicionar NOVO responsável de outra Secretaria → 403; NOVO inativo → 400; remover funciona', async () => {
    const u = await sessao(seed.usuarios.gestorA);
    const base = [seed.usuarios.gestorA];
    await svc.updateCronograma(cronogramaId, dtoA(base), u); // regulariza (remove inativo e B)
    await expect(svc.updateCronograma(cronogramaId, dtoA([...base, seed.usuarios.gestorB]), u)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.updateCronograma(cronogramaId, dtoA([...base, seed.inativo]), u)).rejects.toBeInstanceOf(BadRequestException);
    const ok = await svc.updateCronograma(cronogramaId, dtoA([...base, seed.usuarios.multi, seed.extrasA[0]]), u);
    expect(ok.responsaveis).toHaveLength(3);
  });

  it('R5: depois da troca para B (multi), os de A-only viram OUTRA_SECRETARIA; multi continua OK', async () => {
    const m = await sessao(seed.usuarios.multi);
    const emB = { ...m, secretariaId: seed.secretarias.B } as JwtPayload;
    const sit = await svc.situacaoResponsaveis(emB, [seed.usuarios.gestorA, seed.usuarios.multi]);
    const por = Object.fromEntries(sit.map((s) => [s.id, s.situacao]));
    expect(por[seed.usuarios.gestorA]).toBe('OUTRA_SECRETARIA');
    expect(por[seed.usuarios.multi]).toBe('OK');
  });

  it('ajuste 1 (a/d): confirmar "manter destacados" grava auditoria com quem, quando, ids mantidos, cronograma e Secretaria ativa', async () => {
    const u = await sessao(seed.usuarios.gestorA);
    const ids = [seed.usuarios.gestorA, seed.inativo, seed.usuarios.gestorB];
    await svc.updateCronograma(cronogramaId, dtoA([seed.usuarios.gestorA]), u);
    // repõe o estado com os destacados (inserção direta: o serviço não aceita NOVOS fora do escopo)
    await prisma.cronogramaChecagemResponsavel.createMany({ data: [seed.inativo, seed.usuarios.gestorB].map((usuarioId) => ({ cronogramaId, usuarioId })) });
    const antes = new Date(Date.now() - 1000);
    await svc.updateCronograma(cronogramaId, { ...dtoA(ids), confirmarResponsaveisForaEscopo: true }, u);
    const logs = await prisma.logAuditoria.findMany({ where: { entidadeId: cronogramaId, funcao: 'responsaveis.manter_fora_escopo' } });
    expect(logs).toHaveLength(1);
    const v = logs[0].valorNovo as Record<string, unknown>;
    expect(logs[0].usuarioId).toBe(seed.usuarios.gestorA);
    expect(logs[0].secretariaAtivaId).toBe(seed.secretarias.A);
    expect(v.cronogramaId).toBe(cronogramaId);
    expect(v.confirmadoPor).toBe(seed.usuarios.gestorA);
    expect(v.secretariaAtivaId).toBe(seed.secretarias.A);
    expect(new Date(String(v.confirmadoEm)).getTime()).toBeGreaterThanOrEqual(antes.getTime());
    expect([...(v.responsavelIdsMantidos as string[])].sort()).toEqual([seed.inativo, seed.usuarios.gestorB].sort());
  });

  it('ajuste 1 (a): sem confirmação, ou sem destacados, não grava o registro de "manter"', async () => {
    const u = await sessao(seed.usuarios.gestorA);
    const antes = await prisma.logAuditoria.count({ where: { entidadeId: cronogramaId, funcao: 'responsaveis.manter_fora_escopo' } });
    await svc.updateCronograma(cronogramaId, dtoA([seed.usuarios.gestorA, seed.inativo, seed.usuarios.gestorB]), u);
    await svc.updateCronograma(cronogramaId, { ...dtoA([seed.usuarios.gestorA]), confirmarResponsaveisForaEscopo: true }, u);
    expect(await prisma.logAuditoria.count({ where: { entidadeId: cronogramaId, funcao: 'responsaveis.manter_fora_escopo' } })).toBe(antes);
  });

  it('ajuste 1 (b): lista e calendário leem secretariaId como array; qualquer id fora do escopo → 403', async () => {
    const u = await sessao(seed.usuarios.gestorA);
    const per = { from: '2026-12-01', to: '2026-12-31' };
    for (const forma of [[seed.secretarias.B], [seed.secretarias.A, seed.secretarias.B]]) {
      await expect(svc.listCronogramas({ secretariaId: forma }, u)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(svc.getCalendario({ ...per, secretariaId: forma }, u)).rejects.toBeInstanceOf(ForbiddenException);
    }
    const lista = await svc.listCronogramas({ secretariaId: [seed.secretarias.A, seed.secretarias.A] }, u);
    expect(lista.every((c) => c.unidade.secretariaId === seed.secretarias.A)).toBe(true);
    expect(lista.some((c) => c.id === cronogramaId)).toBe(true);
    const admin = await sessao(seed.usuarios.admin);
    const ambos = await svc.listCronogramas({ secretariaId: [seed.secretarias.A, seed.secretarias.B] }, admin);
    expect(ambos.every((c) => [seed.secretarias.A, seed.secretarias.B].includes(c.unidade.secretariaId))).toBe(true);
    const cal = await svc.getCalendario({ ...per, secretariaId: [seed.secretarias.A] }, u);
    expect(cal.eventos.every((e) => e.unidade.secretariaSigla === "T306A")).toBe(true);
  });
});
