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
import { FiscalizacoesService } from '../fiscalizacoes/fiscalizacoes.service';
import { MonitoramentoService } from '../monitoramento/monitoramento.service';
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

  it('M-1: reenvio de uma vistoria já gravada, feito por quem está fora do escopo → 403 (igual ao O10); nada muda', async () => {
    const d = dto();
    const ok = await svc.syncFiscalizacao(d, await sessao(seed.usuarios304.gestorA));
    const erro = await svc.syncFiscalizacao(d, await sessao(seed.usuarios304.gestorB)).catch((e) => e);
    expect(erro).toBeInstanceOf(ForbiddenException);
    expect((erro as ForbiddenException).message).toContain('não pertence a uma Secretaria do seu acesso');
    expect(await prisma.fiscalizacao.count({ where: { clientId: d.clientEventId } })).toBe(1);
    expect((await prisma.offlineSyncEvent.findUniqueOrThrow({ where: { clientEventId: d.clientEventId } })).status).toBe('SINCRONIZADO');
    // o próprio autor continua recebendo o reenvio normal
    expect(await svc.syncFiscalizacao(d, await sessao(seed.usuarios304.gestorA))).toMatchObject({ reenvio: true, fiscalizacaoId: ok.fiscalizacaoId });
  });

  describe('O6a: "Enviar como avulsa" após conflito', () => {
    // Conflito PROGRAMACAO_ALTERADA: o app baixou uma data que não existe mais; a programação real (atrasada) continua pendente.
    const conflitar = async (u: JwtPayload) => {
      const diaBaixado = toDateKey(new Date(programada().getTime() - 86_400_000));
      const d = dto({ dataProgramada: diaBaixado, programacaoAtualizadaEm: new Date(Date.now() - 3_600_000).toISOString() });
      await prisma.cronogramaChecagem.update({ where: { id: seed.cronograma304A }, data: { observacoes: 'Cronograma fictício 304 A' } });
      const erro = await svc.syncFiscalizacao(d, u).catch((e) => e);
      expect((erro as ConflictException).getResponse()).toMatchObject({ codigo: 'PROGRAMACAO_ALTERADA' });
      return { d, diaBaixado };
    };
    const comoAvulsa = (d: MobileSyncFiscalizacaoDto, diaBaixado: string, motivo = 'Programação mudou; vistoria feita no local') =>
      ({
        ...d,
        cronogramaId: undefined,
        dataProgramada: undefined,
        programacaoAtualizadaEm: undefined,
        avulsaPorConflito: { motivo, cronogramaId: seed.cronograma304A, dataProgramada: diaBaixado, codigo: 'PROGRAMACAO_ALTERADA' },
      }) as MobileSyncFiscalizacaoDto;

    it('grava como avulsa por conflito com a referência, NÃO baixa a programação, audita e sinaliza para o gestor', async () => {
      const u = await sessao(seed.usuarios304.gestorA);
      const { d, diaBaixado } = await conflitar(u);
      const antes = await prisma.cronogramaChecagem.findUniqueOrThrow({ where: { id: seed.cronograma304A } });
      const r = await svc.syncFiscalizacao(comoAvulsa(d, diaBaixado), u);
      expect(r).toMatchObject({ status: 'sincronizado', avulsaPorConflito: true, programacao: null });

      const f = await prisma.fiscalizacao.findUniqueOrThrow({ where: { id: r.fiscalizacaoId } });
      expect(f).toMatchObject({ avulsaPorConflito: true, cronogramaId: null, dataProgramada: null, conflitoCronogramaId: seed.cronograma304A, conflitoCodigo: 'PROGRAMACAO_ALTERADA' });
      expect(f.avulsaMotivo).toBe('Programação mudou; vistoria feita no local');
      expect(toDateKey(startOfDay(f.conflitoDataProgramada!))).toBe(diaBaixado);

      const depois = await prisma.cronogramaChecagem.findUniqueOrThrow({ where: { id: seed.cronograma304A } });
      expect(depois.ultimaChecagemEm).toBeNull();
      expect(depois.proximaChecagemEm.getTime()).toBe(antes.proximaChecagemEm.getTime());

      const logs = await prisma.logAuditoria.findMany({ where: { entidadeTipo: 'Fiscalizacao', entidadeId: f.id, acao: 'CREATE' } });
      expect(logs).toHaveLength(1);
      expect(logs[0].usuarioId).toBe(seed.usuarios304.gestorA);
      expect(logs[0].createdAt.getTime()).toBeGreaterThan(Date.now() - 60_000);
      expect(logs[0].valorNovo).toMatchObject({ evento: 'AVULSA_POR_CONFLITO', motivo: 'Programação mudou; vistoria feita no local', cronogramaId: seed.cronograma304A, dataProgramada: diaBaixado, enviadoPorId: seed.usuarios304.gestorA });
      expect(logs[0].descricao).toContain('Programação mudou');

      // programação continua na lista (atrasada) e sinalizada, no pacote e na API das programadas
      const pkg = await svc.getFieldPackage(u);
      // B-3: exatamente 1 card (o da data que conflitou) com a sinalização desta avulsa
      const sinalizados = pkg.programacoes.filter((x) => x.conflitoAvulsa?.fiscalizacaoId === f.id);
      expect(sinalizados).toHaveLength(1);
      expect(sinalizados[0]).toMatchObject({ cronogramaId: seed.cronograma304A, data: diaBaixado });
      expect(sinalizados[0].conflitoAvulsa).toMatchObject({ motivo: 'Programação mudou; vistoria feita no local', codigo: 'PROGRAMACAO_ALTERADA', dataProgramada: diaBaixado });
      // a programação atrasada "real" continua na lista, pendente, sem a sinalização desta avulsa
      const real = pkg.programacoes.find((x) => x.cronogramaId === seed.cronograma304A && x.data === toDateKey(programada()));
      expect(real).toBeTruthy();
      expect(real!.conflitoAvulsa?.fiscalizacaoId).not.toBe(f.id);

      // reenvio da mesma avulsa: mesmo id, sem duplicar fiscalização nem auditoria
      const r2 = await svc.syncFiscalizacao(comoAvulsa(d, diaBaixado), u);
      expect(r2).toMatchObject({ reenvio: true, fiscalizacaoId: f.id });
      expect(await prisma.fiscalizacao.count({ where: { clientId: d.clientEventId } })).toBe(1);
      expect(await prisma.logAuditoria.count({ where: { entidadeTipo: 'Fiscalizacao', entidadeId: f.id, acao: 'CREATE' } })).toBe(1);
      expect((await prisma.cronogramaChecagem.findUniqueOrThrow({ where: { id: seed.cronograma304A } })).ultimaChecagemEm).toBeNull();
    });

    it('a sinalização sai quando a programação recebe uma baixa real depois da avulsa', async () => {
      const u = await sessao(seed.usuarios304.gestorA);
      const { d, diaBaixado } = await conflitar(u);
      await svc.syncFiscalizacao(comoAvulsa(d, diaBaixado), u);
      await svc.syncFiscalizacao(dto(), u); // vistoria programada normal → baixa
      const pkg = await svc.getFieldPackage(u);
      expect(pkg.programacoes.filter((x) => x.cronogramaId === seed.cronograma304A).every((x) => !x.conflitoAvulsa)).toBe(true);
    });

    it('motivo é obrigatório; não pode vir com cronogramaId; programação de outro próprio é recusada (nada gravado)', async () => {
      const u = await sessao(seed.usuarios304.gestorA);
      const { d, diaBaixado } = await conflitar(u);
      await expect(svc.syncFiscalizacao(comoAvulsa(d, diaBaixado, '   '), u)).rejects.toBeInstanceOf(BadRequestException);
      await expect(svc.syncFiscalizacao({ ...comoAvulsa(d, diaBaixado), cronogramaId: seed.cronograma304A }, u)).rejects.toBeInstanceOf(BadRequestException);
      const outro = { ...comoAvulsa(d, diaBaixado), avulsaPorConflito: { motivo: 'motivo qualquer', cronogramaId: seed.cronograma304B, dataProgramada: diaBaixado } };
      await expect(svc.syncFiscalizacao(outro as MobileSyncFiscalizacaoDto, u)).rejects.toBeInstanceOf(BadRequestException);
      expect(await prisma.fiscalizacao.count({ where: { clientId: d.clientEventId } })).toBe(0);
    });

    it('gestor filtra as avulsas por conflito na API de vistorias (true/false)', async () => {
      const u = await sessao(seed.usuarios304.gestorA);
      const { d, diaBaixado } = await conflitar(u);
      const r = await svc.syncFiscalizacao(comoAvulsa(d, diaBaixado), u);
      const normal = await svc.syncFiscalizacao(dto({ cronogramaId: undefined, dataProgramada: undefined }), u);
      const fisc = new FiscalizacoesService(prisma as never, {} as never, {} as never, cronograma, {} as never);
      const so = await fisc.list({ avulsaPorConflito: 'true', limit: 100 }, u);
      expect(so.items.map((i) => i.id)).toContain(r.fiscalizacaoId);
      expect(so.items.every((i) => i.avulsaPorConflito)).toBe(true);
      const sem = await fisc.list({ avulsaPorConflito: 'false', limit: 100 }, u);
      expect(sem.items.map((i) => i.id)).toContain(normal.fiscalizacaoId);
      expect(sem.items.map((i) => i.id)).not.toContain(r.fiscalizacaoId);
    });

    it('indicadores: conflito + avulsa contam UMA vistoria e nenhuma falha de sync pendente (sem contagem dupla)', async () => {
      const u = await sessao(seed.usuarios304.gestorA);
      const mon = new MonitoramentoService(prisma as never);
      const antes = (await mon.getDashboard({}, u)).indicadores;
      const { d, diaBaixado } = await conflitar(u);
      const meio = (await mon.getDashboard({}, u)).indicadores;
      expect(meio.fiscalizacoes).toBe(antes.fiscalizacoes);
      expect(meio.syncPendentes).toBe(antes.syncPendentes + 1);
      await svc.syncFiscalizacao(comoAvulsa(d, diaBaixado), u);
      await svc.syncFiscalizacao(comoAvulsa(d, diaBaixado), u); // reenvio
      const depois = (await mon.getDashboard({}, u)).indicadores;
      expect(depois.fiscalizacoes).toBe(antes.fiscalizacoes + 1);
      expect(depois.syncPendentes).toBe(antes.syncPendentes);
    });
  });
});
