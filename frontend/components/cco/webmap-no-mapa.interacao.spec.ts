import '@/test-utils/jsdom-global';
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CcoMapPainel } from './cco-map-painel';
import { criarDesenhoLeaflet, estiloLeaflet, WEBMAP_PANE, WEBMAP_PANE_Z } from './use-webmap-no-mapa';
import { estadoCamadasPadrao } from '@/lib/cco-camadas';
import type { MapaCamada } from '@/lib/types';

afterEach(() => cleanup());

const c1: MapaCamada = { id: 'webmap:a', camadaId: 'a', nomeOriginal: 'Rede de água', geometriaTipo: 'LINE', estilo: { tipo: 'line', cor: 'rgba(1,1,226,1.0)', largura: 1.748 }, totalElementos: 69419, bbox: null, versaoAtual: 'v1', ligadaPorPadrao: false, pesada: true };
const arvore = [{ id: 'g', titulo: 'Água', camadas: [c1] }];
const painel = (status: Record<string, unknown>, ligada = true, onTentarCamada = vi.fn()) =>
  createElement(CcoMapPainel, {
    aba: 'camadas', onAba: vi.fn(), onFechar: vi.fn(), fullscreenMode: 'off', tituloAba: '', filtros: null, rascunhoPendente: false, avisoExterno: false,
    onLimpar: vi.fn(), onAplicar: vi.fn(), podeAplicar: false,
    camadas: {
      estado: { ...estadoCamadasPadrao(), ligadas: [...estadoCamadasPadrao().ligadas, ...(ligada ? ['webmap:a'] : [])], gruposAbertos: ['sigma', 'webmap', 'webmap-grupo:g'] },
      arvore, carregando: false, erro: false, onTentarNovamente: vi.fn(), onAlternar: vi.fn(), onAlternarGrupo: vi.fn(), onDesligarTodas: vi.fn(),
      calorLigado: false, onCalor: vi.fn(), algumaLigada: ligada, webmapAtivo: true, statusWebmap: status, onTentarCamada,
    },
  } as never);

describe('298 · estado da camada no painel (flag NEXT_PUBLIC_WEBMAP_CAMADAS_MAPA ligada)', () => {
  it('C2: carregando na própria camada (aria-busy)', () => {
    render(painel({ a: { estado: 'carregando' } }));
    expect(screen.getByTestId('webmap-status-carregando').textContent).toBe('Carregando…');
    expect(screen.getByLabelText('Rede de água').closest('label')!.getAttribute('aria-busy')).toBe('true');
  });
  it('C11: erro isolado com Tentar novamente', () => {
    const onTentarCamada = vi.fn();
    render(painel({ a: { estado: 'erro' } }, true, onTentarCamada));
    expect(screen.getByTestId('webmap-status-erro').textContent).toContain('Não foi possível carregar Rede de água.');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onTentarCamada).toHaveBeenCalledWith('a');
  });
  it('C6/L6: truncado => "Aproxime o mapa para ver todos os elementos de {camada}" (não é erro)', () => {
    render(painel({ a: { estado: 'ok', truncado: true } }));
    expect(screen.getByTestId('webmap-status-truncado').textContent).toBe('Aproxime o mapa para ver todos os elementos de Rede de água');
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('C7: fora da faixa => "visível a partir do zoom N"', () => {
    render(painel({ a: { estado: 'fora_zoom', minZoom: 15 } }));
    expect(screen.getByTestId('webmap-status-fora-zoom').textContent).toBe('visível a partir do zoom 15');
  });
  it('camada desligada não mostra estado', () => {
    render(painel({ a: { estado: 'erro' } }, false));
    expect(screen.queryByTestId('webmap-status-erro')).toBeNull();
  });
});

describe('298 · desenho no Leaflet', () => {
  it('C9: pane próprio abaixo dos marcadores SIGMA (markerPane = 600) e acima dos tiles', () => {
    expect(WEBMAP_PANE_Z).toBeLessThan(600);
    expect(WEBMAP_PANE_Z).toBeGreaterThan(200);
    const pane = document.createElement('div');
    const map = { getPane: vi.fn(() => undefined), createPane: vi.fn(() => pane), getContainer: () => document.createElement('div'), closePopup: vi.fn() };
    const L = { canvas: vi.fn(() => ({})), geoJSON: vi.fn(), circleMarker: vi.fn(), popup: vi.fn(), DomEvent: { stopPropagation: vi.fn() } };
    const d = criarDesenhoLeaflet(L as never, map as never);
    expect(map.createPane).toHaveBeenCalledWith(WEBMAP_PANE);
    expect(pane.style.zIndex).toBe(String(WEBMAP_PANE_Z));
    expect(L.canvas).toHaveBeenCalledWith(expect.objectContaining({ pane: WEBMAP_PANE }));
    d.destruir();
  });
  it('estilo da 296 vira estilo Leaflet (linha, polígono, ponto)', () => {
    expect(estiloLeaflet(c1)).toMatchObject({ color: 'rgba(1,1,226,1.0)', fill: false });
    expect(estiloLeaflet({ ...c1, estilo: { tipo: 'fill', preenchimento: 'rgba(250,235,221,0.75)' } })).toMatchObject({ fillColor: 'rgba(250,235,221,0.75)' });
    expect(estiloLeaflet({ ...c1, estilo: { tipo: 'circle', raio: 6, preenchimento: 'rgba(255,255,0,1.0)' } })).toMatchObject({ radius: 6, fillColor: 'rgba(255,255,0,1.0)' });
  });
});
