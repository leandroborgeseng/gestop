import { describe, expect, it } from 'vitest';
import { permissionMatrixKey } from './permissions-catalog';
import {
  buildMatrixSavePayload,
  deriveLegacyPermissionKeys,
  expandLegacyToMatrixKeys,
  resolveEffectiveMatrixKeys,
} from './permissions-matrix';

describe('permissions-matrix', () => {
  it('expande chaves legadas para a matriz', () => {
    const matrix = expandLegacyToMatrixKeys(new Set(['chamados.gerenciar', 'fiscalizacoes.executar']));
    expect(matrix.has(permissionMatrixKey('chamados', 'alterar_status', 'alterar'))).toBe(true);
    expect(matrix.has(permissionMatrixKey('vistoria_campo', 'concluir_vistoria', 'executar'))).toBe(true);
  });

  it('deriva chaves legadas ao salvar matriz', () => {
    const matrix = new Set([
      permissionMatrixKey('chamados', 'alterar_status', 'alterar'),
      permissionMatrixKey('execucao', 'checkin', 'executar'),
    ]);
    const legacy = deriveLegacyPermissionKeys(matrix);
    expect(legacy.has('chamados.gerenciar')).toBe(true);
    expect(legacy.has('chamados.executar')).toBe(true);
  });

  it('resolve matriz efetiva a partir de legado quando não há chaves matriz', () => {
    const effective = resolveEffectiveMatrixKeys(['chamados.gerenciar']);
    expect(effective.has(permissionMatrixKey('chamados', 'abrir_chamado', 'inserir'))).toBe(true);
  });

  it('monta payload de salvamento com legado derivado', () => {
    const payload = buildMatrixSavePayload([
      permissionMatrixKey('permissoes', 'configurar', 'alterar'),
      permissionMatrixKey('permissoes', '_tela', 'visualizar'),
    ]);
    expect(payload.legacyKeys).toContain('permissoes.gerenciar');
    expect(payload.allKeys).toContain('permissoes.gerenciar');
  });
});
