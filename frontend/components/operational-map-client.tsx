'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapPinOff } from 'lucide-react';
import {
  FRANCA_BOUNDS,
  FRANCA_CENTER,
  FRANCA_DEFAULT_ZOOM,
  FRANCA_REFERENCIA_FREDERICO_MOURA,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
} from '@/lib/franca-geo';
import { UnidadeOperacional, UnidadeSituacao } from '@/lib/types';
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
  return `
    <div style="min-width:220px;font-family:system-ui,sans-serif;">
      <strong style="display:block;font-size:14px;color:#0f172a;">${unidade.nome}</strong>
      <span style="display:block;margin-top:4px;font-size:12px;color:#475569;">
        ${unidade.secretaria.sigla} · ${unidade.bairro ?? 'bairro não informado'}
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

export function OperationalMapClient({ unidades }: { unidades: UnidadeOperacional[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const referenceMarkerRef = useRef<L.Marker | null>(null);

  const located = unidades.filter(
    (unidade) => unidade.latitude !== null && unidade.longitude !== null,
  );
  const semLocalizacao = unidades.length - located.length;

  useEffect(() => {
    configureLeafletIcons();

    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([FRANCA_CENTER.lat, FRANCA_CENTER.lng], FRANCA_DEFAULT_ZOOM);

    L.tileLayer(OSM_TILE_URL, {
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);

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

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
      referenceMarkerRef.current = null;
    };
  }, []);

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
  }, [located]);

  return (
    <Card elevation={1}>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle>Mapa CCO</CardTitle>
          <CardDescription>Mapa de Franca/SP com próprios públicos georreferenciados.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="brand">Referência: Frederico Moura, 1426</Badge>
          {semLocalizacao > 0 ? <Badge variant="muted">{semLocalizacao} sem localização</Badge> : null}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
      <div className="relative overflow-hidden rounded-[var(--md-shape-md)] border border-[var(--md-outline-variant)]">
        <div ref={containerRef} className="h-[min(420px,60dvh)] w-full bg-[var(--md-surface-container-low)]" />

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
