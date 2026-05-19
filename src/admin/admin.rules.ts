export function isValidLatitude(latitude: number) {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;
}

export function isValidLongitude(longitude: number) {
  return Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

export function normalizeSigla(sigla: string) {
  return sigla.trim().toUpperCase();
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function ensureGeoCoordinates(latitude: number, longitude: number) {
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
    throw new Error('Coordenadas geograficas invalidas');
  }
}
