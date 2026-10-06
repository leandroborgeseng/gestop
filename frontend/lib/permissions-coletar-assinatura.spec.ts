import { describe, expect, it } from 'vitest';
import { ADMINISTRADOR_SISTEMA_NOME, isAdministradorSistemaAtivo } from './administrador-sistema';
import { canColetarAssinatura } from './can-coletar-assinatura';
import { buildMatrixKey } from './permissions-matrix';

describe('canColetarAssinatura (helper real, paridade com o guard)', () => {
  it('retorna false para usuarios.gerenciar sem ser Administrador do Sistema', () => {
    expect(canColetarAssinatura(['usuarios.gerenciar'], { perfis: ['Gestor'] })).toBe(false);
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

  it('retorna true para matriz.documentos.administrar.alterar (sessão crua)', () => {
    expect(canColetarAssinatura([buildMatrixKey('documentos', 'administrar', 'alterar')])).toBe(true);
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

  it('retorna true para Administrador do Sistema mesmo sem a chave', () => {
    expect(canColetarAssinatura([], { perfis: [ADMINISTRADOR_SISTEMA_NOME] })).toBe(true);
  });

  it('o bypass de admin equivale a isAdministradorSistemaAtivo (perfil ativo tem prioridade)', () => {
    const casos: Array<{ perfilAtivo?: { nome: string } | null; perfis?: string[] }> = [
      { perfilAtivo: { nome: ADMINISTRADOR_SISTEMA_NOME }, perfis: ['Gestor'] },
      { perfilAtivo: null, perfis: [ADMINISTRADOR_SISTEMA_NOME] },
      { perfilAtivo: { nome: 'Gestor' }, perfis: [ADMINISTRADOR_SISTEMA_NOME] },
      { perfis: ['Gestor'] },
    ];
    for (const user of casos) {
      expect(canColetarAssinatura([], user)).toBe(isAdministradorSistemaAtivo(user));
    }
  });
});
