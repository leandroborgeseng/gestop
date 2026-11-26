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

    // 285: no backend a exceção vem do flag `administradorSistema` do perfil ativo (sessão),
    // que o seed/migração liga só no perfil de sistema com esse nome. O front segue pelo nome.
    for (const user of casos) {
      // Na sessão do backend `perfis` = [nome do perfil ativo]; o flag acompanha esse perfil.
      const flag = (user.perfis ?? []).includes(ADMINISTRADOR_SISTEMA_NOME);
      const sessao = { perfis: [...(user.perfis ?? [])], administradorSistema: flag };
      expect(front.isAdministradorSistemaAtivo(user)).toBe(isAdministradorSistema(sessao));
    }
    expect(isAdministradorSistema({ perfis: [ADMINISTRADOR_SISTEMA_NOME] })).toBe(false);
  });
});
