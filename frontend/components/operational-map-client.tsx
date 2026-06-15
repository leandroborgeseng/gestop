'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { MapPinOff } from 'lucide-react';
import {
  CARTO_ATTRIBUTION,
  CARTO_SUBDOMAINS,
  CARTO_VOYAGER_LABELS,
  CARTO_VOYAGER_NO_LABELS,
  ESRI_SATELLITE_ATTRIBUTION,
  ESRI_SATELLITE_TILE_URL,
  FRANCA_BOUNDS,
  FRANCA_CENTER,
  FRANCA_DEFAULT_ZOOM,
  FRANCA_REFERENCIA_FREDERICO_MOURA,
  MapBasemap,
} from '@/lib/franca-geo';
import { hasPlottableCoordinates, toLatLngTuple } from '@/lib/geo-coordinates';
import { escapeHtml } from '@/lib/security';
import { UnidadeOperacional, UnidadeSituacao } from '@/lib/types';
import { MapViewControls } from '@/components/map/map-view-controls';
import { situacaoRailColor } from '@/components/status-badge';

const situacaoMarkerColor: Record<UnidadeSituacao, string> = {
  OPERACIONAL: '#15924e',
  COM_PENDENCIAS: '#b5680a',
  SEM_LOCALIZACAO: '#5b6b82',
  INATIVA: '#8a97a8',
};

