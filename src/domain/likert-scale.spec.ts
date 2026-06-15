import { describe, expect, it } from 'vitest';
import {
  inferConformidadeFromLikert,
  LIKERT_CATALOGO,
  parseLikertConfig,
  resolveLikertNivel,
} from './likert-scale';

describe('likert-scale', () => {
  it('usa catalogo fixo com ponto neutro em 5', () => {
    expect(LIKERT_CATALOGO.REGULAR).toEqual({
      id: 'REGULAR',
      label: 'Regular',
      categoria: 'NEUTRA',
      pontuacao: 5,
    });
  });

  it('migra opcoes legadas por rotulo', () => {
    const config = parseLikertConfig({ opcoes: ['Péssimo', 'Bom', 'Ótimo'] });
    expect(config.niveis.map((nivel) => nivel.id)).toEqual(['PESSIMO', 'BOM', 'OTIMO']);
  });

  it('infere conformidade por categoria', () => {
    expect(inferConformidadeFromLikert(LIKERT_CATALOGO.RUIM)).toBe('NAO_CONFORME');
    expect(inferConformidadeFromLikert(LIKERT_CATALOGO.REGULAR)).toBe('CONFORME');
    expect(inferConformidadeFromLikert(LIKERT_CATALOGO.OTIMO)).toBe('CONFORME');
  });

  it('resolve nivel por id ou rotulo', () => {
    expect(resolveLikertNivel('BOM')?.pontuacao).toBe(8);
    expect(resolveLikertNivel('Bom')?.id).toBe('BOM');
  });
});
