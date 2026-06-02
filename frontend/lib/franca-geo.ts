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

/** Limites aproximados do municipio para enquadrar a cidade */
export const FRANCA_BOUNDS = {
  southWest: { lat: -20.58, lng: -47.48 },
  northEast: { lat: -20.49, lng: -47.34 },
} as const;

export const FRANCA_DEFAULT_ZOOM = 13;

export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const ESRI_SATELLITE_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

export const ESRI_SATELLITE_ATTRIBUTION =
  'Tiles &copy; <a href="https://www.esri.com/">Esri</a>';

export type MapBasemap = 'street' | 'satellite';
