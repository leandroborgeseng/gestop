'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { FRANCA_BOUNDS, FRANCA_CENTER, OSM_ATTRIBUTION, OSM_TILE_URL } from '@/lib/franca-geo';
import { WebmapSkippedUnit } from '@/lib/types';

export function WebmapSkippedMap({ units }: { units: WebmapSkippedUnit[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || units.length === 0) return;

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        scrollWheelZoom: false,
      }).setView([FRANCA_CENTER.lat, FRANCA_CENTER.lng], 13);

      L.tileLayer(OSM_TILE_URL, { attribution: OSM_ATTRIBUTION }).addTo(mapRef.current);
      mapRef.current.fitBounds([
        [FRANCA_BOUNDS.southWest.lat, FRANCA_BOUNDS.southWest.lng],
        [FRANCA_BOUNDS.northEast.lat, FRANCA_BOUNDS.northEast.lng],
      ]);
    }

    const map = mapRef.current;
    const group = L.layerGroup();

    for (const unit of units) {
      const marker = L.circleMarker([unit.latitude, unit.longitude], {
        radius: 7,
        color: '#dc2626',
        fillColor: '#ef4444',
        fillOpacity: 0.85,
        weight: 2,
      });
      marker.bindPopup(
        `<strong>${unit.nome}</strong><br/>${unit.secretariaSigla}<br/><small>${unit.codigoPatrimonial}</small>`,
      );
      marker.addTo(group);
    }

    group.addTo(map);

    return () => {
      group.clearLayers();
    };
  }, [units]);

  if (units.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="h-72 w-full overflow-hidden rounded-[var(--md-shape-md)] border border-[var(--md-outline-variant)]"
    />
  );
}
