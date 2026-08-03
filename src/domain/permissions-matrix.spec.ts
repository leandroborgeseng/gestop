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

  it('não libera triagem (chamados.gerenciar) só com permissões de Execução', () => {
    const matrix = new Set([permissionMatrixKey('execucao', 'checkin', 'executar')]);
    const legacy = deriveLegacyPermissionKeys(matrix);
    expect(legacy.has('chamados.gerenciar')).toBe(false);
    expect(legacy.has('chamados.executar')).toBe(true);
  });

  it('não libera triagem só com Novo chamado (abrir_chamado)', () => {
    const matrix = new Set([
      permissionMatrixKey('chamados', 'abrir_chamado', 'visualizar'),
      permissionMatrixKey('chamados', 'abrir_chamado', 'inserir'),
    ]);
    const legacy = deriveLegacyPermissionKeys(matrix);
    expect(legacy.has('chamados.gerenciar')).toBe(false);
    expect(legacy.has('chamados.abrir')).toBe(true);
    expect(legacy.has('meus_chamados.visualizar')).toBe(true);
  });

  it('não libera triagem/CCO só com Meus chamados', () => {
    const matrix = new Set([
      permissionMatrixKey('meus_chamados', '_tela', 'visualizar'),
      permissionMatrixKey('meus_chamados', 'consultar', 'visualizar'),
    ]);
    const legacy = deriveLegacyPermissionKeys(matrix);
    expect(legacy.has('meus_chamados.visualizar')).toBe(true);
    expect(legacy.has('chamados.gerenciar')).toBe(false);
    expect(legacy.has('dashboard.visualizar')).toBe(false);
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

  it('deriva permissões legadas do módulo Documentos', () => {
    const matrix = new Set([
      permissionMatrixKey('documentos', '_tela', 'visualizar'),
      permissionMatrixKey('documentos', 'consultar', 'visualizar'),
      permissionMatrixKey('documentos', 'coletar_assinatura', 'executar'),
      permissionMatrixKey('documentos', 'administrar', 'alterar'),
    ]);
    const legacy = deriveLegacyPermissionKeys(matrix);
    expect(legacy.has('documentos.visualizar')).toBe(true);
    expect(legacy.has('documentos.coletar_assinatura')).toBe(true);
    expect(legacy.has('documentos.administrar')).toBe(true);
  });

  it('não concede usuarios.gerenciar só com visualizar de aba da Administração', () => {
    const matrix = new Set([
      permissionMatrixKey('admin', 'usuarios', 'visualizar'),
      permissionMatrixKey('admin', 'proprios', 'visualizar'),
    ]);
    const legacy = deriveLegacyPermissionKeys(matrix);
    expect(legacy.has('usuarios.gerenciar')).toBe(false);
    expect(legacy.has('unidades.gerenciar')).toBe(false);
  });

  it('expande usuarios.gerenciar para todas as abas da Administração', () => {
    const matrix = expandLegacyToMatrixKeys(new Set(['usuarios.gerenciar']));
    expect(matrix.has(permissionMatrixKey('admin', 'secretarias', 'visualizar'))).toBe(true);
    expect(matrix.has(permissionMatrixKey('admin', 'usuarios', 'inserir'))).toBe(true);
    expect(matrix.has(permissionMatrixKey('admin', 'importacao', 'executar'))).toBe(true);
  });
});
