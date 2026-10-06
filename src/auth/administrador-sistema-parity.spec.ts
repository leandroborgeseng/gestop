import { describe, expect, it } from 'vitest';
import { ADMINISTRADOR_SISTEMA_NOME } from '../domain/permissions-catalog';
import { isAdministradorSistema } from './permissions';

describe('paridade Administrador do Sistema front × backend', () => {
  it('o nome e a regra do front coincidem com o backend', async () => {
    const front = await import('../../frontend/lib/administrador-sistema.js');

    expect(front.ADMINISTRADOR_SISTEMA_NOME).toBe(ADMINISTRADOR_SISTEMA_NOME);
    expect(front.ADMINISTRADOR_SISTEMA_NOME).toBe('Administrador do Sistema');

    const casos: Array<{
      perfilAtivo?: { nome?: string } | null;
      perfis?: string[] | null;
    }> = [
      { perfis: [ADMINISTRADOR_SISTEMA_NOME] },
      { perfis: ['Gestor'] },
      { perfis: [] },
      { perfilAtivo: { nome: ADMINISTRADOR_SISTEMA_NOME }, perfis: [ADMINISTRADOR_SISTEMA_NOME] },
      { perfilAtivo: { nome: 'Gestor' }, perfis: ['Gestor'] },
      { perfilAtivo: null, perfis: [ADMINISTRADOR_SISTEMA_NOME] },
      { perfilAtivo: null, perfis: ['Gestor'] },
    ];

    for (const user of casos) {
      expect(front.isAdministradorSistemaAtivo(user)).toBe(isAdministradorSistema(user));
    }
  });
});
