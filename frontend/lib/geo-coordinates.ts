export function parseGeoCoordinate(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function hasPlottableCoordinates(input: {
  latitude: unknown;
  longitude: unknown;
}): input is { latitude: number; longitude: number } {
  const latitude = parseGeoCoordinate(input.latitude);
  const longitude = parseGeoCoordinate(input.longitude);

  if (latitude === null || longitude === null) {
    return false;
  }

  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function toLatLngTuple(input: { latitude: unknown; longitude: unknown }): [number, number] | null {
  if (!hasPlottableCoordinates(input)) {
    return null;
  }

  return [input.latitude, input.longitude];
}
