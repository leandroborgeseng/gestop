import 'reflect-metadata';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AuditAction, DocumentoSituacao } from '@prisma/client';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_ANY_PERMISSIONS_KEY, hasAnyPermission } from '../auth/permissions';
import { ADMINISTRADOR_SISTEMA_NOME, PERMISSIONS_CATALOG } from '../domain/permissions-catalog';
import { deriveLegacyPermissionKeys, expandLegacyToMatrixKeys } from '../domain/permissions-matrix';
import {
  DOCUMENTOS_CANCELAR,
  assertDocumentoNaoCancelado,
  cancelarDocumentoLogico,
  filtroCanceladosNaLista,
  podeCancelarDocumento,
} from './documento-cancelamento';
import { DocumentosController } from './documentos.controller';
import { DocumentosService } from './documentos.service';

const user = { sub: 'u-287', nome: 'Gestor', email: 'gestor287@aion.local', perfis: ['Gestor'], permissoes: [DOCUMENTOS_CANCELAR], secretariaId: 'sec-1' };

function fakeTx(count = 1) {
  return {
    documento: { updateMany: vi.fn(async () => ({ count })), delete: vi.fn(), deleteMany: vi.fn() },
    documentoAssinaturaPedido: { updateMany: vi.fn(async () => ({ count: 2 })), delete: vi.fn(), deleteMany: vi.fn() },
    historicoStatus: { create: vi.fn(async () => ({})) },
    logAuditoria: { create: vi.fn(async () => ({})) },
  };
}

describe('287 · cancelarDocumentoLogico', () => {
  it('muda para CANCELADO com data e usuário, de forma condicional, sem DELETE', async () => {
    const tx = fakeTx();
    const agora = new Date('2026-10-15T13:00:00Z');
    const r = await cancelarDocumentoLogico(tx, { documentoId: 'd1', situacaoAnterior: DocumentoSituacao.GERADO, user, agora });
    expect(tx.documento.updateMany).toHaveBeenCalledWith({
      where: { id: 'd1', situacao: { notIn: [DocumentoSituacao.CANCELADO, DocumentoSituacao.SUBSTITUIDO, DocumentoSituacao.INVALIDO] } },
      data: { situacao: DocumentoSituacao.CANCELADO, canceladoEm: agora, canceladoPorId: 'u-287', canceladoMotivo: null },
    });
    expect(tx.documento.delete).not.toHaveBeenCalled();
    expect(tx.documento.deleteMany).not.toHaveBeenCalled();
    expect(tx.documentoAssinaturaPedido.deleteMany).not.toHaveBeenCalled();
    expect(r.pedidosCancelados).toBe(2);
  });

  it('retira os pedidos de assinatura pendentes (sai das pendências) sem apagar', async () => {
    const tx = fakeTx();
    await cancelarDocumentoLogico(tx, { documentoId: 'd1', situacaoAnterior: DocumentoSituacao.ASSINATURA_PENDENTE, user });
    expect(tx.documentoAssinaturaPedido.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { documentoId: 'd1', status: 'PENDENTE' }, data: expect.objectContaining({ status: 'CANCELADO' }) }),
    );
  });

  it('grava histórico e auditoria com situação anterior, usuário e motivo opcional', async () => {
    const tx = fakeTx();
    await cancelarDocumentoLogico(tx, { documentoId: 'd1', situacaoAnterior: DocumentoSituacao.GERADO, user, motivo: '  duplicado  ' });
    expect(tx.historicoStatus.create.mock.calls[0][0].data).toMatchObject({ statusAnterior: 'GERADO', statusNovo: 'CANCELADO', motivo: 'duplicado', alteradoPorId: 'u-287' });
    const audit = tx.logAuditoria.create.mock.calls[0][0].data;
    expect(audit).toMatchObject({ acao: AuditAction.STATUS_CHANGE, entidadeTipo: 'Documento', entidadeId: 'd1', usuarioId: 'u-287', funcao: 'cancelar' });
    expect(audit.valorNovo).toMatchObject({ situacao: 'CANCELADO', canceladoPorId: 'u-287', motivo: 'duplicado' });
  });

  it('já cancelado (count 0): 409 e nada de histórico/auditoria', async () => {
    const tx = fakeTx(0);
    await expect(cancelarDocumentoLogico(tx, { documentoId: 'd1', situacaoAnterior: DocumentoSituacao.CANCELADO, user })).rejects.toBeInstanceOf(ConflictException);
    expect(tx.historicoStatus.create).not.toHaveBeenCalled();
    expect(tx.logAuditoria.create).not.toHaveBeenCalled();
  });

  it('documento cancelado é só leitura', () => {
    expect(() => assertDocumentoNaoCancelado({ situacao: DocumentoSituacao.CANCELADO })).toThrow(ConflictException);
    expect(() => assertDocumentoNaoCancelado({ situacao: DocumentoSituacao.GERADO })).not.toThrow();
  });
});

