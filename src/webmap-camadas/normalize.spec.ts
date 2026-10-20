import { describe, expect, it } from 'vitest';
import { chaveCamada, nomeBase, nomeBaseDaVariavel, nomeBaseDoTitulo } from './normalize';

describe('296 D-296d — chave estável da camada', () => {
  it('CRECHE_PRE_ESCOLA45UNID_78: remove índice _78 e contagem 45UNID', () => {
    expect(nomeBaseDaVariavel('CRECHE_PRE_ESCOLA45UNID_78')).toBe('CRECHE_PRE_ESCOLA');
    expect(nomeBaseDoTitulo('CRECHE_PRE_ESCOLA (45 UNID.)')).toBe('CRECHE_PRE_ESCOLA');
    expect(chaveCamada('SECRETARIA_EDUCACAO', nomeBase('CRECHE_PRE_ESCOLA (45 UNID.)', 'CRECHE_PRE_ESCOLA45UNID_78'))).toBe(
      chaveCamada('SECRETARIA_EDUCACAO', nomeBase('CRECHE_PRE_ESCOLA (46 UNID.)', 'CRECHE_PRE_ESCOLA46UNID_77')),
    );
  });

  it("'ETE 2' e 'ETE 3' são camadas distintas (número interno é mantido)", () => {
    expect(nomeBase('ETE 2', 'ETE_2_100')).toBe('ETE_2');
    expect(nomeBase('ETE 3', 'ETE_3_101')).toBe('ETE_3');
    expect(nomeBaseDaVariavel('ETE_2_100')).not.toBe(nomeBaseDaVariavel('ETE_3_101'));
  });

  it('remove tokens de medida (M², KM, HA) e mantém números do nome', () => {
    expect(nomeBaseDoTitulo('LOTE (252 UNID. / 75.302,10 M²)')).toBe('LOTE');
    expect(nomeBaseDaVariavel('LOTE252UNID7530210M_458')).toBe('LOTE');
    expect(nomeBaseDaVariavel('FBDS_RIOS_SIMPLES_ZONA_RURAL74479KM_264')).toBe('FBDS_RIOS_SIMPLES_ZONA_RURAL');
    expect(nomeBaseDoTitulo('LEILAO_PROCESSO_7954/2025-37 (196 UNID. / 32.391,23 M²)')).toBe('LEILAO_PROCESSO_7954/2025-37');
  });

  it('maiúsculas e sem acento; renomear de fato muda a chave', () => {
    expect(nomeBaseDoTitulo('Área Verde (3 unid.)')).toBe('AREA_VERDE');
    expect(nomeBase('ETE 3 NORTE', 'ETE_3_NORTE_101')).not.toBe(nomeBase('ETE 3', 'ETE_3_101'));
  });
});
