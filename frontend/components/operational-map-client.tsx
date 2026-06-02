'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { MapPinOff } from 'lucide-react';
import {
  ESRI_SATELLITE_ATTRIBUTION,
  ESRI_SATELLITE_TILE_URL,
  FRANCA_BOUNDS,
  FRANCA_CENTER,
  FRANCA_DEFAULT_ZOOM,
  FRANCA_REFERENCIA_FREDERICO_MOURA,
  MapBasemap,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
} from '@/lib/franca-geo';
import { escapeHtml } from '@/lib/security';
import { UnidadeOperacional, UnidadeSituacao } from '@/lib/types';
import { MapViewControls } from '@/components/map/map-view-controls';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const situacaoMarkerColor: Record<UnidadeSituacao, string> = {
  OPERACIONAL: '#16a34a',
  COM_PENDENCIAS: '#d97706',
  SEM_LOCALIZACAO: '#64748b',
  INATIVA: '#dc2626',
};

function configureLeafletIcons() {
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

function createUnitIcon(color: string) {
  return L.divIcon({
    className: 'gestop-map-marker',
    html: `<span style="
      display:block;
      width:18px;
      height:18px;
      border-radius:9999px;
      background:${color};
      border:3px solid white;
      box-shadow:0 4px 12px rgba(15,23,42,.25);
    "></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function createReferenceIcon() {
  return L.divIcon({
    className: 'gestop-map-reference',
    html: `<span style="
      display:block;
      width:14px;
      height:14px;
      border-radius:9999px;
      background:#0066cc;
      border:2px solid white;
      box-shadow:0 2px 8px rgba(0,102,204,.35);
    "></span>`,
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
      <strong style="display:block;font-size:14px;color:#0f172a;">${nome}</strong>
      <span style="display:block;margin-top:4px;font-size:12px;color:#475569;">
        ${secretaria} · ${bairro}
      </span>
      <a
        href="/cco/unidades/${unidade.id}"
        style="display:inline-block;margin-top:10px;font-size:12px;font-weight:700;color:#0066cc;"
      >
        Ver detalhes →
      </a>
    </div>
  `;
}

function refreshMapSize(map: L.Map) {
  map.invalidateSize({ animate: false });

  requestAnimationFrame(() => {
    map.invalidateSize({ animate: false });
  });

  window.setTimeout(() => {
    map.invalidateSize({ animate: false });
  }, 120);

  window.setTimeout(() => {
    map.invalidateSize({ animate: false });
  }, 400);
}

export function OperationalMapClient({ unidades }: { unidades: UnidadeOperacional[] }) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const streetLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.MarkerClusterGroup | null>(null);
  const referenceMarkerRef = useRef<L.Marker | null>(null);
  const [containerReady, setContainerReady] = useState(false);
  const [basemap, setBasemap] = useState<MapBasemap>('street');
  const [fullscreenMode, setFullscreenMode] = useState<'off' | 'native' | 'fallback'>('off');
  const isFullscreen = fullscreenMode !== 'off';

  const located = unidades.filter(
    (unidade) => unidade.latitude !== null && unidade.longitude !== null,
  );
  const semLocalizacao = unidades.length - located.length;

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
      if (mapRef.current) {
        refreshMapSize(mapRef.current);
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
      if (mapRef.current) {
        refreshMapSize(mapRef.current);
      }
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [markContainerReady]);

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

    if (!containerReady || !containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([FRANCA_CENTER.lat, FRANCA_CENTER.lng], FRANCA_DEFAULT_ZOOM);

    map.zoomControl.setPosition('bottomright');

    streetLayerRef.current = L.tileLayer(OSM_TILE_URL, {
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19,
    });

    satelliteLayerRef.current = L.tileLayer(ESRI_SATELLITE_TILE_URL, {
      attribution: `${ESRI_SATELLITE_ATTRIBUTION} · ${OSM_ATTRIBUTION}`,
      maxZoom: 19,
    });

    streetLayerRef.current.addTo(map);

    markersLayerRef.current = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 56,
      spiderfyOnMaxZoom: true,
    }).addTo(map);

    referenceMarkerRef.current = L.marker(
      [FRANCA_REFERENCIA_FREDERICO_MOURA.lat, FRANCA_REFERENCIA_FREDERICO_MOURA.lng],
      { icon: createReferenceIcon() },
    )
      .bindPopup(
        `<div style="font-family:system-ui,sans-serif;">
          <strong style="display:block;font-size:13px;color:#0f172a;">${FRANCA_REFERENCIA_FREDERICO_MOURA.label}</strong>
          <span style="display:block;margin-top:4px;font-size:12px;color:#475569;">
            ${FRANCA_REFERENCIA_FREDERICO_MOURA.bairro} · Franca/SP
          </span>
          <span style="display:block;margin-top:6px;font-size:11px;color:#64748b;">
            ${FRANCA_REFERENCIA_FREDERICO_MOURA.lat.toFixed(6)}, ${FRANCA_REFERENCIA_FREDERICO_MOURA.lng.toFixed(6)}
          </span>
        </div>`,
      )
      .addTo(map);

    mapRef.current = map;
    refreshMapSize(map);

    return () => {
      map.remove();
      mapRef.current = null;
      streetLayerRef.current = null;
      satelliteLayerRef.current = null;
      markersLayerRef.current = null;
      referenceMarkerRef.current = null;
    };
  }, [containerReady]);

  useEffect(() => {
    const map = mapRef.current;
    const streetLayer = streetLayerRef.current;
    const satelliteLayer = satelliteLayerRef.current;

    if (!map || !streetLayer || !satelliteLayer) {
      return;
    }

    if (basemap === 'street') {
      if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
      if (!map.hasLayer(streetLayer)) streetLayer.addTo(map);
    } else {
      if (map.hasLayer(streetLayer)) map.removeLayer(streetLayer);
      if (!map.hasLayer(satelliteLayer)) satelliteLayer.addTo(map);
    }
  }, [basemap]);

  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;

    if (!map || !markersLayer) {
      return;
    }

    markersLayer.clearLayers();

    located.forEach((unidade) => {
      const marker = L.marker([unidade.latitude as number, unidade.longitude as number], {
        icon: createUnitIcon(situacaoMarkerColor[unidade.situacao]),
      }).bindPopup(buildPopupHtml(unidade));

      markersLayer.addLayer(marker);
    });

    if (located.length > 0) {
      const bounds = L.latLngBounds(
        located.map((unidade) => [unidade.latitude as number, unidade.longitude as number] as L.LatLngTuple),
      );
      bounds.extend([
        FRANCA_REFERENCIA_FREDERICO_MOURA.lat,
        FRANCA_REFERENCIA_FREDERICO_MOURA.lng,
      ]);
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 });
    } else {
      map.fitBounds(
        L.latLngBounds(
          [FRANCA_BOUNDS.southWest.lat, FRANCA_BOUNDS.southWest.lng],
          [FRANCA_BOUNDS.northEast.lat, FRANCA_BOUNDS.northEast.lng],
        ),
        { padding: [24, 24] },
      );
    }

    refreshMapSize(map);
  }, [located]);

  return (
    <Card elevation={1} className="overflow-visible">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Mapa CCO</CardTitle>
          <CardDescription>
            Mapa de Franca/SP com clusters por concentração de próprios. Alterne mapa/satélite e maximize em tela cheia.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="brand">Referência: Frederico Moura, 1426</Badge>
          {semLocalizacao > 0 ? <Badge variant="muted">{semLocalizacao} sem localização</Badge> : null}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div
          ref={shellRef}
          className={[
            'gestop-map-shell relative overflow-hidden rounded-[var(--md-shape-md)] border border-[var(--md-outline-variant)]',
            fullscreenMode === 'fallback' ? 'gestop-map-fullscreen fixed inset-0 z-[9999]' : '',
          ].join(' ')}
        >
          <div ref={containerRef} className="gestop-map-canvas" />

          <MapViewControls
            basemap={basemap}
            onBasemapChange={setBasemap}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => void toggleFullscreen()}
          />

          {located.length === 0 ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--md-surface)]/75 p-6">
              <div className="max-w-sm rounded-[var(--md-shape-lg)] border border-[var(--md-outline-variant)] bg-[var(--md-surface)] p-5 text-center shadow-[var(--md-elevation-3)]">
                <MapPinOff className="mx-auto mb-3 h-8 w-8 text-[var(--md-on-surface-variant)]" />
                <h3 className="md-title-md text-[var(--md-on-surface)]">Nenhuma unidade com localização</h3>
                <p className="md-body-md mt-1 text-[var(--md-on-surface-variant)]">
                  O mapa exibe Franca/SP. Cadastre latitude e longitude nos próprios para ver os marcadores.
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 md-label-md text-[var(--md-on-surface-variant)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-emerald-600 ring-2 ring-white" />
            Operacional
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-amber-600 ring-2 ring-white" />
            Com pendências
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-600 ring-2 ring-white" />
            Inativa
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[var(--color-brand-primary)] ring-2 ring-white" />
            Referência Cidade Nova
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
