'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  CARTO_ATTRIBUTION,
  CARTO_SUBDOMAINS,
  CARTO_VOYAGER_NO_LABELS,
  FRANCA_CENTER,
  FRANCA_DEFAULT_ZOOM,
} from '@/lib/franca-geo';

function configureLeafletIcons() {
  delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  });
}

function invalidateMapSize(map: L.Map) {
  map.invalidateSize({ animate: false });
  requestAnimationFrame(() => map.invalidateSize({ animate: false }));
  window.setTimeout(() => map.invalidateSize({ animate: false }), 120);
  window.setTimeout(() => map.invalidateSize({ animate: false }), 400);
}

export function ChamadoCoordMapEditor({
  latitude,
  longitude,
  editable,
  active = true,
  onChange,
}: {
  latitude: number | null;
  longitude: number | null;
  editable?: boolean;
  active?: boolean;
  onChange?: (coords: { latitude: number; longitude: number }) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    configureLeafletIcons();
    if (!containerRef.current || mapRef.current) return;

    const lat = latitude ?? FRANCA_CENTER.lat;
    const lng = longitude ?? FRANCA_CENTER.lng;

    const map = L.map(containerRef.current, { zoomControl: true }).setView([lat, lng], FRANCA_DEFAULT_ZOOM);
    L.tileLayer(CARTO_VOYAGER_NO_LABELS, {
      attribution: CARTO_ATTRIBUTION,
      subdomains: CARTO_SUBDOMAINS,
      maxZoom: 20,
    }).addTo(map);

    const marker = L.marker([lat, lng], { draggable: editable }).addTo(map);
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onChangeRef.current?.({ latitude: pos.lat, longitude: pos.lng });
    });

    if (editable) {
      map.on('click', (event) => {
        marker.setLatLng(event.latlng);
        onChangeRef.current?.({ latitude: event.latlng.lat, longitude: event.latlng.lng });
      });
    }

    mapRef.current = map;
    markerRef.current = marker;

    requestAnimationFrame(() => invalidateMapSize(map));

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [editable]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker || latitude == null || longitude == null) return;
    marker.setLatLng([latitude, longitude]);
    map.setView([latitude, longitude], map.getZoom(), { animate: false });
  }, [latitude, longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !active) return;
    invalidateMapSize(map);
  }, [active]);

  return <div ref={containerRef} className="h-[320px] w-full overflow-hidden rounded-[var(--r-md)] border border-[var(--line)]" />;
}
