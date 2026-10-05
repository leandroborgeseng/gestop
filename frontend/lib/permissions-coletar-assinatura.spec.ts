import { describe, expect, it } from 'vitest';
import { buildMatrixKey, canColetarAssinatura } from './permissions-matrix';

describe('canColetarAssinatura (helper real)', () => {
  it('retorna true para usuarios.gerenciar', () => {
    expect(canColetarAssinatura(['usuarios.gerenciar'])).toBe(true);
  });

  it('retorna true para documentos.administrar', () => {
    expect(canColetarAssinatura(['documentos.administrar'])).toBe(true);
  });

  it('retorna true para documentos.coletar_assinatura (legado)', () => {
    expect(canColetarAssinatura(['documentos.coletar_assinatura'])).toBe(true);
  });

  it('retorna true para matriz.documentos.coletar_assinatura.executar', () => {
    expect(canColetarAssinatura([buildMatrixKey('documentos', 'coletar_assinatura', 'executar')])).toBe(
      true,
    );
  });

  it('retorna false com acesso ao módulo sem coletar_assinatura', () => {
    expect(
      canColetarAssinatura([
        'documentos.visualizar',
        buildMatrixKey('documentos', '_tela', 'visualizar'),
        buildMatrixKey('documentos', 'consultar', 'visualizar'),
      ]),
    ).toBe(false);
  });
});
