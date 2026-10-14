import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { REQUIRED_ANY_PERMISSIONS_KEY, hasAnyPermission } from '../auth/permissions';
import type { JwtPayload } from '../auth/jwt';
import { ADMINISTRADOR_SISTEMA_NOME } from '../domain/permissions-catalog';
import { AdminController } from './admin.controller';
import { AdminImportController } from './admin-import.controller';

/**
 * #292 · a regra da chave exata vale só para Próprios. Um perfil com
 * `matriz.admin.proprios.visualizar` + a chave legada da aba continua entrando
 * nas outras abas da Administração (comportamento da main).
 */
type Ctrl = { prototype: object };

/** Handlers reais do controller cuja 1ª chave do guard é `matriz.admin.<tab>.*`. */
function rotasDaAba(ctrl: Ctrl, tab: string) {
  const proto = ctrl.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor' && typeof proto[name] === 'function')
    .map((name) => ({ name, keys: (Reflect.getMetadata(REQUIRED_ANY_PERMISSIONS_KEY, proto[name] as object) ?? []) as string[] }))
    .filter((r) => r.keys[0]?.startsWith(`matriz.admin.${tab}.`));
}

const u = (permissoes: string[], perfis = ['Gestor de Secretaria']): JwtPayload =>
  ({ sub: 'u-292', email: 'gestor@aion.local', nome: 'Gestor', perfis, permissoes }) as JwtPayload;

// Chaves legadas de cada aba (LEGACY_BY_TAB em src/domain/admin-permissions.ts), sem o `usuarios.gerenciar` genérico.
const ABAS: Array<{ nome: string; tab: string; ctrl: Ctrl; legado: string[] }> = [
  { nome: 'Categorias de vistoria', tab: 'categorias_vistoria', ctrl: AdminController, legado: ['checklists.gerenciar'] },
  { nome: 'Auditoria', tab: 'auditoria', ctrl: AdminController, legado: ['auditoria.visualizar'] },
  { nome: 'Permissões', tab: 'permissoes', ctrl: AdminController, legado: ['permissoes.gerenciar'] },
  { nome: 'Secretarias', tab: 'secretarias', ctrl: AdminController, legado: ['secretarias.gerenciar'] },
  { nome: 'Tipos de próprio', tab: 'tipos_proprio', ctrl: AdminController, legado: ['unidades.gerenciar'] },
  { nome: 'Importação', tab: 'importacao', ctrl: AdminImportController, legado: ['unidades.gerenciar'] },
];

describe('292 · outras abas da Administração mantêm o legado', () => {
  for (const aba of ABAS) {
    it(`${aba.nome}: proprios.visualizar + ${aba.legado.join(', ')} ainda entra em todas as rotas da aba`, () => {
      const rotas = rotasDaAba(aba.ctrl, aba.tab);
      expect(rotas.length).toBeGreaterThan(0);
      for (const legado of aba.legado) {
        const perfil = u(['matriz.admin.proprios.visualizar', legado]);
        for (const r of rotas) {
          expect(r.keys).toContain(legado);
          expect(hasAnyPermission(perfil, r.keys), `${r.name} com ${legado}`).toBe(true);
        }
      }
    });

    // Auditoria fica de fora: na main, qualquer chave `matriz.admin.*` já deriva `auditoria.visualizar`
    // (deriveLegacyPermissionKeys), então proprios.visualizar sozinho entra lá — comportamento antigo mantido.
    it(`${aba.nome}: proprios.visualizar sozinho segue a main (só Auditoria entra, via derivado)`, () => {
      for (const r of rotasDaAba(aba.ctrl, aba.tab)) {
        expect(hasAnyPermission(u(['matriz.admin.proprios.visualizar']), r.keys), r.name).toBe(aba.tab === 'auditoria');
      }
    });
  }

  it('usuarios.gerenciar legado (superusuário) continua valendo fora de Próprios mesmo com chave de Próprios', () => {
    const perfil = u(['matriz.admin.proprios.visualizar', 'usuarios.gerenciar']);
    for (const aba of ABAS) for (const r of rotasDaAba(aba.ctrl, aba.tab)) expect(hasAnyPermission(perfil, r.keys), r.name).toBe(true);
  });

  it('Próprios: com chave matriz.admin.proprios.*, unidades.gerenciar legado NÃO libera escrita', () => {
    const perfil = u(['matriz.admin.proprios.visualizar', 'unidades.gerenciar']);
    const rotas = rotasDaAba(AdminController, 'proprios');
    expect(rotas.length).toBeGreaterThan(0);
    for (const r of rotas) {
      expect(hasAnyPermission(perfil, r.keys), r.name).toBe(r.keys[0] === 'matriz.admin.proprios.visualizar');
    }
  });

  it('Próprios: sem nenhuma chave de Próprios, unidades.gerenciar legado segue como na main', () => {
    const perfil = u(['unidades.gerenciar']);
    for (const r of rotasDaAba(AdminController, 'proprios')) expect(hasAnyPermission(perfil, r.keys), r.name).toBe(true);
  });

  it('Admin do Sistema entra em todas as rotas, sem chave alguma (isAdministradorSistema)', () => {
    const admin = u([], [ADMINISTRADOR_SISTEMA_NOME]);
    for (const tab of ['proprios', ...ABAS.map((a) => a.tab)]) {
      const ctrl = tab === 'importacao' ? AdminImportController : AdminController;
      for (const r of rotasDaAba(ctrl, tab)) expect(hasAnyPermission(admin, r.keys), r.name).toBe(true);
    }
  });
});
