/**
 * 309 — integração com Postgres LOCAL descartável: checklists inativos (C1 a C6).
 * Só roda com ESCOPO_306_TEST_DATABASE_URL (banco local migrado; antes: npx prisma generate).
 * Seed fictício 306 + 309 (trava de banco local/NODE_ENV). Cada execução cria checklists NOVOS (só inserções).
 */
import { randomBytes } from 'node:crypto';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedChecklists309, Seed309 } from '../../scripts/seed-checklists-309-core';
import { AuthService } from '../auth/auth.service';
import { JwtPayload } from '../auth/jwt';
import { CHECKLIST_INATIVO } from '../common/inativos/registro-inativo';
import { CronogramaService } from '../cronograma/cronograma.service';
import { DocumentosService } from '../documentos/documentos.service';
import { FiscalizacoesService } from '../fiscalizacoes/fiscalizacoes.service';
import { MobileService } from '../mobile/mobile.service';
import { ChecklistsService } from './checklists.service';

const URL = process.env.ESCOPO_306_TEST_DATABASE_URL;
const MSG = 'Este checklist está inativo. Reative o modelo para realizar alterações';

async function erroDe(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e as Error & { getStatus?: () => number };
  }
  throw new Error('esperava erro');
}

describe.skipIf(!URL)('309 — checklists inativos (Postgres local)', () => {
  let prisma: PrismaClient;
  let seed: Seed309;
  let svc: ChecklistsService;
  let auth: AuthService;
  let gestor: JwtPayload;
  let leitor: JwtPayload;
  let alvo: { id: string; versao: string };
  const sufixo = randomBytes(4).toString('hex');
  const sessao = async (usuarioId: string): Promise<JwtPayload> => {
    const s = await auth.resolveActiveSession(usuarioId);
    return { sub: usuarioId, nome: 'Fictício', email: 'x@aion.local', ...s } as JwtPayload;
  };
  const novoChecklist = async (nome: string) => {
    const c = await prisma.checklist.create({
      data: {
        nome: `${nome} ${sufixo}`,
        escopo: 'SECRETARIA',
        secretariaId: seed.secretaria309,
        finalidades: ['VISTORIA', 'DOCUMENTO_AVULSO'],
        versoes: {
          create: {
            versao: 1,
            status: 'PUBLICADA',
            itens: { create: [{ ordem: 1, codigo: 'T309-1', titulo: 'Item fictício', tipo: 'BOOLEANO' }] },
          },
        },
      },
      include: { versoes: true },
    });
    return { id: c.id, versao: c.versoes[0].id };
  };
  const dtoBinding = (nome: string) => ({ nome, escopo: 'SECRETARIA' as const, secretariaId: seed.secretaria309, finalidades: ['VISTORIA' as const] });

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: URL! }) });
    seed = await seedChecklists309(prisma, randomBytes(24).toString('base64url'), URL!);
    svc = new ChecklistsService(prisma as never);
    auth = new AuthService(prisma as never, {} as never, {} as never, {} as never);
    gestor = await sessao(seed.gestor);
    leitor = await sessao(seed.leitor);
    alvo = await novoChecklist('Checklist Fictício 309 Alvo');
  });
  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it('C1/C6: contadores do resumo batem com a lista (ativos + inativos) no mesmo escopo', async () => {
    const lista = await svc.listChecklists(gestor);
    const resumo = await svc.resumoChecklists(gestor);
    expect(resumo.ativos).toBe(lista.filter((c) => c.ativo).length);
    expect(resumo.inativos).toBe(lista.filter((c) => !c.ativo).length);
    expect(resumo.total).toBe(lista.length);
    expect(lista.some((c) => c.id === seed.checklistInativo && !c.ativo)).toBe(true);
  });

  it('C6: sem permissão de excluir, Inativar e Reativar respondem 403 e nada muda', async () => {
    await expect(svc.deactivateChecklist(alvo.id, leitor)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.reactivateChecklist(seed.checklistInativo, leitor)).rejects.toBeInstanceOf(ForbiddenException);
    expect((await prisma.checklist.findUniqueOrThrow({ where: { id: alvo.id } })).ativo).toBe(true);
  });

  it('C6: inativar grava auditoria STATUS_CHANGE com quem, quando, antes e depois; contadores mudam exatamente 1', async () => {
    const antes = await svc.resumoChecklists(gestor);
    const t0 = Date.now();
    const r = await svc.deactivateChecklist(alvo.id, gestor);
    expect(r.ativo).toBe(false);
    const depois = await svc.resumoChecklists(gestor);
    expect(depois.ativos).toBe(antes.ativos - 1);
    expect(depois.inativos).toBe(antes.inativos + 1);
    expect(depois.total).toBe(antes.total);
    const log = await prisma.logAuditoria.findFirstOrThrow({ where: { entidadeId: alvo.id, acao: 'STATUS_CHANGE' }, orderBy: { createdAt: 'desc' } });
    expect(log.usuarioId).toBe(seed.gestor);
    expect(log.createdAt.getTime()).toBeGreaterThanOrEqual(t0 - 1000);
    expect(log.valorAntigo).toMatchObject({ evento: 'INATIVAR', ativo: true, usuarioId: seed.gestor });
    expect(log.valorNovo).toMatchObject({ evento: 'INATIVAR', ativo: false, usuarioId: seed.gestor });
    expect(log.descricao).toBe('Checklist inativado');
  });

  it('C2: inativar de novo responde 409 e não duplica auditoria', async () => {
    const n = await prisma.logAuditoria.count({ where: { entidadeId: alvo.id, acao: 'STATUS_CHANGE' } });
    await expect(svc.deactivateChecklist(alvo.id, gestor)).rejects.toBeInstanceOf(ConflictException);
    expect(await prisma.logAuditoria.count({ where: { entidadeId: alvo.id, acao: 'STATUS_CHANGE' } })).toBe(n);
  });

  it('C3: inativo é somente leitura no backend (vínculo, nova versão, salvar e publicar rascunho) com a mensagem exata', async () => {
    // Rascunho criado direto no banco para provar que até um rascunho existente fica travado.
    const rascunho = await prisma.checklistVersao.create({ data: { checklistId: alvo.id, versao: 2, status: 'RASCUNHO' } });
    const tentativas = [
      () => svc.updateChecklist(alvo.id, dtoBinding('Novo nome'), gestor),
      () => svc.createVersion(alvo.id, gestor),
      () => svc.updateVersion(rascunho.id, { estrutura: {}, itens: [] } as never, gestor),
      () => svc.publishVersion(rascunho.id, gestor),
    ];
    for (const t of tentativas) {
      const e = await erroDe(t());
      expect(e).toBeInstanceOf(ConflictException);
      expect(e.message).toBe(MSG);
      expect(e.getStatus?.()).toBe(409);
    }
    const c = await prisma.checklist.findUniqueOrThrow({ where: { id: alvo.id } });
    expect(c.nome).toBe(`Checklist Fictício 309 Alvo ${sufixo}`);
    expect(await prisma.checklistVersao.count({ where: { checklistId: alvo.id } })).toBe(2);
  });

  it('C4: inativo não inicia vistoria manual, sync de campo nem documento avulso; existentes ficam intactos', async () => {
    const fiscAntes = await prisma.fiscalizacao.findUniqueOrThrow({ where: { id: seed.fiscalizacaoExistente } });
    const totalAntes = await prisma.fiscalizacao.count({ where: { checklistVersaoId: seed.versaoInativo } });
    const fisc = new FiscalizacoesService(prisma as never, {} as never, {} as never, {} as never, {} as never);
    const mobile = new MobileService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    const docs = new DocumentosService(prisma as never, {} as never);
    const tentativas = [
      () => fisc.lancamentoManual({ unidadeId: seed.unidadeA, checklistVersaoId: seed.versaoInativo, dataVistoria: '2026-10-20' } as never, gestor),
      () => mobile.syncFiscalizacao({ clientEventId: `t309-${sufixo}`, unidadeId: seed.unidadeA, checklistVersaoId: seed.versaoInativo } as never, gestor),
      () => docs.createAvulso({ secretariaId: seed.secretaria309, checklistVersaoId: seed.versaoInativo, titulo: 'Doc fictício 309' } as never, gestor),
    ];
    for (const t of tentativas) {
      const e = await erroDe(t());
      expect(e).toBeInstanceOf(ConflictException);
      expect(e.message).toBe(CHECKLIST_INATIVO.mensagemNaoInicia);
    }
    expect(await prisma.fiscalizacao.count({ where: { checklistVersaoId: seed.versaoInativo } })).toBe(totalAntes);
    const fiscDepois = await prisma.fiscalizacao.findUniqueOrThrow({ where: { id: seed.fiscalizacaoExistente } });
    expect(fiscDepois).toEqual(fiscAntes);
    // Pacote de campo e lista do cronograma não oferecem o inativo.
    const cron = new CronogramaService(prisma as never);
    expect((await cron.listChecklistsParaCronograma(gestor)).map((c) => c.id)).not.toContain(seed.checklistInativo);
  });

  it('C5: cronogramas e programações que usam checklist inativo vêm sinalizados', async () => {
    const cron = new CronogramaService(prisma as never);
    const lista = await cron.listCronogramas(undefined, gestor);
    const doInativo = lista.find((c) => c.id === seed.cronograma);
    expect(doInativo?.checklist.ativo).toBe(false);
    expect(lista.filter((c) => c.checklistId === seed.checklistAtivo).every((c) => c.checklist.ativo)).toBe(true);
    const { items } = await cron.listVistoriasProgramadas({ from: '2026-11-01', to: '2026-11-30' } as never, gestor);
    const prog = items.filter((i) => i.cronogramaId === seed.cronograma);
    expect(prog.length).toBeGreaterThan(0);
    expect(prog.every((i) => i.checklistInativo === true)).toBe(true);
    const cal = await cron.getCalendario({ from: '2026-11-01', to: '2026-11-30' } as never, gestor);
    const ev = cal.eventos.filter((e) => e.cronogramaId === seed.cronograma);
    expect(ev.length).toBeGreaterThan(0);
    expect(ev.filter((e) => e.cronogramaId === seed.cronograma).every((e) => e.checklistInativo === true)).toBe(true);
  });

  it('C2/C6: reativar com permissão volta a editar, audita REATIVAR e os contadores voltam', async () => {
    const antes = await svc.resumoChecklists(gestor);
    const r = await svc.reactivateChecklist(alvo.id, gestor);
    expect(r.ativo).toBe(true);
    const depois = await svc.resumoChecklists(gestor);
    expect(depois.ativos).toBe(antes.ativos + 1);
    expect(depois.inativos).toBe(antes.inativos - 1);
    const log = await prisma.logAuditoria.findFirstOrThrow({ where: { entidadeId: alvo.id, acao: 'STATUS_CHANGE' }, orderBy: { createdAt: 'desc' } });
    expect(log.valorAntigo).toMatchObject({ evento: 'REATIVAR', ativo: false });
    expect(log.valorNovo).toMatchObject({ evento: 'REATIVAR', ativo: true });
    const editado = await svc.updateChecklist(alvo.id, dtoBinding(`Checklist Fictício 309 Alvo ${sufixo} (editado)`), gestor);
    expect(editado.ativo).toBe(true);
    await expect(svc.reactivateChecklist(alvo.id, gestor)).rejects.toBeInstanceOf(ConflictException);
  });

  it('C6: fora da Secretaria ativa não inativa (escopo do 306)', async () => {
    const deB = await prisma.checklist.create({ data: { nome: `Checklist Fictício 309 B ${sufixo}`, escopo: 'SECRETARIA', secretariaId: seed.secretarias.B } });
    await expect(svc.deactivateChecklist(deB.id, gestor)).rejects.toThrow();
    expect((await prisma.checklist.findUniqueOrThrow({ where: { id: deB.id } })).ativo).toBe(true);
  });
});
