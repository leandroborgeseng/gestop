/** Centro aproximado de Franca/SP */
export const FRANCA_CENTER = {
  lat: -20.5386,
  lng: -47.4007,
} as const;

/** Rua Frederico Moura, 1426 — Cidade Nova, Franca/SP (CEP 14401-150) */
export const FRANCA_REFERENCIA_FREDERICO_MOURA = {
  lat: -20.529182,
  lng: -47.3931428,
  label: 'Rua Frederico Moura, 1426',
  bairro: 'Cidade Nova',
} as const;

/**
 * Limites do município de Franca/SP (bbox da relation OSM 298530),
 * com pequena folga para navegação de borda.
 * south/north/west/east ≈ -20.7735 / -20.4159 / -47.5525 / -47.1456
 */
export const FRANCA_BOUNDS = {
  southWest: { lat: -20.78, lng: -47.56 },
  northEast: { lat: -20.41, lng: -47.14 },
} as const;

export const FRANCA_DEFAULT_ZOOM = 12;

export const FRANCA_MIN_ZOOM = 11;

export function isWithinFrancaMunicipio(latitude: number, longitude: number) {
  return (
    latitude >= FRANCA_BOUNDS.southWest.lat &&
    latitude <= FRANCA_BOUNDS.northEast.lat &&
    longitude >= FRANCA_BOUNDS.southWest.lng &&
    longitude <= FRANCA_BOUNDS.northEast.lng
  );
}

export function clampToFrancaMunicipio(latitude: number, longitude: number) {
  return {
    latitude: Math.min(Math.max(latitude, FRANCA_BOUNDS.southWest.lat), FRANCA_BOUNDS.northEast.lat),
    longitude: Math.min(Math.max(longitude, FRANCA_BOUNDS.southWest.lng), FRANCA_BOUNDS.northEast.lng),
  };
}

export const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

export const CARTO_VOYAGER_NO_LABELS =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png';

export const CARTO_VOYAGER_LABELS =
  'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png';

export const CARTO_SUBDOMAINS = 'abcd';

/** @deprecated use CARTO_VOYAGER_NO_LABELS */
export const OSM_TILE_URL = CARTO_VOYAGER_NO_LABELS;
export const OSM_ATTRIBUTION = CARTO_ATTRIBUTION;

export const ESRI_SATELLITE_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const ESRI_SATELLITE_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a>';

export type MapBasemap = 'street' | 'satellite';