function configureLeafletIcons() {
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

function createUnitIcon(color: string, emphasis: 'normal' | 'hover' | 'selected') {
  const scale = emphasis === 'selected' ? 1.32 : emphasis === 'hover' ? 1.14 : 1;
  const ring =
    emphasis === 'selected'
      ? `0 0 0 4px color-mix(in srgb, ${color} 28%, transparent), 0 6px 16px rgba(15,27,45,.4)`
      : '0 3px 8px rgba(15,27,45,.35)';

  return L.divIcon({
    className: 'sigma-map-marker',
    html: `<span style="
      display:grid;place-items:center;width:24px;height:24px;
      background:${color};border:2px solid #fff;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg) scale(${scale});
      box-shadow:${ring};
      transition:transform .14s ease, box-shadow .14s ease;
    "><b style="width:7px;height:7px;background:#fff;border-radius:50%;transform:rotate(45deg);display:block;"></b></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  });
}

function createReferenceIcon() {
  return L.divIcon({
    className: 'sigma-map-reference',
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:#0066cc;border:2px solid white;box-shadow:0 2px 8px rgba(0,102,204,.35);"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function buildPopupHtml(unidade: UnidadeOperacional) {
  const nome = escapeHtml(unidade.nome);
  const secretaria = escapeHtml(unidade.secretaria.sigla);
  const bairro = escapeHtml(unidade.bairro ?? 'bairro não informado');
  return `
    <div style="min-width:220px;font-family:system-ui,sans-serif;">
      <strong style="display:block;font-size:14px;color:#0f1b2d;">${nome}</strong>
      <span style="display:block;margin-top:4px;font-size:12px;color:#647389;">
        ${secretaria} · ${bairro}
      </span>
      <button type="button" data-unidade-id="${unidade.id}" style="display:inline-block;margin-top:10px;font-size:12px;font-weight:700;color:#0066cc;background:none;border:0;padding:0;cursor:pointer;">
        Ver detalhes →
      </button>
    </div>
  `;
}

function refreshMapSize(map: L.Map) {
  map.invalidateSize({ animate: false });
  requestAnimationFrame(() => map.invalidateSize({ animate: false }));
  window.setTimeout(() => map.invalidateSize({ animate: false }), 120);
  window.setTimeout(() => map.invalidateSize({ animate: false }), 400);
}

function fitMapToUnits(map: L.Map, located: Array<{ latLng: L.LatLngTuple }>) {
  if (located.length > 0) {
    const bounds = L.latLngBounds(located.map((item) => item.latLng));
    bounds.extend([FRANCA_REFERENCIA_FREDERICO_MOURA.lat, FRANCA_REFERENCIA_FREDERICO_MOURA.lng]);
    map.fitBounds(bounds, { padding: [28, 28], maxZoom: 13, animate: false });
    return;
  }

  map.fitBounds(
    L.latLngBounds(
      [FRANCA_BOUNDS.southWest.lat, FRANCA_BOUNDS.southWest.lng],
      [FRANCA_BOUNDS.northEast.lat, FRANCA_BOUNDS.northEast.lng],
    ),
    { padding: [24, 24], animate: false },
  );
}

function locatedFingerprint(unidades: UnidadeOperacional[]) {
  return unidades
    .filter((u) => hasPlottableCoordinates(u))
    .map((u) => `${u.id}:${u.latitude}:${u.longitude}:${u.situacao}`)
    .join('|');
}

export function OperationalMapClient({
  unidades,
  selectedId = null,
  hoveredId = null,
  onSelect,
  onHover,
}: {
  unidades: UnidadeOperacional[];
  selectedId?: string | null;
  hoveredId?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const streetLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  const labelsLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.MarkerClusterGroup | null>(null);
  const markerByIdRef = useRef<Map<string, L.Marker>>(new Map());
  const unidadeByIdRef = useRef<Map<string, UnidadeOperacional>>(new Map());
  const referenceMarkerRef = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  const lastFitKeyRef = useRef('');
  const lastContainerSizeRef = useRef({ width: 0, height: 0 });
  const refitTimerRef = useRef<number | null>(null);
  const locatedRef = useRef<Array<{ unidade: UnidadeOperacional; latLng: L.LatLngTuple }>>([]);
  const [containerReady, setContainerReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [basemap, setBasemap] = useState<MapBasemap>('street');
  const [fullscreenMode, setFullscreenMode] = useState<'off' | 'native' | 'fallback'>('off');
  const isFullscreen = fullscreenMode !== 'off';

  const located = useMemo(
    () =>
      unidades.flatMap((unidade) => {
        const latLng = toLatLngTuple(unidade);
        return latLng ? [{ unidade, latLng }] : [];
      }),
    [unidades],
  );

  const locatedKey = useMemo(() => locatedFingerprint(unidades), [unidades]);

  useEffect(() => {
    onSelectRef.current = onSelect;
    onHoverRef.current = onHover;
    locatedRef.current = located;
  }, [onSelect, onHover, located]);

  const scheduleRefit = useCallback((map: L.Map, reason: 'data' | 'layout') => {
    if (refitTimerRef.current) {
      window.clearTimeout(refitTimerRef.current);
    }

    refitTimerRef.current = window.setTimeout(() => {
      refreshMapSize(map);
      fitMapToUnits(map, locatedRef.current);
      if (reason === 'data') {
        lastFitKeyRef.current = locatedKey;
      }
    }, reason === 'layout' ? 420 : 80);
  }, [locatedKey]);

  const updateMarkerEmphasis = useCallback(
    (id: string, emphasis: 'normal' | 'hover' | 'selected') => {
      const marker = markerByIdRef.current.get(id);
      const unidade = unidadeByIdRef.current.get(id);
      if (!marker || !unidade) return;
      marker.setIcon(createUnitIcon(situacaoMarkerColor[unidade.situacao], emphasis));
    },
    [],
  );

  const markContainerReady = useCallback(() => {
    const node = containerRef.current;
    if (!node) return;
    if (node.offsetWidth > 0 && node.offsetHeight > 0) {
      setContainerReady(true);
    }
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    markContainerReady();

    const resizeObserver = new ResizeObserver(() => {
      markContainerReady();
      const map = mapRef.current;
      if (!map) return;

      const node = containerRef.current;
      if (!node) return;

      const width = node.offsetWidth;
      const height = node.offsetHeight;
      const prev = lastContainerSizeRef.current;
      const sizeChanged = Math.abs(width - prev.width) > 16 || Math.abs(height - prev.height) > 16;

      if (sizeChanged) {
        lastContainerSizeRef.current = { width, height };
        if (locatedRef.current.length > 0) {
          scheduleRefit(map, 'layout');
        } else {
          refreshMapSize(map);
        }
      }
    });
    resizeObserver.observe(node);

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && mapRef.current) {
          refreshMapSize(mapRef.current);
        }
      },
      { threshold: 0.01 },
    );
    intersectionObserver.observe(node);

    const handleWindowResize = () => {
      if (mapRef.current) refreshMapSize(mapRef.current);
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [markContainerReady, scheduleRefit]);

  const toggleFullscreen = useCallback(async () => {
    const shell = shellRef.current;
    const map = mapRef.current;
    if (!shell) return;

    if (fullscreenMode === 'fallback') {
      setFullscreenMode('off');
      if (map) refreshMapSize(map);
      return;
    }

    if (document.fullscreenElement === shell) {
      await document.exitFullscreen();
      if (map) refreshMapSize(map);
      return;
    }

    try {
      if (shell.requestFullscreen) {
        await shell.requestFullscreen();
        return;
      }
      setFullscreenMode('fallback');
      if (map) refreshMapSize(map);
    } catch {
      setFullscreenMode('fallback');
      if (map) refreshMapSize(map);
    }
  }, [fullscreenMode]);

  useEffect(() => {
    function onFullscreenChange() {
      const shell = shellRef.current;
      const map = mapRef.current;
      const native = Boolean(shell && document.fullscreenElement === shell);
      setFullscreenMode(native ? 'native' : 'off');
      if (map) refreshMapSize(map);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && fullscreenMode === 'fallback') {
        setFullscreenMode('off');
        if (mapRef.current) refreshMapSize(mapRef.current);
      }
    }

    document.addEventListener('fullscreenchange', onFullscreenChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [fullscreenMode]);

  useEffect(() => {
    configureLeafletIcons();
    if (!containerReady || !containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: true }).setView(
      [FRANCA_CENTER.lat, FRANCA_CENTER.lng],
      FRANCA_DEFAULT_ZOOM,
    );
    map.zoomControl.setPosition('bottomright');

    streetLayerRef.current = L.tileLayer(CARTO_VOYAGER_NO_LABELS, {
      attribution: CARTO_ATTRIBUTION,
      subdomains: CARTO_SUBDOMAINS,
      maxZoom: 20,
    });

    satelliteLayerRef.current = L.tileLayer(ESRI_SATELLITE_TILE_URL, {
      attribution: ESRI_SATELLITE_ATTRIBUTION,
      maxZoom: 19,
    });

    labelsLayerRef.current = L.tileLayer(CARTO_VOYAGER_LABELS, {
      attribution: CARTO_ATTRIBUTION,
      subdomains: CARTO_SUBDOMAINS,
      maxZoom: 20,
      pane: 'overlayPane',
    });

    streetLayerRef.current.addTo(map);

    markersLayerRef.current = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 56,
      spiderfyOnMaxZoom: true,
      animateAddingMarkers: false,
    }).addTo(map);

    referenceMarkerRef.current = L.marker(
      [FRANCA_REFERENCIA_FREDERICO_MOURA.lat, FRANCA_REFERENCIA_FREDERICO_MOURA.lng],
      { icon: createReferenceIcon() },
    )
      .bindPopup(`<strong>${FRANCA_REFERENCIA_FREDERICO_MOURA.label}</strong>`)
      .addTo(map);

    map.on('popupopen', (event) => {
      const popup = event.popup.getElement();
      const button = popup?.querySelector<HTMLButtonElement>('button[data-unidade-id]');
      if (!button) return;
      button.onclick = () => {
        const id = button.dataset.unidadeId;
        if (id) onSelectRef.current?.(id);
      };
    });

    mapRef.current = map;
    setMapReady(true);
    refreshMapSize(map);

    return () => {
      setMapReady(false);
      map.remove();
      mapRef.current = null;
      streetLayerRef.current = null;
      satelliteLayerRef.current = null;
      labelsLayerRef.current = null;
      markersLayerRef.current = null;
      referenceMarkerRef.current = null;
      markerByIdRef.current.clear();
      unidadeByIdRef.current.clear();
      lastFitKeyRef.current = '';
      if (refitTimerRef.current) {
        window.clearTimeout(refitTimerRef.current);
        refitTimerRef.current = null;
      }
    };
  }, [containerReady]);

  useEffect(() => {
    const map = mapRef.current;
    const street = streetLayerRef.current;
    const satellite = satelliteLayerRef.current;
    const labels = labelsLayerRef.current;
    if (!map || !street || !satellite || !labels) return;

    if (basemap === 'street') {
      if (map.hasLayer(satellite)) map.removeLayer(satellite);
      if (!map.hasLayer(street)) street.addTo(map);
      if (!map.hasLayer(labels)) labels.addTo(map);
    } else {
      if (map.hasLayer(street)) map.removeLayer(street);
      if (!map.hasLayer(satellite)) satellite.addTo(map);
      if (!map.hasLayer(labels)) labels.addTo(map);
    }
  }, [basemap, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!mapReady || !map || !markersLayer) return;

    markersLayer.clearLayers();
    markerByIdRef.current.clear();
    unidadeByIdRef.current.clear();

    located.forEach(({ unidade, latLng }) => {
      const marker = L.marker(latLng, {
        icon: createUnitIcon(situacaoMarkerColor[unidade.situacao], 'normal'),
      }).bindPopup(buildPopupHtml(unidade));

      marker.on('click', () => onSelectRef.current?.(unidade.id));
      marker.on('mouseover', () => onHoverRef.current?.(unidade.id));
      marker.on('mouseout', () => onHoverRef.current?.(null));

      markersLayer.addLayer(marker);
      markerByIdRef.current.set(unidade.id, marker);
      unidadeByIdRef.current.set(unidade.id, unidade);
    });

    markersLayer.refreshClusters();

    const shouldRefit = lastFitKeyRef.current !== locatedKey;
    if (shouldRefit) {
      scheduleRefit(map, 'data');
    } else {
      refreshMapSize(map);
    }
  }, [mapReady, locatedKey, located, scheduleRefit]);

  useEffect(() => {
    if (!mapReady) return;

    markerByIdRef.current.forEach((_, id) => updateMarkerEmphasis(id, 'normal'));
    if (hoveredId) updateMarkerEmphasis(hoveredId, 'hover');
    if (selectedId) {
      updateMarkerEmphasis(selectedId, 'selected');
      const marker = markerByIdRef.current.get(selectedId);
      const map = mapRef.current;
      if (marker && map) {
        map.panTo(marker.getLatLng(), { animate: true });
      }
    }
  }, [hoveredId, selectedId, updateMarkerEmphasis, mapReady]);

  const legendCounts = located.reduce(
    (acc, { unidade }) => {
      acc[unidade.situacao] += 1;
      return acc;
    },
    { OPERACIONAL: 0, COM_PENDENCIAS: 0, SEM_LOCALIZACAO: 0, INATIVA: 0 } as Record<UnidadeSituacao, number>,
  );

  return (
    <div className="cco-map-panel w-full">
      <div
        ref={shellRef}
        className={[
          'sigma-map-shell relative w-full overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] shadow-[var(--sh-sm)]',
          fullscreenMode === 'fallback' ? 'sigma-map-fullscreen fixed inset-0 z-[9999]' : '',
        ].join(' ')}
      >
        <div ref={containerRef} className="sigma-map-canvas" />

        <MapViewControls
          basemap={basemap}
          onBasemapChange={setBasemap}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => void toggleFullscreen()}
        />

        <div className="pointer-events-none absolute top-3.5 left-3.5 z-[500]">
          <span className="inline-flex items-center gap-1.5 rounded-[var(--r-pill)] border border-[var(--line)] bg-[rgba(255,255,255,0.94)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-2)] shadow-[var(--sh-sm)] backdrop-blur-md">
            <span className="mono text-[var(--brand)]">{located.length}</span> no mapa
            {unidades.length !== located.length ? (
              <span className="text-[var(--ink-3)]">· {unidades.length - located.length} sem GPS</span>
            ) : null}
          </span>
        </div>

        <div className="pointer-events-none absolute bottom-3.5 left-3.5 z-[500] min-w-[168px] rounded-[var(--r-md)] border border-[var(--line)] bg-[rgba(255,255,255,0.94)] p-3 shadow-[var(--sh-md)] backdrop-blur-md">
          <div className="mb-1.5 text-[10.5px] font-bold tracking-[0.05em] uppercase text-[var(--ink-3)]">Legenda</div>
          {(['OPERACIONAL', 'COM_PENDENCIAS', 'INATIVA'] as UnidadeSituacao[]).map((key) => (
            <div key={key} className="flex items-center gap-2 py-0.5 text-xs text-[var(--ink-2)]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: situacaoRailColor(key) }} />
              <span className="flex-1">{key === 'COM_PENDENCIAS' ? 'Pendências' : key === 'OPERACIONAL' ? 'Operacional' : 'Inativa'}</span>
              <b className="mono font-semibold text-[var(--ink)]">{legendCounts[key]}</b>
            </div>
          ))}
        </div>

        {located.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--surface)]/75 p-6">
            <div className="max-w-sm rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-5 text-center shadow-[var(--sh-md)]">
              <MapPinOff className="mx-auto mb-3 h-8 w-8 text-[var(--ink-3)]" />
              <h3 className="text-sm font-semibold text-[var(--ink)]">Nenhuma unidade com localização</h3>
              <p className="mt-1 text-xs text-[var(--ink-3)]">
                {unidades.length > 0
                  ? `${unidades.length} próprio(s) carregado(s), mas sem coordenadas válidas para o mapa.`
                  : 'Ajuste os filtros ou cadastre coordenadas nos próprios.'}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
