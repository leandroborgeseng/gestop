/** Limites aproximados de Franca/SP — alinhado com frontend/lib/franca-geo.ts */
export const FRANCA_BOUNDS = {
  southWest: { lat: -20.58, lng: -47.48 },
  northEast: { lat: -20.49, lng: -47.34 },
} as const;

export function isWithinFrancaMunicipio(latitude: number, longitude: number) {
  return (
    latitude >= FRANCA_BOUNDS.southWest.lat &&
    latitude <= FRANCA_BOUNDS.northEast.lat &&
    longitude >= FRANCA_BOUNDS.southWest.lng &&
    longitude <= FRANCA_BOUNDS.northEast.lng
  );
}

export function skippedUnitsToGeoJson(
  units: Array<{ codigoPatrimonial: string; nome: string; latitude: number; longitude: number; reason: string }>,
) {
  return {
    type: 'FeatureCollection' as const,
    features: units.map((unit) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [unit.longitude, unit.latitude],
      },
      properties: {
        codigoPatrimonial: unit.codigoPatrimonial,
        nome: unit.nome,
        reason: unit.reason,
      },
    })),
  };
}
