import { describe, expect, it } from 'vitest';
import { hasAdminTabAccess } from './permissions-matrix';

/** #292 · front igual à API: chave exata só na aba Próprios; demais abas mantêm o legado. */
const ABAS = [
  { tab: 'categorias_vistoria', legado: 'checklists.gerenciar', acao: 'alterar' },
  { tab: 'auditoria', legado: 'auditoria.visualizar', acao: 'visualizar' },
  { tab: 'permissoes', legado: 'permissoes.gerenciar', acao: 'alterar' },
  { tab: 'secretarias', legado: 'secretarias.gerenciar', acao: 'alterar' },
  { tab: 'tipos_proprio', legado: 'unidades.gerenciar', acao: 'alterar' },
  { tab: 'importacao', legado: 'unidades.gerenciar', acao: 'executar' },
] as const;

describe('292 · hasAdminTabAccess: chave exata só em Próprios', () => {
  for (const { tab, legado, acao } of ABAS) {
    it(`${tab}: proprios.visualizar + ${legado} continua vendo/agindo na aba (a API libera)`, () => {
      const permissoes = ['matriz.admin.proprios.visualizar', legado];
      expect(hasAdminTabAccess(tab, 'visualizar', permissoes)).toBe(true);
      expect(hasAdminTabAccess(tab, acao, permissoes)).toBe(true);
    });
  }

  it('outras abas: usuarios.gerenciar legado continua valendo com chave de Próprios', () => {
    const permissoes = ['matriz.admin.proprios.visualizar', 'usuarios.gerenciar'];
    for (const { tab } of ABAS) expect(hasAdminTabAccess(tab, 'visualizar', permissoes)).toBe(true);
  });

  it('Próprios: com matriz.admin.proprios.*, unidades.gerenciar / usuarios.gerenciar não liberam escrita', () => {
    const permissoes = ['matriz.admin.proprios.visualizar', 'unidades.gerenciar', 'usuarios.gerenciar'];
    expect(hasAdminTabAccess('proprios', 'visualizar', permissoes)).toBe(true);
    for (const acao of ['inserir', 'alterar', 'excluir'] as const) {
      expect(hasAdminTabAccess('proprios', acao, permissoes)).toBe(false);
    }
  });

  it('Próprios sem chave matriz.admin.proprios.*: legado segue como na main', () => {
    expect(hasAdminTabAccess('proprios', 'alterar', ['unidades.gerenciar'])).toBe(true);
    expect(hasAdminTabAccess('proprios', 'alterar', ['matriz.admin.usuarios.visualizar', 'unidades.gerenciar'])).toBe(true);
  });

  it('sem chave da aba nem legado, nada é liberado', () => {
    expect(hasAdminTabAccess('categorias_vistoria', 'visualizar', ['matriz.admin.proprios.visualizar'])).toBe(false);
  });
});
