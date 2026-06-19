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
  MapBasemap,
} from '@/lib/franca-geo';
import { escapeHtml } from '@/lib/security';
import { ChamadoMapPoint } from '@/lib/types';
import { chamadoPinColor, chamadoPinIcon } from '@/lib/chamado-map-pin';
import { MapViewControls } from '@/components/map/map-view-controls';

function formatDateBr(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR');
}

function createChamadoIcon(point: ChamadoMapPoint, emphasis: 'normal' | 'hover' | 'selected') {
  const scale = emphasis === 'selected' ? 1.28 : emphasis === 'hover' ? 1.12 : 1;
  const color = chamadoPinColor(point.prioridade);
  const icon = chamadoPinIcon(Boolean(point.programado));
  const ring =
    emphasis === 'selected'
      ? `0 0 0 4px color-mix(in srgb, ${color} 28%, transparent), 0 6px 16px rgba(15,27,45,.4)`
      : '0 3px 8px rgba(15,27,45,.35)';

  return L.divIcon({
    className: 'sigma-map-marker',
    html: `<span style="
      display:grid;place-items:center;width:26px;height:26px;
      background:${color};border:2px solid #fff;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg) scale(${scale});
      box-shadow:${ring};
      color:#fff;font-size:11px;font-weight:700;
    "><b style="transform:rotate(45deg);display:block;line-height:1;">${icon}</b></span>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
  });
}

function buildPopupHtml(point: ChamadoMapPoint, actionLabel: string) {
  const programado = point.programado ? formatDateBr(point.previstaExecucaoEm) : null;
  const prazo = point.prazoEm ? formatDateBr(point.prazoEm) : null;
  return `
    <div style="min-width:240px;font-family:system-ui,sans-serif;">
      <strong style="display:block;font-size:13px;color:#0066cc;">${escapeHtml(point.codigo)}</strong>
      <span style="display:block;margin-top:4px;font-size:13px;color:#0f1b2d;font-weight:600;">${escapeHtml(point.titulo)}</span>
      <span style="display:block;margin-top:4px;font-size:12px;color:#647389;">${escapeHtml(point.unidadeNome)}</span>
      ${programado ? `<span style="display:block;margin-top:6px;font-size:12px;color:#647389;">Data programada: <strong>${escapeHtml(programado)}</strong></span>` : ''}
      ${point.equipeNome ? `<span style="display:block;margin-top:4px;font-size:12px;color:#647389;">Equipe: <strong>${escapeHtml(point.equipeNome)}</strong></span>` : ''}
      <span style="display:block;margin-top:4px;font-size:12px;color:#647389;">Prioridade: <strong>${escapeHtml(point.prioridade)}</strong></span>
      ${prazo ? `<span style="display:block;margin-top:4px;font-size:12px;color:#647389;">Prazo: <strong>${escapeHtml(prazo)}</strong></span>` : ''}
      <button type="button" data-chamado-id="${point.id}" style="display:inline-block;margin-top:10px;font-size:12px;font-weight:700;color:#0066cc;background:none;border:0;padding:0;cursor:pointer;">
        ${escapeHtml(actionLabel)}
      </button>
    </div>
  `;
}

function refreshMapSize(map: L.Map) {
  map.invalidateSize({ animate: false });
  requestAnimationFrame(() => map.invalidateSize({ animate: false }));
}

export function ChamadosExecucaoMapClient({
  pontos,
  selectedId = null,
  hoveredId = null,
  onSelect,
  onHover,
  popupActionLabel = 'Executar chamado →',
}: {
  pontos: ChamadoMapPoint[];
  selectedId?: string | null;
  hoveredId?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  popupActionLabel?: string;
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const streetLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  const labelsLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.MarkerClusterGroup | null>(null);
  const markerByIdRef = useRef<Map<string, L.Marker>>(new Map());
  const pontoByIdRef = useRef<Map<string, ChamadoMapPoint>>(new Map());
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  const popupActionLabelRef = useRef(popupActionLabel);
  const [containerReady, setContainerReady] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [basemap, setBasemap] = useState<MapBasemap>('street');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const located = useMemo(() => pontos.map((ponto) => ({ ponto, latLng: [ponto.latitude, ponto.longitude] as L.LatLngTuple })), [pontos]);

  onSelectRef.current = onSelect;
  onHoverRef.current = onHover;
  popupActionLabelRef.current = popupActionLabel;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setContainerReady(node.clientWidth > 0 && node.clientHeight > 0));
    observer.observe(node);
    setContainerReady(node.clientWidth > 0 && node.clientHeight > 0);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
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
    }).addTo(map);

    map.on('popupopen', (event) => {
      const popup = event.popup.getElement();
      const button = popup?.querySelector<HTMLButtonElement>('button[data-chamado-id]');
      if (!button) return;
      button.onclick = () => {
        const id = button.dataset.chamadoId;
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
      markerByIdRef.current.clear();
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
    function onFullscreenChange() {
      setIsFullscreen(Boolean(shellRef.current && document.fullscreenElement === shellRef.current));
      if (mapRef.current) refreshMapSize(mapRef.current);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!mapReady || !map || !markersLayer) return;

    markersLayer.clearLayers();
    markerByIdRef.current.clear();
    pontoByIdRef.current.clear();

    located.forEach(({ ponto, latLng }) => {
      pontoByIdRef.current.set(ponto.id, ponto);
      const marker = L.marker(latLng, { icon: createChamadoIcon(ponto, 'normal') }).bindPopup(
        buildPopupHtml(ponto, popupActionLabelRef.current),
      );
      marker.on('mouseover', () => onHoverRef.current?.(ponto.id));
      marker.on('mouseout', () => onHoverRef.current?.(null));
      markersLayer.addLayer(marker);
      markerByIdRef.current.set(ponto.id, marker);
    });

    markersLayer.refreshClusters();

    if (located.length > 0) {
      const bounds = L.latLngBounds(located.map((item) => item.latLng));
      bounds.extend([
        [FRANCA_BOUNDS.southWest.lat, FRANCA_BOUNDS.southWest.lng],
        [FRANCA_BOUNDS.northEast.lat, FRANCA_BOUNDS.northEast.lng],
      ]);
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 14, animate: false });
    } else {
      map.setView([FRANCA_CENTER.lat, FRANCA_CENTER.lng], FRANCA_DEFAULT_ZOOM, { animate: false });
    }
  }, [located, mapReady, popupActionLabel]);

  useEffect(() => {
    markerByIdRef.current.forEach((marker, id) => {
      const ponto = pontoByIdRef.current.get(id);
      if (!ponto) return;
      const emphasis = id === selectedId ? 'selected' : id === hoveredId ? 'hover' : 'normal';
      marker.setIcon(createChamadoIcon(ponto, emphasis));
      if (id === selectedId) marker.openPopup();
    });
  }, [selectedId, hoveredId, located]);

  const toggleFullscreen = useCallback(async () => {
    const shell = shellRef.current;
    if (!shell) return;
    if (document.fullscreenElement === shell) {
      await document.exitFullscreen();
    } else if (shell.requestFullscreen) {
      await shell.requestFullscreen();
    }
    if (mapRef.current) refreshMapSize(mapRef.current);
  }, []);

  if (pontos.length === 0) {
    return (
      <div ref={shellRef} className="sigma-map-shell relative h-full w-full overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)]">
        <div ref={containerRef} className="sigma-map-canvas h-full min-h-[200px] w-full" />
        <MapViewControls
          basemap={basemap}
          onBasemapChange={setBasemap}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
        <div className="pointer-events-none absolute inset-x-0 top-3 z-[3] flex justify-center px-3">
          <div className="flex max-w-md items-start gap-2 rounded-[var(--r-md)] border border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-3 py-2 shadow-[var(--sh-sm)] backdrop-blur-sm">
            <MapPinOff className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ink-3)]" />
            <p className="text-left text-[12px] leading-snug text-[var(--ink-2)]">
              Nenhum chamado filtrado possui coordenadas. O mapa permanece disponível; ajuste filtros ou confira o GPS da unidade.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={shellRef} className="sigma-map-shell relative h-full w-full overflow-hidden rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] shadow-[var(--sh-sm)]">
      <div ref={containerRef} className="sigma-map-canvas h-full min-h-[200px] w-full" />
      <MapViewControls
        basemap={basemap}
        onBasemapChange={setBasemap}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />
    </div>
  );
}
