/**
 * 303/304 — integração com Postgres LOCAL descartável (ESCOPO_306_TEST_DATABASE_URL): pacote offline e sync das programadas.
 * Seed fictício 306+307+304 (mesma trava de banco local). Só inserções/atualizações de dados fictícios.
 */
import { randomBytes } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedCampo304, Seed304 } from '../../scripts/seed-campo-304-core';
import { AuthService } from '../auth/auth.service';
import { JwtPayload } from '../auth/jwt';
import { CronogramaService } from '../cronograma/cronograma.service';
import { startOfDay, toDateKey } from '../cronograma/cronograma.rules';
import { MobileSyncFiscalizacaoDto } from './mobile.dto';
import { MobileService } from './mobile.service';

const URL = process.env.ESCOPO_306_TEST_DATABASE_URL;

describe.skipIf(!URL)('303/304 — pacote offline e sync das programadas (Postgres local)', () => {
  let prisma: PrismaClient;
  let seed: Seed304;
  let cronograma: CronogramaService;
  let auth: AuthService;
  let svc: MobileService;
  const sessao = async (usuarioId: string): Promise<JwtPayload> => {
    const s = await auth.resolveActiveSession(usuarioId);
    return { sub: usuarioId, nome: 'Fictício', email: 'x@teste306.invalid', ...s } as JwtPayload;
  };
  const hoje = () => startOfDay(new Date());
  // Programação atrasada (7 dias): não some da lista por causa de vistorias fictícias de hoje.
  const programada = () => new Date(hoje().getTime() - 7 * 86_400_000);
  const dto = (over: Partial<MobileSyncFiscalizacaoDto> = {}): MobileSyncFiscalizacaoDto => {
    const fim = new Date();
    return {
      clientEventId: `t304-${randomBytes(6).toString('hex')}`,
      deviceId: 'device-ficticio-304',
      unidadeId: seed.unidade304A,
      checklistVersaoId: seed.checklistVersao304,
      iniciadaEm: new Date(fim.getTime() - 10 * 60_000).toISOString(),
      concluidaEm: fim.toISOString(),
      checkin: { latitude: -20.5, longitude: -47.4, precisaoMetros: 12 },
      respostas: seed.itens304.map((itemId) => ({ itemId, conformidade: 'CONFORME' as const, valorBooleano: true, evidencias: [] })),
      cronogramaId: seed.cronograma304A,
      dataProgramada: toDateKey(programada()),
      ...over,
    } as MobileSyncFiscalizacaoDto;
  };
  const novoSvc = (cron: CronogramaService) =>
    new MobileService(
      prisma as never,
      { generateForNaoConformidadeTx: async () => undefined } as never,
      { persistEvidenceUrl: async () => ({}), deleteStoredObjects: async () => undefined } as never,
      cron,
      { upsertFromFiscalizacao: async () => undefined } as never,
      { exportPdf: async () => { throw new Error('sem pdf no teste'); } } as never,
      auth,
    );

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL! }) });
    seed = await seedCampo304(prisma, randomBytes(24).toString('base64url'), URL!);
    cronograma = new CronogramaService(prisma as never);
    auth = new AuthService(prisma as never, {} as never, {} as never, {} as never);
    svc = novoSvc(cronograma);
  });
  beforeEach(async () => {
    // Programação fictícia 304 A: próxima = hoje, sem baixa (dados fictícios; só UPDATE).
    await prisma.cronogramaChecagem.update({ where: { id: seed.cronograma304A }, data: { ativo: true, frequencia: 'SEMANAL', proximaChecagemEm: programada(), ultimaChecagemEm: null } });
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('O1/O9/G2a: pacote leva programações (ids, vínculos, checklist+versão, responsáveis), contador, validade de 7 dias e limite de precisão', async () => {
    const pkg = await svc.getFieldPackage(await sessao(seed.usuarios304.gestorA));
    const p = pkg.programacoes.find((x) => x.cronogramaId === seed.cronograma304A && x.data === toDateKey(programada()));
    expect(p).toBeTruthy();
    expect(p!.unidade.id).toBe(seed.unidade304A);
    expect(p!.checklistVersao?.id).toBe(seed.checklistVersao304);
    expect(p!.responsaveis.map((r) => r.id)).toContain(seed.usuarios304.gestorA);
    expect(p!.cronogramaAtualizadoEm).toBeTruthy();
    expect(pkg.contadores.programacoes).toBe(pkg.programacoes.length);
    expect(pkg.programacoes.every((x) => x.unidade.secretaria.sigla !== 'T304B')).toBe(true);
    expect(new Date(pkg.validoAte).getTime() - new Date(pkg.downloadedAt).getTime()).toBe(7 * 86_400_000);
    expect(pkg.config.precisaoMaxCheckinMetros).toBe(50);
  });

  it('O4/O5/O7/G3a: sync de programada grava vistoria vinculada, dá baixa e a recorrência segue; início ≠ fim', async () => {
    const d = dto();
    const r = await svc.syncFiscalizacao(d, await sessao(seed.usuarios304.gestorA));
    expect(r.status).toBe('sincronizado');
    expect(r.reenvio).toBe(false);
    expect(r.programacao?.baixada).toBe(true);
    const f = await prisma.fiscalizacao.findUniqueOrThrow({ where: { id: r.fiscalizacaoId } });
    expect(f.cronogramaId).toBe(seed.cronograma304A);
    expect(f.iniciadaEm?.toISOString()).toBe(d.iniciadaEm);
    expect(f.concluidaEm?.toISOString()).toBe(d.concluidaEm);
    expect(f.iniciadaEm!.getTime()).toBeLessThan(f.concluidaEm!.getTime());
    const c = await prisma.cronogramaChecagem.findUniqueOrThrow({ where: { id: seed.cronograma304A } });
    expect(c.ultimaChecagemEm?.getTime()).toBe(hoje().getTime());
    expect(c.proximaChecagemEm.getTime()).toBe(hoje().getTime() + 7 * 86_400_000);
  });

  it('O5b: reenvio da mesma vistoria → sucesso, mesmo id, programação baixada, sem duplicar', async () => {
    const d = dto();
    const u = await sessao(seed.usuarios304.gestorA);
    const r1 = await svc.syncFiscalizacao(d, u);
    const r2 = await svc.syncFiscalizacao(d, u);
    const [r3, r4] = await Promise.all([svc.syncFiscalizacao(d, u), svc.syncFiscalizacao(d, u)]);
    for (const r of [r2, r3, r4]) {
      expect(r).toMatchObject({ status: 'sincronizado', reenvio: true, fiscalizacaoId: r1.fiscalizacaoId, programacao: { baixada: true } });
    }
    expect(await prisma.fiscalizacao.count({ where: { clientId: d.clientEventId } })).toBe(1);
  });

  it('O5b: vistoria antiga gravada sem a baixa (antes deste PR) → o reenvio aplica a baixa', async () => {
    const d = dto();
    const u = await sessao(seed.usuarios304.gestorA);
    const f = await prisma.fiscalizacao.create({
      data: {
        clientId: d.clientEventId, secretariaId: seed.secretarias304.A, unidadeId: seed.unidade304A, checklistVersaoId: seed.checklistVersao304,
        agenteId: seed.usuarios304.gestorA, status: 'CONCLUIDA', origem: 'OFFLINE', iniciadaEm: new Date(d.iniciadaEm), concluidaEm: new Date(d.concluidaEm),
        cronogramaId: seed.cronograma304A, dataProgramada: programada(),
      },
    });
    const r = await svc.syncFiscalizacao(d, u);
    expect(r).toMatchObject({ status: 'sincronizado', reenvio: true, fiscalizacaoId: f.id, programacao: { baixada: true } });
    const c = await prisma.cronogramaChecagem.findUniqueOrThrow({ where: { id: seed.cronograma304A } });
    expect(c.ultimaChecagemEm?.getTime()).toBe(hoje().getTime());
  });

  it('O5a: se a baixa falha, a vistoria também não é gravada (mesma transação)', async () => {
    const quebrado = Object.create(cronograma) as CronogramaService;
    quebrado.registrarChecagemRealizadaTx = async () => {
      throw new Error('falha simulada na baixa');
    };
    const d = dto();
    await expect(novoSvc(quebrado).syncFiscalizacao(d, await sessao(seed.usuarios304.gestorA))).rejects.toThrow('falha simulada na baixa');
    expect(await prisma.fiscalizacao.count({ where: { clientId: d.clientEventId } })).toBe(0);
    const c = await prisma.cronogramaChecagem.findUniqueOrThrow({ where: { id: seed.cronograma304A } });
    expect(c.ultimaChecagemEm).toBeNull();
  });

  it('O10: próprio fora das Secretarias do usuário → 403, evento fica registrado com o erro e nada é gravado', async () => {
    const d = dto();
    await expect(svc.syncFiscalizacao(d, await sessao(seed.usuarios304.gestorB))).rejects.toBeInstanceOf(ForbiddenException);
    expect(await prisma.fiscalizacao.count({ where: { clientId: d.clientEventId } })).toBe(0);
    const ev = await prisma.offlineSyncEvent.findUniqueOrThrow({ where: { clientEventId: d.clientEventId } });
    expect(ev.status).toBe('CONFLITO');
    expect(ev.conflitoMotivo).toContain('não pertence a uma Secretaria do seu acesso');
    // o mesmo item, enviado depois por quem tem acesso, passa (fila não perde nada)
    const ok = await svc.syncFiscalizacao(d, await sessao(seed.usuarios304.gestorA));
    expect(ok.status).toBe('sincronizado');
    expect((await prisma.offlineSyncEvent.findUniqueOrThrow({ where: { clientEventId: d.clientEventId } })).status).toBe('SINCRONIZADO');
  });

  it('O6: programação já baixada no servidor por outra vistoria → 409 com código; nada é sobrescrito', async () => {
    const u = await sessao(seed.usuarios304.gestorA);
    await svc.syncFiscalizacao(dto(), u);
    const antes = await prisma.cronogramaChecagem.findUniqueOrThrow({ where: { id: seed.cronograma304A } });
    const d2 = dto();
    const erro = await svc.syncFiscalizacao(d2, u).catch((e) => e);
    expect(erro).toBeInstanceOf(ConflictException);
    expect((erro as ConflictException).getResponse()).toMatchObject({ codigo: 'PROGRAMACAO_JA_BAIXADA', conflito: true });
    expect(await prisma.fiscalizacao.count({ where: { clientId: d2.clientEventId } })).toBe(0);
    const depois = await prisma.cronogramaChecagem.findUniqueOrThrow({ where: { id: seed.cronograma304A } });
    expect(depois.updatedAt.getTime()).toBe(antes.updatedAt.getTime());
  });

  it('O6: programação alterada depois do download (data fora da nova recorrência) → 409 PROGRAMACAO_ALTERADA', async () => {
    const baixadoEm = new Date(Date.now() - 60_000).toISOString();
    await prisma.cronogramaChecagem.update({ where: { id: seed.cronograma304A }, data: { frequencia: 'MENSAL', proximaChecagemEm: new Date(hoje().getTime() + 3 * 86_400_000) } });
    const erro = await svc.syncFiscalizacao(dto({ programacaoAtualizadaEm: baixadoEm }), await sessao(seed.usuarios304.gestorA)).catch((e) => e);
    expect((erro as ConflictException).getResponse()).toMatchObject({ codigo: 'PROGRAMACAO_ALTERADA' });
  });

  it('G3a: início (check-in) depois do fim → 400', async () => {
    const fim = new Date();
    await expect(
      svc.syncFiscalizacao(dto({ iniciadaEm: new Date(fim.getTime() + 60_000).toISOString(), concluidaEm: fim.toISOString() }), await sessao(seed.usuarios304.gestorA)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('O8: avulsa (sem cronogramaId) continua funcionando e dá baixa pela chave próprio+checklist', async () => {
    const r = await svc.syncFiscalizacao(dto({ cronogramaId: undefined, dataProgramada: undefined }), await sessao(seed.usuarios304.gestorA));
    expect(r.status).toBe('sincronizado');
    const c = await prisma.cronogramaChecagem.findUniqueOrThrow({ where: { id: seed.cronograma304A } });
    expect(c.ultimaChecagemEm?.getTime()).toBe(hoje().getTime());
  });
});
