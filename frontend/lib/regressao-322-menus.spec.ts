import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getGroupedNavItems, getMobileNav } from '@/lib/navigation';
import {
  catalogCheckboxLabel,
  PERMISSION_ACTION_LABELS,
  type PermissionAction,
  type PermissionCatalogFunction,
} from '@/lib/permissions-matrix';
import { PERMISSIONS_CATALOG, serializeCatalog, type PermissionFunctionDef } from '../../src/domain/permissions-catalog';
import { PERFIS_REGRESSAO_322 } from './regressao-322-perfis';

function rotulo(funcao: PermissionFunctionDef, acao: string) {
  return catalogCheckboxLabel(funcao as PermissionCatalogFunction, acao as PermissionAction);
}

/** Itens visíveis do menu lateral, da barra inferior e da matriz de Permissões. */
function montarRetratoMenusEMatriz() {
  const perfis = Object.fromEntries(
    Object.entries(PERFIS_REGRESSAO_322).map(([nome, perfil]) => {
      const grupos = getGroupedNavItems(perfil.permissoes, perfil.user);
      const mobile = getMobileNav(perfil.permissoes, perfil.user);
      return [
        nome,
        {
          lateral: grupos.map((grupo) => ({
            titulo: grupo.title,
            itens: grupo.items.map((item) => ({ id: item.id, label: item.label, href: item.href })),
          })),
          inferior: {
            primaria: mobile.primary.map((item) => ({
              id: item.id,
              label: item.shortLabel ?? item.label,
              href: item.href,
            })),
            secundaria: mobile.secondary.map((item) => ({ id: item.id, label: item.label, href: item.href })),
            mais: mobile.hasMore,
          },
        },
      ];
    }),
  );

  return {
    origem: 'main 6f7c642',
    colunasMatriz: Object.values(PERMISSION_ACTION_LABELS),
    perfis,
    matriz: PERMISSIONS_CATALOG.map((tela) => ({
      id: tela.id,
      label: tela.label,
      funcoes: tela.functions.map((funcao) => ({
        id: funcao.id,
        label: funcao.label,
        acoes: [...funcao.actions],
        celulas: funcao.actions.map((acao) => rotulo(funcao, acao)),
      })),
    })),
  };
}

const baseline = JSON.parse(readFileSync(resolve(__dirname, 'regressao-322-menus.baseline.json'), 'utf8')) as ReturnType<
  typeof montarRetratoMenusEMatriz
>;

describe('regressão 322 L6', () => {
  it('menu lateral, barra inferior e matriz de permissões permanecem iguais a main 6f7c642', () => {
    expect(montarRetratoMenusEMatriz()).toEqual(baseline);
  });

  it('o e2e serve o catálogo real e um rótulo alterado deixa de bater com o baseline', () => {
    const e2e = readFileSync(resolve(__dirname, '../e2e/322-regressao-menus.spec.ts'), 'utf8');
    expect(e2e).toContain("import { serializeCatalog } from './src/domain/permissions-catalog.ts'");
    expect(e2e).toContain('catalogo: CATALOGO_REAL');
    expect(e2e).toContain('expect(telas).toEqual(BASELINE.matriz.map((tela) => tela.label))');
    expect(e2e).not.toContain('catalogoDaMatriz');

    const servidas = serializeCatalog().map((tela) => tela.label);
    const congeladas = baseline.matriz.map((tela) => tela.label);
    expect(servidas).toEqual(congeladas);

    const alteradas = servidas.map((label, index) => (index === 0 ? `${label} (alterado)` : label));
    expect(alteradas).not.toEqual(congeladas);
  });
});
