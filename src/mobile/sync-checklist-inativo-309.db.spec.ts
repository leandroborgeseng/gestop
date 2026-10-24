/**
 * 309/C4a/C6a — sync offline de vistoria contra checklist inativo (Postgres LOCAL descartável).
 * Compara o check-in do aparelho (`iniciadaEm`) com `Checklist.inativadoEm`.
 * Fronteira: aceita só check-in < inativadoEm; IGUAL é recusado (409).
 * Só roda com ESCOPO_306_TEST_DATABASE_URL. Só inserções; checklists novos por execução.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ConflictException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedChecklists309, Seed309 } from '../../scripts/seed-checklists-309-core';
import { AuthService } from '../auth/auth.service';
import { JwtPayload } from '../auth/jwt';
import { ChecklistsService } from '../checklists/checklists.service';
import { formatarDataHoraBr } from '../common/inativos/registro-inativo';
import { CronogramaService } from '../cronograma/cronograma.service';
import { MobileService } from './mobile.service';

const URL = process.env.ESCOPO_306_TEST_DATABASE_URL;
const H = 3_600_000;

describe.skipIf(!URL)('309/C4a — sync offline contra checklist inativo (Postgres local)', () => {
  let prisma: PrismaClient;
  let seed: Seed309;
  let checklists: ChecklistsService;
  let mobile: MobileService;
  let gestor: JwtPayload;
  let todas: JwtPayload;
  let secretariaS: string;
  let unidadeS: string;
  const sufixo = randomBytes(4).toString('hex');
  let n = 0;

  const novoChecklist = async () => {
    const c = await prisma.checklist.create({
      data: {
        nome: `Checklist Fictício 309 Sync ${sufixo} ${++n}`,
        escopo: 'SECRETARIA',
        secretariaId: secretariaS,
        versoes: { create: { versao: 1, status: 'PUBLICADA', itens: { create: [{ ordem: 1, codigo: 'T309-S1', titulo: 'Item fictício', tipo: 'BOOLEANO' }] } } },
      },
      include: { versoes: { include: { itens: true } } },
    });
    return { id: c.id, versao: c.versoes[0].id, item: c.versoes[0].itens[0].id };
  };
  const payload = (versaoId: string, itemId: string, checkin: Date) => ({
    clientEventId: `t309-sync-${sufixo}-${++n}`,
    deviceId: 'aparelho-ficticio-309',
    unidadeId: unidadeS,
    checklistVersaoId: versaoId,
    iniciadaEm: checkin.toISOString(),
    concluidaEm: new Date(checkin.getTime() + 10 * 60_000).toISOString(),
    checkin: { latitude: -20.5, longitude: -47.4, precisaoMetros: 5 },
    respostas: [{ itemId, conformidade: 'CONFORME', valorBooleano: true, evidencias: [] }],
  });
  const inativado = async (id: string) => {
    await checklists.deactivateChecklist(id, todas);
    return (await prisma.checklist.findUniqueOrThrow({ where: { id } })).inativadoEm!;
  };

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL! }) });
    seed = await seedChecklists309(prisma, randomBytes(24).toString('base64url'), URL!);
    checklists = new ChecklistsService(prisma as never);
    const storage = { persistEvidenceUrl: async () => ({}), deleteStoredObjects: async () => undefined };
    mobile = new MobileService(prisma as never, {} as never, storage as never, new CronogramaService(prisma as never), {} as never, {} as never);
    const auth = new AuthService(prisma as never, {} as never, {} as never, {} as never);
    // Secretaria e próprio próprios deste arquivo (T309S), para não mexer nos contadores do outro db.spec do 309.
    const sec = (await prisma.secretaria.findFirst({ where: { sigla: 'T309S' } })) ?? (await prisma.secretaria.create({ data: { nome: 'Secretaria Fictícia 309 Sync', sigla: 'T309S' } }));
    secretariaS = sec.id;
    const uni =
      (await prisma.unidadePublica.findFirst({ where: { codigoPatrimonial: 'T309-S' } })) ??
      (await prisma.unidadePublica.create({ data: { secretariaId: sec.id, codigoPatrimonial: 'T309-S', nome: 'Próprio Fictício 309 Sync', tipo: 'ESCOLA', endereco: 'Rua Fictícia, 309', latitude: -20.5, longitude: -47.4 } }));
    unidadeS = uni.id;
    todas = { sub: seed.todas, nome: 'Fictício', email: 'todas.309@aion.local', ...(await auth.resolveActiveSession(seed.todas)) } as JwtPayload;
    gestor = { sub: seed.gestor, nome: 'Fictício', email: 'gestor.309@aion.local', ...(await auth.resolveActiveSession(seed.gestor)) } as JwtPayload;
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('Inativar grava inativadoEm; Reativar limpa', async () => {
    const c = await novoChecklist();
    const em = await inativado(c.id);
    expect(em).toBeInstanceOf(Date);
    await checklists.reactivateChecklist(c.id, todas);
    expect((await prisma.checklist.findUniqueOrThrow({ where: { id: c.id } })).inativadoEm).toBeNull();
  });

  it('ANTES: check-in 1 s antes da inativação → aceita, grava com a versão do pacote e marca na auditoria', async () => {
    const c = await novoChecklist();
    const em = await inativado(c.id);
    const dto = payload(c.versao, c.item, new Date(em.getTime() - 1000));
    const r = await mobile.syncFiscalizacao(dto as never, gestor);
    expect(r.status).toBe('sincronizado');
    const f = await prisma.fiscalizacao.findUniqueOrThrow({ where: { id: r.fiscalizacaoId! } });
    expect(f.checklistVersaoId).toBe(c.versao);
    expect(f.iniciadaEm.toISOString()).toBe(dto.iniciadaEm);
    const log = await prisma.logAuditoria.findFirstOrThrow({ where: { entidadeId: f.id, acao: 'SYNC' } });
    expect(log.descricao).toBe('Sync de vistoria contra checklist já inativo (check-in anterior à inativação)');
    expect(log.valorNovo).toMatchObject({
      syncContraChecklistInativo: { checklistId: c.id, checklistVersaoId: c.versao, checkinEm: dto.iniciadaEm, inativadoEm: em.toISOString() },
    });
    // Reenvio não duplica.
    expect((await mobile.syncFiscalizacao(dto as never, gestor)).status).toBe('duplicado');
    expect(await prisma.fiscalizacao.count({ where: { clientId: dto.clientEventId } })).toBe(1);
  });

  it('ANTES com versão do pacote já arquivada (v2 publicada depois do download) → aceita com a v1', async () => {
    const c = await novoChecklist();
    await prisma.checklistVersao.update({ where: { id: c.versao }, data: { status: 'ARQUIVADA' } });
    await prisma.checklistVersao.create({ data: { checklistId: c.id, versao: 2, status: 'PUBLICADA' } });
    const em = await inativado(c.id);
    const r = await mobile.syncFiscalizacao(payload(c.versao, c.item, new Date(em.getTime() - H)) as never, gestor);
    const f = await prisma.fiscalizacao.findUniqueOrThrow({ where: { id: r.fiscalizacaoId! } });
    expect(f.checklistVersaoId).toBe(c.versao);
  });

  it('FRONTEIRA: check-in IGUAL à inativação → 409 (a inativação vale a partir do instante gravado), nada gravado', async () => {
    const c = await novoChecklist();
    const em = await inativado(c.id);
    const dto = payload(c.versao, c.item, new Date(em.getTime()));
    const e = await mobile.syncFiscalizacao(dto as never, gestor).catch((x) => x);
    expect(e).toBeInstanceOf(ConflictException);
    expect(e.message).toContain(`inativado em ${formatarDataHoraBr(em)}, antes do check-in`);
    expect(await prisma.fiscalizacao.count({ where: { clientId: dto.clientEventId } })).toBe(0);
  });

  it('DEPOIS: check-in 1 s depois da inativação → 409 com o motivo e as datas, nada gravado', async () => {
    const c = await novoChecklist();
    const em = await inativado(c.id);
    const checkin = new Date(em.getTime() + 1000);
    const dto = payload(c.versao, c.item, checkin);
    const e = await mobile.syncFiscalizacao(dto as never, gestor).catch((x) => x);
    expect(e).toBeInstanceOf(ConflictException);
    expect(e.getStatus()).toBe(409);
    expect(e.message).toBe(
      `Este checklist está inativo e não pode iniciar vistoria, documento ou aplicação nova. Ele foi inativado em ${formatarDataHoraBr(em)}, antes do check-in desta vistoria (${formatarDataHoraBr(checkin)}). A vistoria continua salva no aparelho.`,
    );
    expect(await prisma.fiscalizacao.count({ where: { clientId: dto.clientEventId } })).toBe(0);
  });

  it('FUSO: aparelho em -03:00 x servidor UTC — mesmo instante é IGUAL (409); 1 s antes em -03:00 aceita', async () => {
    const c = await novoChecklist();
    const em = await inativado(c.id);
    const emSp = (ms: number) => {
      const t = new Date(em.getTime() + ms - 3 * H);
      return t.toISOString().replace('Z', '-03:00');
    };
    const igual = { ...payload(c.versao, c.item, em), iniciadaEm: emSp(0) };
    expect(new Date(igual.iniciadaEm).getTime()).toBe(em.getTime());
    await expect(mobile.syncFiscalizacao(igual as never, gestor)).rejects.toBeInstanceOf(ConflictException);
    const antes = { ...payload(c.versao, c.item, em), iniciadaEm: emSp(-1000) };
    const r = await mobile.syncFiscalizacao(antes as never, gestor);
    const f = await prisma.fiscalizacao.findUniqueOrThrow({ where: { id: r.fiscalizacaoId! } });
    expect(f.iniciadaEm.getTime()).toBe(em.getTime() - 1000);
  });

  it('SEM CHECK-IN: usa o primeiro horário do aparelho no pacote (aqui, a captura da evidência)', async () => {
    const c = await novoChecklist();
    const em = await inativado(c.id);
    const base = payload(c.versao, c.item, em);
    const { iniciadaEm: _sem, ...semCheckin } = base;
    // concluída depois da inativação, mas a 1ª captura é 1 s antes → aceita; corte gravado como início.
    const capturaAntes = new Date(em.getTime() - 1000).toISOString();
    const dtoAceito = { ...semCheckin, concluidaEm: new Date(em.getTime() + H).toISOString(), respostas: [{ ...base.respostas[0], evidencias: [] }] };
    const vazio = await mobile.syncFiscalizacao({ ...dtoAceito, clientEventId: `${base.clientEventId}-x`, concluidaEm: new Date(em.getTime() + H).toISOString() } as never, gestor).catch((x) => x);
    expect(vazio).toBeInstanceOf(ConflictException); // sem check-in e sem captura: corte = conclusão (depois) → 409
    const decisao = (await import('../common/inativos/registro-inativo')).instanteCorteSync({ ...dtoAceito, respostas: [{ evidencias: [{ capturadaEm: capturaAntes }] }] });
    expect(decisao!.toISOString()).toBe(capturaAntes);
    const r = await mobile.syncFiscalizacao({ ...dtoAceito, concluidaEm: capturaAntes } as never, gestor);
    expect(r.status).toBe('sincronizado');
    const f = await prisma.fiscalizacao.findUniqueOrThrow({ where: { id: r.fiscalizacaoId! } });
    expect(f.iniciadaEm.toISOString()).toBe(capturaAntes);
  });

  it('REATIVADO: depois de reativar o checklist volta a valer como ativo (inativadoEm limpo) — vistoria feita na janela inativa é aceita', async () => {
    const c = await novoChecklist();
    const em = await inativado(c.id);
    await checklists.reactivateChecklist(c.id, todas);
    const r = await mobile.syncFiscalizacao(payload(c.versao, c.item, new Date(em.getTime() + H)) as never, gestor);
    expect(r.status).toBe('sincronizado');
    const log = await prisma.logAuditoria.findFirstOrThrow({ where: { entidadeId: r.fiscalizacaoId!, acao: 'SYNC' } });
    expect(log.descricao).toBeNull();
  });

  it('BACKFILL da migração: STATUS_CHANGE > DELETE > updatedAt; ativos ficam NULL', async () => {
    const sql = readFileSync(path.resolve(__dirname, '../../prisma/migrations/20261023220000_checklist_inativado_em/migration.sql'), 'utf8');
    const update = sql.slice(sql.indexOf('UPDATE "Checklist"'));
    const [a, b, d, at] = [await novoChecklist(), await novoChecklist(), await novoChecklist(), await novoChecklist()];
    await prisma.checklist.updateMany({ where: { id: { in: [a.id, b.id, d.id] } }, data: { ativo: false, inativadoEm: null } });
    const t1 = new Date('2026-09-01T12:00:00Z');
    const t2 = new Date('2026-09-02T12:00:00Z');
    await prisma.logAuditoria.create({ data: { acao: 'STATUS_CHANGE', entidadeTipo: 'Checklist', entidadeId: a.id, valorNovo: { ativo: false }, createdAt: t1 } });
    await prisma.logAuditoria.create({ data: { acao: 'DELETE', entidadeTipo: 'Checklist', entidadeId: a.id, createdAt: t2 } });
    await prisma.logAuditoria.create({ data: { acao: 'DELETE', entidadeTipo: 'Checklist', entidadeId: b.id, createdAt: t2 } });
    await prisma.$executeRawUnsafe(update);
    const get = async (id: string) => (await prisma.checklist.findUniqueOrThrow({ where: { id } }));
    expect((await get(a.id)).inativadoEm?.toISOString()).toBe(t1.toISOString());
    expect((await get(b.id)).inativadoEm?.toISOString()).toBe(t2.toISOString());
    const dd = await get(d.id);
    expect(dd.inativadoEm?.toISOString()).toBe(dd.updatedAt.toISOString());
    expect((await get(at.id)).inativadoEm).toBeNull();
  });
});
