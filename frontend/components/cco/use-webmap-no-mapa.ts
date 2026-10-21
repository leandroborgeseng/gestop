'use client';

/**
 * 298 — desenha as camadas do Webmap LIGADAS no mapa Leaflet do CCO.
 * Canvas num pane próprio abaixo dos marcadores SIGMA (o marcador ganha o clique, crit. 9).
 * Balão somente leitura; Esc fecha e devolve o foco ao mapa (crit. 8).
 */
import { useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { getMapaCamadaGeojson } from '@/lib/api';
import type { MapaCamada } from '@/lib/types';
import { htmlBalao, limiteCacheBytes, type Desenho, type StatusCamadaWebmap, WebmapGerenciador } from '@/lib/webmap-mapa';

export const WEBMAP_PANE = 'webmapPane';
/** 300 W17: acima do calor (canvas no overlayPane = 400) e abaixo dos pinos (markerPane = 600). */
export const WEBMAP_PANE_Z = 450;

type LeafletNs = typeof import('leaflet');

export function estiloLeaflet(c: MapaCamada): Leaflet.PathOptions & { radius?: number } {
  const e = (c.estilo ?? {}) as Record<string, unknown>;
  const cor = typeof e.cor === 'string' ? e.cor : undefined;
  const preench = typeof e.preenchimento === 'string' ? e.preenchimento : undefined;
  const largura = typeof e.largura === 'number' ? e.largura : 1.5;
  const tipo = e.tipo;
  if (tipo === 'fill') return { color: cor ?? preench ?? '#8a97a8', weight: cor ? Math.max(0.5, largura) : 0.6, fillColor: preench ?? cor ?? '#8a97a8', fillOpacity: 1, opacity: 1 };
  if (tipo === 'circle' || tipo === 'icon') return { color: cor ?? '#233', weight: Math.max(0.5, largura || 1), fillColor: preench ?? cor ?? '#3d7cc9', fillOpacity: 1, radius: Math.min(8, Math.max(3, Number(e.raio) || 4)) };
  return { color: cor ?? '#3d7cc9', weight: Math.max(1, largura), fill: false };
}

export function criarDesenhoLeaflet(L: LeafletNs, map: Leaflet.Map): Desenho & { destruir: () => void } {
  if (!map.getPane(WEBMAP_PANE)) {
    const pane = map.createPane(WEBMAP_PANE);
    pane.style.zIndex = String(WEBMAP_PANE_Z);
  }
  const renderer = L.canvas({ pane: WEBMAP_PANE, padding: 0.2, tolerance: 6 }); // tolerância de toque em linhas finas
  const camadas = new Map<string, Leaflet.GeoJSON>();
  const onEsc = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape' && map.getContainer().querySelector('.webmap-balao')) {
      map.closePopup();
      map.getContainer().focus();
    }
  };
  document.addEventListener('keydown', onEsc);
  return {
    mostrar(c, feicoes) {
      camadas.get(c.camadaId)?.remove();
      const estilo = estiloLeaflet(c);
      const layer = L.geoJSON({ type: 'FeatureCollection', features: feicoes } as never, {
        pane: WEBMAP_PANE,
        style: () => ({ ...estilo, renderer }) as Leaflet.PathOptions,
        pointToLayer: (_f, latlng) => L.circleMarker(latlng, { ...estilo, renderer, pane: WEBMAP_PANE, radius: estilo.radius ?? 4 }),
        onEachFeature: (f, l) => {
          l.on('click', (ev: Leaflet.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(ev); // o clique no mapa (limpar seleção SIGMA) não fecha o balão
            L.popup({ maxWidth: 320, autoPan: true, className: 'webmap-popup' })
              .setLatLng(ev.latlng)
              .setContent(htmlBalao(c.nomeOriginal, (f.properties ?? null) as Record<string, unknown> | null))
              .openOn(map);
          });
        },
      });
      layer.addTo(map);
      camadas.set(c.camadaId, layer);
    },
    remover(id) {
      camadas.get(id)?.remove();
      camadas.delete(id);
    },
    destruir() {
      document.removeEventListener('keydown', onEsc);
      for (const l of camadas.values()) l.remove();
      camadas.clear();
    },
  };
}

/** Liga o gerenciador ao mapa. `ligadas`: camadas ligadas na sessão que existem na lista (L3). */
export function useWebmapNoMapa(map: Leaflet.Map | null, ligadas: MapaCamada[], onVersaoMudou: () => void) {
  const [status, setStatus] = useState<Record<string, StatusCamadaWebmap>>({});
  const gerRef = useRef<WebmapGerenciador | null>(null);
  const versaoRef = useRef(onVersaoMudou);
  versaoRef.current = onVersaoMudou;
  const ligadasRef = useRef(ligadas);
  ligadasRef.current = ligadas;

  useEffect(() => {
    if (!map) return;
    let ativo = true;
    let desenho: ReturnType<typeof criarDesenhoLeaflet> | null = null;
    let off = () => {};
    void import('leaflet').then((mod) => {
      const L = ((mod as { default?: LeafletNs }).default ?? mod) as LeafletNs;
      if (!ativo) return;
      desenho = criarDesenhoLeaflet(L, map);
      const ger = new WebmapGerenciador({
        buscar: (c, r, signal) => getMapaCamadaGeojson(c.camadaId, { bbox: r.bbox, zoom: r.zoom, versao: c.versaoAtual, signal }),
        desenho,
        onStatus: (s) => { if (ativo) setStatus(s); },
        onVersaoMudou: () => versaoRef.current(),
        cacheBytes: limiteCacheBytes(),
      });
      gerRef.current = ger;
      const vista = () => {
        const b = map.getBounds();
        return { bounds: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()] as [number, number, number, number], zoom: map.getZoom() };
      };
      const mover = () => ger.setVista(vista());
      map.on('moveend', mover);
      off = () => map.off('moveend', mover);
      ger.setVista(vista(), true);
      ger.setCamadas(ligadasRef.current);
    });
    return () => {
      ativo = false;
      off();
      gerRef.current?.dispose(); // cache descartado ao fechar o CCO (crit. 4)
      gerRef.current = null;
      desenho?.destruir();
    };
  }, [map]);

  const chave = ligadas.map((c) => `${c.camadaId}@${c.versaoAtual}`).join(',');
  useEffect(() => {
    gerRef.current?.setCamadas(ligadasRef.current);
  }, [chave]);

  return { status, tentarNovamente: (id: string) => gerRef.current?.tentarNovamente(id) };
}
