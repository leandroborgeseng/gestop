export type GeoPoint = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineDistanceMeters(from: GeoPoint, to: GeoPoint) {
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);

  const a =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function isWithinRadius(from: GeoPoint, to: GeoPoint, radiusMeters = 200) {
  return haversineDistanceMeters(from, to) <= radiusMeters;
}

export function isGpsAccuracyAcceptable(accuracyMeters: number, maxAccuracyMeters = 50) {
  return accuracyMeters > 0 && accuracyMeters <= maxAccuracyMeters;
}
