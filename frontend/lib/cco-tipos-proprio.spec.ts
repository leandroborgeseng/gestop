import { describe, expect, it } from 'vitest';
import { chaveFiltrosTiposProprio, filtrosParaTiposProprio, podarTiposInvalidos } from './cco-tipos-proprio';

describe('312 · filtro Tipo de próprio (frontend)', () => {
  it('B2: pedido ignora o próprio filtro de tipo e mantém os demais', () => {
    const f = filtrosParaTiposProprio(
      { tipos: ['UBS'], tipo: 'ESCOLA', secretariaIds: ['s1'], bairros: ['Centro'] },
      { kpiFilter: 'none', defaultTiposPendencia: ['CHAMADOS'] },
    );
    expect(f.tipos).toBeUndefined();
    expect(f.tipo).toBeUndefined();
    expect(f.secretariaIds).toEqual(['s1']);
    expect(f.bairros).toEqual(['Centro']);
    expect(f.tiposPendencia).toEqual(['CHAMADOS']);
  });

  it('chave não muda quando só o tipo muda (filtros sem tipo)', () => {
    const o = { kpiFilter: 'none' as const, defaultTiposPendencia: [] };
    expect(chaveFiltrosTiposProprio(filtrosParaTiposProprio({ tipos: ['A'], bairros: ['x'] }, o))).toBe(
      chaveFiltrosTiposProprio(filtrosParaTiposProprio({ tipos: ['B'], bairros: ['x'] }, o)),
    );
  });

  it('B4: limpa só os tipos que deixaram de existir', () => {
    const disp = [{ codigo: 'UBS', nome: 'UBS' }];
    expect(podarTiposInvalidos(['UBS', 'ESCOLA'], disp)).toEqual(['UBS']);
    expect(podarTiposInvalidos(['ESCOLA'], disp)).toEqual([]);
    expect(podarTiposInvalidos(['UBS'], disp)).toBeNull();
    expect(podarTiposInvalidos([], [])).toBeNull();
  });
});
