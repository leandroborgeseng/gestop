/**
 * 287 · integração REAL (Postgres local) pelo DocumentosService.
 * Só roda com DATABASE_URL em localhost/127.0.0.1; sem isso é pulado (CI).
 *   DATABASE_URL=postgresql://gestop:gestop@localhost:5432/gestop287 npx vitest run src/documentos/documento-cancelamento.int.spec.ts
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { DocumentoOrigem, DocumentoSituacao, DocumentoTipo, PrismaClient } from '@prisma/client';
import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { JwtPayload } from '../auth/jwt';
import { DocumentosService } from './documentos.service';

const url = process.env.DATABASE_URL ?? '';
const local = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);

describe.skipIf(!local)('287 · integração (Postgres local)', () => {
  let prisma: PrismaClient;
  let service: DocumentosService;
  const ops: string[] = [];
  const tag = randomUUID().slice(0, 8);
  let secretariaId = '';
  let gestor: JwtPayload;
  let signatario: JwtPayload;
  const docIds: string[] = [];
  const userIds: string[] = [];

  async function novoUsuario(nome: string) {
    const u = await prisma.usuario.create({ data: { nome, email: `${nome}-${tag}@aion.local`, senhaHash: 'x', secretariaId } });
    userIds.push(u.id);
    return u;
  }
  async function novoDocumento(situacao: DocumentoSituacao = DocumentoSituacao.ASSINATURA_PENDENTE) {
    const id = randomUUID();
    await prisma.documento.create({
      data: {
        id, codigo: `DOC-287-${tag}-${docIds.length}`, codigoValidacao: `V287${tag}${docIds.length}`,
        tipo: DocumentoTipo.DOCUMENTO_AVULSO, situacao, origem: DocumentoOrigem.AVULSO,
        titulo: `Teste 287 ${tag}`, secretariaId,
      },
    });
    docIds.push(id);
    await prisma.documentoAssinaturaPedido.create({
      data: { documentoId: id, destinatarioId: signatario.sub, solicitanteId: gestor.sub },
    });
    return id;
  }

  beforeAll(async () => {
    const base = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    // registra toda operação para provar que não existe DELETE no fluxo de cancelamento
    prisma = base.$extends({
      query: { $allModels: { async $allOperations({ model, operation, args, query }) { ops.push(`${model}.${operation}`); return query(args); } } },
    }) as unknown as PrismaClient;
    service = new DocumentosService(prisma as never, {} as never);
    const sec = await base.secretaria.create({ data: { nome: `Sec 287 ${tag}`, sigla: `S287${tag}` } });
    secretariaId = sec.id;
    const g = await base.usuario.create({ data: { nome: 'gestor287', email: `gestor287-${tag}@aion.local`, senhaHash: 'x', secretariaId } });
    const s = await base.usuario.create({ data: { nome: 'sign287', email: `sign287-${tag}@aion.local`, senhaHash: 'x', secretariaId } });
    userIds.push(g.id, s.id);
    const comum = { perfis: ['Gestor 287'], secretariaId, secretariasIds: [secretariaId] };
    gestor = { sub: g.id, nome: g.nome, email: g.email, permissoes: ['documentos.visualizar', 'documentos.cancelar'], ...comum };
    signatario = { sub: s.id, nome: s.nome, email: s.email, permissoes: ['documentos.visualizar'], ...comum };
    void novoUsuario;
  });

  afterAll(async () => {
    const base = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    await base.logAuditoria.deleteMany({ where: { entidadeId: { in: docIds } } });
    await base.historicoStatus.deleteMany({ where: { entidadeId: { in: docIds } } });
    await base.documento.deleteMany({ where: { id: { in: docIds } } });
    await base.usuario.deleteMany({ where: { id: { in: userIds } } });
    if (secretariaId) await base.secretaria.delete({ where: { id: secretariaId } });
    await base.$disconnect();
  });

  it('A1: cancela — registro fica com CANCELADO, data, usuário e auditoria; nenhum DELETE', async () => {
    const id = await novoDocumento();
    ops.length = 0;
    const r = await service.cancelar(id, { motivo: 'emitido em duplicidade' }, gestor);
    expect(ops.some((o) => /\.delete(Many)?$/.test(o))).toBe(false);
    expect(r.situacao).toBe('CANCELADO');
    expect(r.cancelamento?.por?.nome).toBe('gestor287');
    const row = await prisma.documento.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ situacao: 'CANCELADO', canceladoPorId: gestor.sub, canceladoMotivo: 'emitido em duplicidade' });
    expect(row.canceladoEm).toBeInstanceOf(Date);
    const audit = await prisma.logAuditoria.findFirst({ where: { entidadeId: id, funcao: 'cancelar' } });
    expect(audit?.usuarioId).toBe(gestor.sub);
  });

  it('A2: sem a permissão → 403 e nada muda', async () => {
    const id = await novoDocumento();
    await expect(service.cancelar(id, {}, signatario)).rejects.toMatchObject({ status: 403 });
    expect((await prisma.documento.findUniqueOrThrow({ where: { id } })).situacao).toBe('ASSINATURA_PENDENTE');
  });

  it('A3: cancelado sai das pendências e dos contadores; aparece com o histórico ligado', async () => {
    const id = await novoDocumento();
    const antes = await service.pendenciasResumo(signatario);
    const minhasAntes = await service.listMinhasPendenciasAssinatura(signatario);
    await service.cancelar(id, {}, gestor);
    const depois = await service.pendenciasResumo(signatario);
    const minhasDepois = await service.listMinhasPendenciasAssinatura(signatario);
    expect(depois.total).toBe(antes.total - 1);
    expect(minhasDepois.total).toBe(minhasAntes.total - 1);
    const padrao = await service.list({ search: tag } as never, gestor);
    expect(padrao.items.map((d: { id: string }) => d.id)).not.toContain(id);
    const historico = await service.list({ search: tag, historico: '1' } as never, gestor);
    expect(historico.items.map((d: { id: string }) => d.id)).toContain(id);
    const pedido = await prisma.documentoAssinaturaPedido.findFirstOrThrow({ where: { documentoId: id } });
    expect(pedido.status).toBe('CANCELADO');
  });

  it('concorrência: dois cancelamentos em paralelo → exatamente um vence, o outro 409', async () => {
    const id = await novoDocumento(DocumentoSituacao.GERADO);
    const r = await Promise.allSettled([service.cancelar(id, {}, gestor), service.cancelar(id, {}, gestor)]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const rej = r.find((x) => x.status === 'rejected') as PromiseRejectedResult;
    expect(rej.reason).toBeInstanceOf(ConflictException);
    expect(await prisma.historicoStatus.count({ where: { entidadeId: id, statusNovo: 'CANCELADO' } })).toBe(1);
  });

  it('cancelado é só leitura: editar vínculos dá 409', async () => {
    const id = await novoDocumento(DocumentoSituacao.GERADO);
    await service.cancelar(id, {}, gestor);
    await expect(service.updateVinculos(id, { chamadoIds: [] } as never, gestor)).rejects.toBeInstanceOf(ConflictException);
    const editor = { ...gestor, permissoes: [...gestor.permissoes, 'documentos.criar_avulso'] };
    await expect(service.salvarRespostas(id, { respostas: [] } as never, editor)).rejects.toBeInstanceOf(ConflictException);
  });

  it('detalhe: podeCancelar só para documentos.cancelar ou Admin do Sistema (administrar sozinho = false)', async () => {
    const id = await novoDocumento(DocumentoSituacao.GERADO);
    const base = { ...signatario, permissoes: ['documentos.visualizar'] };
    const casos: Array<[string, JwtPayload, boolean]> = [
      ['sem documentos.cancelar', base, false],
      ['só documentos.administrar', { ...base, permissoes: ['documentos.visualizar', 'documentos.administrar'] }, false],
      ['documentos.cancelar', { ...base, permissoes: ['documentos.visualizar', 'documentos.cancelar'] }, true],
      ['Admin do Sistema', { ...base, perfis: ['Administrador do Sistema'] }, true],
    ];
    for (const [nome, perfil, esperado] of casos) {
      const d = (await service.getById(id, perfil)) as { podeCancelar?: boolean };
      expect(d.podeCancelar, nome).toBe(esperado);
    }
  });

  it('legado: documento já CANCELADO com pedido PENDENTE não aparece em pendências, total nem minhas pendências', async () => {
    const u = await prisma.usuario.create({ data: { nome: 'legado287', email: `legado287-${tag}@aion.local`, senhaHash: 'x', secretariaId } });
    userIds.push(u.id);
    const destinatario: JwtPayload = { ...signatario, sub: u.id, nome: u.nome, email: u.email };
    const id = randomUUID();
    docIds.push(id);
    await prisma.documento.create({
      data: {
        id, codigo: `DOC-287L-${tag}`, codigoValidacao: `V287L${tag}`, tipo: DocumentoTipo.DOCUMENTO_AVULSO,
        situacao: DocumentoSituacao.CANCELADO, origem: DocumentoOrigem.AVULSO, titulo: `Legado 287 ${tag}`, secretariaId,
      },
    });
    await prisma.documentoAssinaturaPedido.create({ data: { documentoId: id, destinatarioId: u.id, solicitanteId: gestor.sub } });
    const resumo = await service.pendenciasResumo(destinatario);
    const ids = resumo.grupos.flatMap((g: { itens: Array<{ id: string }> }) => g.itens.map((x) => x.id));
    expect(ids).not.toContain(id);
    expect(resumo.total).toBe(0);
    expect(resumo.grupos.find((g: { id: string }) => g.id === 'documentos')).toBeUndefined();
    const minhas = await service.listMinhasPendenciasAssinatura(destinatario);
    expect(minhas.total).toBe(0);
    expect(minhas.items.map((d: { id: string }) => d.id)).not.toContain(id);
  });
});
