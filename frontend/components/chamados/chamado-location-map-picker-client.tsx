'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  CARTO_ATTRIBUTION,
  CARTO_SUBDOMAINS,
  CARTO_VOYAGER_NO_LABELS,
  FRANCA_BOUNDS,
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

export function ChamadoLocationMapPickerClient({
  latitude,
  longitude,
  onChange,
  className = '',
}: {
  latitude: number | null;
  longitude: number | null;
  onChange: (coords: { latitude: number; longitude: number }) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    configureLeafletIcons();
    if (!containerRef.current || mapRef.current) return;

    const initialLat = latitude ?? FRANCA_CENTER.lat;
    const initialLng = longitude ?? FRANCA_CENTER.lng;

    const map = L.map(containerRef.current, {
      center: [initialLat, initialLng],
      zoom: latitude != null ? 16 : FRANCA_DEFAULT_ZOOM,
      maxBounds: L.latLngBounds(
        [FRANCA_BOUNDS.southWest.lat, FRANCA_BOUNDS.southWest.lng],
        [FRANCA_BOUNDS.northEast.lat, FRANCA_BOUNDS.northEast.lng],
      ),
      maxBoundsViscosity: 0.85,
    });

    L.tileLayer(CARTO_VOYAGER_NO_LABELS, {
      attribution: CARTO_ATTRIBUTION,
      subdomains: CARTO_SUBDOMAINS,
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onChange({ latitude: pos.lat, longitude: pos.lng });
    });

    map.on('click', (event) => {
      marker.setLatLng(event.latlng);
      onChange({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    });

    mapRef.current = map;
    markerRef.current = marker;

    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (latitude == null || longitude == null || !mapRef.current || !markerRef.current) return;
    const next = L.latLng(latitude, longitude);
    markerRef.current.setLatLng(next);
    mapRef.current.panTo(next, { animate: true });
  }, [latitude, longitude]);

  return (
    <div
      className={`sigma-map-shell overflow-hidden rounded-[var(--r-md)] border border-[var(--line)] bg-[var(--surface)] ${className}`}
    >
      <div ref={containerRef} className="h-full min-h-[220px] w-full" />
      <p className="border-t border-[var(--line-2)] px-3 py-2 text-[11px] text-[var(--ink-3)]">
        Toque no mapa ou arraste o pin para ajustar o local exato.
      </p>
    </div>
  );
}
