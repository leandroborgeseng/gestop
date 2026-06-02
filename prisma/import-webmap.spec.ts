import { describe, expect, it } from 'vitest';
import { parseFeatureCollection } from './webmap-import-core';

describe('parseFeatureCollection', () => {
  it('extrai FeatureCollection de arquivo qgis2web', () => {
    const content = `
var json_test = {"type":"FeatureCollection","name":"test","features":[{"type":"Feature","properties":{"fid":"1","nome":"UBS Teste"},"geometry":{"type":"Point","coordinates":[-47.4,-20.53]}}]};
`;
    const collection = parseFeatureCollection(content, 'test.js');
    expect(collection.features).toHaveLength(1);
    expect(collection.features[0].properties.nome).toBe('UBS Teste');
  });
});