describe('287 · lista e histórico', () => {
  it('lista padrão esconde cancelados; histórico ou filtro Cancelado mostra', () => {
    expect(filtroCanceladosNaLista({})).toEqual({ situacao: { not: 'CANCELADO' } });
    expect(filtroCanceladosNaLista({ historico: '1' })).toBeNull();
    expect(filtroCanceladosNaLista({ situacao: 'CANCELADO' })).toBeNull();
    expect(filtroCanceladosNaLista({ assinatura: 'cancelado' })).toBeNull();
  });
});

describe('287 · permissão', () => {
  it('rota POST /documentos/:id/cancelar exige só documentos.cancelar (Admin do Sistema passa)', () => {
    const keys = Reflect.getMetadata(REQUIRED_ANY_PERMISSIONS_KEY, DocumentosController.prototype.cancelar);
    expect(keys).toEqual([DOCUMENTOS_CANCELAR]);
    expect(hasAnyPermission({ perfis: [], permissoes: ['documentos.cancelar_assinado', 'documentos.visualizar'] }, keys)).toBe(false);
    expect(hasAnyPermission({ perfis: [], permissoes: ['matriz.documentos.cancelar.executar'] }, keys)).toBe(true);
    expect(hasAnyPermission({ perfis: [ADMINISTRADOR_SISTEMA_NOME], permissoes: [] }, keys)).toBe(true);
  });

  it('podeCancelarDocumento (flag do botão)', () => {
    expect(podeCancelarDocumento({ perfis: [], permissoes: [DOCUMENTOS_CANCELAR] })).toBe(true);
    expect(podeCancelarDocumento({ perfis: [], permissoes: ['documentos.administrar'] })).toBe(false);
    expect(podeCancelarDocumento({ perfis: [ADMINISTRADOR_SISTEMA_NOME], permissoes: [] })).toBe(true);
  });

  it('service sem permissão: 403 antes de tocar no banco', async () => {
    const prisma = { documento: { findFirst: vi.fn() }, $transaction: vi.fn() };
    const service = new DocumentosService(prisma as never, {} as never);
    await expect(service.cancelar('d1', {}, { ...user, permissoes: ['documentos.visualizar'] } as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.documento.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('a permissão está no catálogo e na matriz (ida e volta legado ↔ matriz)', () => {
    const docs = PERMISSIONS_CATALOG.find((t) => t.id === 'documentos');
    expect(docs?.functions.find((f) => f.id === 'cancelar')?.actions).toEqual(['executar']);
    expect(deriveLegacyPermissionKeys(new Set(['matriz.documentos.cancelar.executar'])).has(DOCUMENTOS_CANCELAR)).toBe(true);
    expect(expandLegacyToMatrixKeys(new Set([DOCUMENTOS_CANCELAR])).has('matriz.documentos.cancelar.executar')).toBe(true);
  });

  it('a permissão é sincronizada (seed, sync-rbac e permissions-sync)', () => {
    const raiz = path.resolve(__dirname, '../..');
    for (const f of ['prisma/seed.ts', 'prisma/sync-rbac.ts', 'src/domain/permissions-sync.ts']) {
      expect(readFileSync(path.join(raiz, f), 'utf8')).toMatch(/'documentos\.cancelar'/);
    }
  });
});

describe('287 · migration só adiciona', () => {
  it('nenhum DROP/DELETE/TRUNCATE e só ADD COLUMN/CONSTRAINT', () => {
    const dir = path.resolve(__dirname, '../../prisma/migrations');
    const m = readdirSync(dir).find((d) => d.endsWith('_documento_cancelamento_logico'));
    expect(m).toBeTruthy();
    const sql = readFileSync(path.join(dir, m!, 'migration.sql'), 'utf8').replace(/--.*$/gm, '');
    const semRegrasFk = sql.replace(/ON (DELETE|UPDATE) (SET NULL|CASCADE)/g, '');
    expect(semRegrasFk).not.toMatch(/\b(DROP|DELETE|TRUNCATE|RENAME|ALTER COLUMN)\b/i);
    for (const linha of sql.split(';').map((l) => l.trim()).filter(Boolean)) {
      expect(linha).toMatch(/^ALTER TABLE "Documento" ADD (COLUMN|CONSTRAINT) /);
    }
  });
});
