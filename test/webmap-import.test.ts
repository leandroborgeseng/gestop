import { describe, expect, it } from 'vitest';
import { isWithinFrancaMunicipio, skippedUnitsToGeoJson } from '../prisma/webmap-geo';
import { parseFeatureCollection } from '../prisma/webmap-import-core';
import { inferLayerConfigForTest } from '../prisma/webmap-layers';

describe('webmap-geo', () => {
  it('aceita coordenadas dentro de Franca', () => {
    expect(isWithinFrancaMunicipio(-20.5386, -47.4007)).toBe(true);
  });

  it('rejeita coordenadas fora de Franca', () => {
    expect(isWithinFrancaMunicipio(-23.55, -46.63)).toBe(false);
  });

  it('gera GeoJSON de unidades ignoradas', () => {
    const geojson = skippedUnitsToGeoJson([
      {
        codigoPatrimonial: 'PMF-1',
        nome: 'Teste',
        latitude: -20.54,
        longitude: -47.4,
        reason: 'SECRETARIA_NAO_CADASTRADA',
      },
    ]);
    expect(geojson.features).toHaveLength(1);
    expect(geojson.features[0]?.geometry.coordinates).toEqual([-47.4, -20.54]);
  });
});

describe('parseFeatureCollection', () => {
  it('extrai FeatureCollection de arquivo qgis2web', () => {
    const content =
      'var json = {"type":"FeatureCollection","features":[{"type":"Feature","properties":{"fid":1},"geometry":{"type":"Point","coordinates":[-47.4,-20.54]}}]};';
    const parsed = parseFeatureCollection(content, 'test.js');
    expect(parsed.features).toHaveLength(1);
  });
});

describe('webmap-layers infer', () => {
  it('infere camada escolar como SME', () => {
    const layer = inferLayerConfigForTest('UnidadesEscolaresCreche35unid_70.js');
    expect(layer?.defaultSecretariaSigla).toBe('SME');
  });
});
