import { describe, expect, it } from 'vitest';
import { buildMatrixKey, canColetarAssinatura } from './permissions-matrix';

describe('canColetarAssinatura', () => {
  it('retorna true para usuarios.gerenciar', () => {
    const permissoes = ['usuarios.gerenciar'];
    expect(canColetarAssinatura(permissoes)).toBe(true);
  });

  it('retorna true para documentos.administrar', () => {
    const permissoes = ['documentos.administrar'];
    expect(canColetarAssinatura(permissoes)).toBe(true);
  });

  it('retorna true para documentos.coletar_assinatura (legado)', () => {
    const permissoes = ['documentos.coletar_assinatura'];
    expect(canColetarAssinatura(permissoes)).toBe(true);
  });

  it('retorna true para matriz.documentos.coletar_assinatura.executar', () => {
    const permissoes = [buildMatrixKey('documentos', 'coletar_assinatura', 'executar')];
    expect(canColetarAssinatura(permissoes)).toBe(true);
  });

  it('retorna false sem permissões relevantes', () => {
    const permissoes = ['chamados.visualizar', 'documentos.visualizar'];
    expect(canColetarAssinatura(permissoes)).toBe(false);
  });

  it('retorna false para acesso ao módulo documentos sem coletar_assinatura', () => {
    const permissoes = [
      buildMatrixKey('documentos', '_tela', 'visualizar'),
      buildMatrixKey('documentos', 'consultar', 'visualizar'),
    ];
    expect(canColetarAssinatura(permissoes)).toBe(false);
  });

  it('retorna true quando tem coletar_assinatura + outras permissões', () => {
    const permissoes = [
      'documentos.visualizar',
      'documentos.coletar_assinatura',
      'chamados.gerenciar',
    ];
    expect(canColetarAssinatura(permissoes)).toBe(true);
  });
});
