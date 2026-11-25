import '@/test-utils/jsdom-global';
import { createElement, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CcoMapPainel } from './cco-map-painel';
import { criarDesenhoLeaflet, estiloLeaflet, WEBMAP_PANE, WEBMAP_PANE_Z } from './use-webmap-no-mapa';
import { abrirGrupos, alternarGrupoAberto, estadoCamadasPadrao } from '@/lib/cco-camadas';
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
      calorLigado: false, onCalor: vi.fn(), algumaLigada: ligada, onAlternarVarias: vi.fn(), statusWebmap: status, onTentarCamada,
    },
  } as never);

describe('298 · estado da camada no painel', () => {
  it('C2: carregando na própria camada (aria-busy)', () => {
    render(painel({ a: { estado: 'carregando' } }));
    expect(screen.getByTestId('webmap-status-carregando').textContent).toBe('Carregando…');
    expect(screen.getByLabelText('Rede de água').closest('label')!.getAttribute('aria-busy')).toBe('true');
  });
  it('C11: erro isolado com Tentar novamente', () => {
    const onTentarCamada = vi.fn();
    render(painel({ a: { estado: 'erro' } }, true, onTentarCamada));
    expect(screen.getByTestId('webmap-status-erro').textContent).toContain('Não foi possível exibir esta camada.');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
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

describe('300 · painel Webmap QGIS', () => {
  const pts: MapaCamada = { ...c1, id: 'webmap:p', camadaId: 'p', nomeOriginal: 'Hidrantes', geometriaTipo: 'Point', totalElementos: 3, totalInvalidos: 2, pesada: false };
  const arv2 = [{ id: 'g', titulo: 'Água', camadas: [c1, pts] }, { id: 'h', titulo: 'Drenagem', camadas: [{ ...pts, id: 'webmap:b', camadaId: 'b', nomeOriginal: 'Bocas de lobo', totalInvalidos: 0 }] }];
  const montar = (ligadas: string[], extra: Record<string, unknown> = {}) => {
    const onAlternarVarias = vi.fn();
    render(createElement(CcoMapPainel, {
      aba: 'camadas', onAba: vi.fn(), onFechar: vi.fn(), fullscreenMode: 'off', tituloAba: '', filtros: null, rascunhoPendente: false, avisoExterno: false,
      onLimpar: vi.fn(), onAplicar: vi.fn(), podeAplicar: false,
      camadas: {
        estado: { ...estadoCamadasPadrao(), ligadas: [...estadoCamadasPadrao().ligadas, ...ligadas], gruposAbertos: ['sigma', 'webmap', 'webmap-grupo:g'] },
        arvore: arv2, carregando: false, erro: false, onTentarNovamente: vi.fn(), onAlternar: vi.fn(), onAlternarGrupo: vi.fn(), onDesligarTodas: vi.fn(),
        calorLigado: false, onCalor: vi.fn(), algumaLigada: false, onAlternarVarias, statusWebmap: {}, onTentarCamada: vi.fn(), ...extra,
      },
    } as never));
    return { onAlternarVarias };
  };
  it('U1: grupo parcial => indeterminate/aria-checked=mixed; clique liga todas', () => {
    const { onAlternarVarias } = montar(['webmap:a']);
    const cb = screen.getByLabelText('Marcar todas as camadas de Água') as HTMLInputElement;
    expect(cb.indeterminate).toBe(true);
    expect(cb.getAttribute('aria-checked')).toBe('mixed');
    fireEvent.click(cb);
    expect(onAlternarVarias).toHaveBeenCalledWith(['webmap:a', 'webmap:p'], true);
  });
  it('U1: grupo cheio => clique desliga todas', () => {
    const { onAlternarVarias } = montar(['webmap:a', 'webmap:p']);
    fireEvent.click(screen.getByLabelText('Marcar todas as camadas de Água'));
    expect(onAlternarVarias).toHaveBeenCalledWith(['webmap:a', 'webmap:p'], false);
  });
  it('W13: camada ligada com inválidos mostra "2 elementos não exibidos"', () => {
    montar(['webmap:p']);
    expect(screen.getByTestId('webmap-status-invalidos').textContent).toBe('2 elementos não exibidos');
  });
  it('U2/W16: busca no topo, com a seção recolhida; digitar abre Webmap e só os grupos com resultado; limpar não recolhe', () => {
    function Host() {
      const [estado, setEstado] = useState({ ...estadoCamadasPadrao(), ligadas: [...estadoCamadasPadrao().ligadas, 'webmap:b'] });
      return createElement(CcoMapPainel, {
        aba: 'camadas', onAba: vi.fn(), onFechar: vi.fn(), fullscreenMode: 'off', tituloAba: '', filtros: null, rascunhoPendente: false, avisoExterno: false,
        onLimpar: vi.fn(), onAplicar: vi.fn(), podeAplicar: false,
        camadas: {
          estado, arvore: arv2, carregando: false, erro: false, onTentarNovamente: vi.fn(), onAlternar: vi.fn(),
          onAlternarGrupo: (g: string) => setEstado((e) => alternarGrupoAberto(e, g)), onDesligarTodas: vi.fn(),
          calorLigado: false, onCalor: vi.fn(), algumaLigada: false, onAlternarVarias: vi.fn(),
          onAbrirGrupos: (k: string[]) => setEstado((e) => abrirGrupos(e, k)), statusWebmap: {}, onTentarCamada: vi.fn(),
        },
      } as never);
    }
    render(createElement(Host));
    const painelEl = screen.getByTestId('cco-painel-camadas');
    const busca = screen.getByTestId('webmap-busca');
    expect(painelEl.firstElementChild).toBe(busca); // topo do painel, antes de SIGMA
    expect(screen.queryByTestId('webmap-grupo')).toBeNull(); // seção recolhida
    fireEvent.change(busca, { target: { value: 'BOCAS' } });
    expect(screen.getByTestId('cco-secao-webmap').querySelector('button')!.getAttribute('aria-expanded')).toBe('true');
    expect((screen.getByLabelText('Bocas de lobo') as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByLabelText('Rede de água')).toBeNull();
    fireEvent.change(busca, { target: { value: '' } });
    expect(screen.getByLabelText('Bocas de lobo')).toBeTruthy(); // limpar não recolhe
    const grupos = screen.getAllByTestId('webmap-grupo').map((g) => g.getAttribute('aria-expanded'));
    expect(grupos).toEqual(['false', 'true']); // Água segue fechado (sem resultado), Drenagem aberto
    fireEvent.change(busca, { target: { value: 'xyz' } });
    expect(screen.getByTestId('webmap-busca-vazia').textContent).toBe('Nenhuma camada encontrada para “xyz”.');
  });
  it('U3/W14: erro da lista ≠ vazio', () => {
    montar([], { erro: true });
    expect(screen.getByTestId('cco-camadas-erro').textContent).toContain('Não foi possível carregar as camadas do Webmap.');
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeTruthy();
    cleanup();
    montar([], { arvore: [] });
    expect(screen.getByTestId('cco-camadas-vazio').textContent).toBe('Nenhuma camada do Webmap foi importada ainda.');
  });
  it('300 QA2: 403 => "Seu perfil não tem acesso às camadas do Webmap." sem Tentar novamente', () => {
    montar([], { semAcesso: true, estado: { ...estadoCamadasPadrao(), gruposAbertos: ['sigma', 'webmap'] } });
    expect(screen.getByTestId('cco-camadas-sem-acesso').textContent).toBe('Seu perfil não tem acesso às camadas do Webmap.');
    expect(screen.queryByRole('button', { name: /Tentar/ })).toBeNull();
    expect(screen.queryByTestId('cco-camadas-erro')).toBeNull();
  });
  it('W17: pane do Webmap acima do calor (overlayPane 400) e abaixo dos pinos (600)', () => {
    expect(WEBMAP_PANE_Z).toBeGreaterThan(400);
    expect(WEBMAP_PANE_Z).toBeLessThan(600);
  });
});
