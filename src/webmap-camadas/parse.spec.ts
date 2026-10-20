import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLayersJs, parseStyle, readFeatures } from './parse';
import { simplificar, simplificarGeometria } from './core';

const FIX = join(__dirname, '../../test/fixtures/webmap-camadas');
const read = (p: string) => readFileSync(join(FIX, p), 'utf8');

describe('296 — parser qgis2web (fixtures locais, sem rede)', () => {
  it('lê grupos (1 nível), camadas, títulos e ordem de layers.js', () => {
    const r = parseLayersJs(read('v1/layers/layers.js'));
    expect(r.grupos.map((g) => g.titulo)).toEqual(['SECRETARIA_EDUCACAO', 'SECRETARIA_SAUDE', 'SISTEMA_VIARIO', 'AREAS_PUBLICAS', 'SANEAMENTO', 'PONTOS_VICIADOS']);
    expect(r.camadas).toHaveLength(8);
    expect(r.camadas.find((c) => c.variavel === 'LOTE252UNID7530210M_458')).toMatchObject({ grupo: 'AREAS_PUBLICAS', titulo: 'LOTE (252 UNID. / 75.302,10 M²)', ordem: 0 });
  });

  it('lê pontos, linhas e polígonos com atributos; elementos malformados viram erro sem derrubar a camada', () => {
    expect(readFeatures(read('v1/layers/VIAS_PRINCIPAIS_81.js'), 'VIAS').elementos[0]).toMatchObject({ familia: 'LINE', atributos: { NOME: 'Av. Brasil' } });
    expect(readFeatures(read('v1/layers/LOTE252UNID7530210M_458.js'), 'LOTE').elementos[0].familia).toBe('POLYGON');
    const eco = readFeatures(read('v2/layers/ECOPONTO3UNID_90.js'), 'ECOPONTO');
    expect(eco.elementos).toHaveLength(1);
    expect(eco.erros.map((e) => e.elemento)).toEqual(['2', '3']);
  });

  it('GeoJSON truncado = camada inteira ilegível (lança)', () => {
    expect(() => readFeatures(read('v_quebrada/layers/VIAS_PRINCIPAIS_81.js'), 'VIAS')).toThrow(/GeoJSON inválido/);
  });

  it('normaliza estilo: círculo, linha, preenchimento, ícone e categorias', () => {
    expect(parseStyle(read('v1/styles/CRECHE_PRE_ESCOLA45UNID_78_style.js'))).toMatchObject({ tipo: 'circle', raio: 8, preenchimento: 'rgba(252,205,229,1.0)', cor: 'rgba(35,35,35,1.0)' });
    expect(parseStyle(read('v1/styles/VIAS_PRINCIPAIS_81_style.js'))).toMatchObject({ tipo: 'line', cor: 'rgba(227,26,28,1.0)', largura: 3 });
    expect(parseStyle(read('v1/styles/PONTO_VICIADO_120_style.js'))).toMatchObject({ tipo: 'icon', icone: { origem: 'styles/ponto_viciado.svg' } });
    const ete = parseStyle(read('v1/styles/ETE_2_100_style.js'));
    expect(ete.atributoCategoria).toBe('TIPO');
    expect(ete.categorias).toEqual([{ valor: 'A', cor: 'rgba(35,35,35,1.0)', preenchimento: 'rgba(166,206,227,0.8)' }, { valor: 'B', cor: 'rgba(35,35,35,1.0)', preenchimento: 'rgba(31,120,180,0.8)' }]);
  });

  it('simplificação por zoom mantém extremos e anéis válidos', () => {
    const line = Array.from({ length: 101 }, (_, i) => [i / 100, Math.sin(i / 10) * 1e-6]);
    expect(simplificar(line, 1e-3)).toEqual([line[0], line[100]]);
    const poly = simplificarGeometria({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, 10);
    expect((poly.coordinates as number[][][])[0]).toHaveLength(4);
  });
});
