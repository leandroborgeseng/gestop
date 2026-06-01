export type GeoPosition = {
  latitude: number;
  longitude: number;
  precisaoMetros: number;
  source: 'gps' | 'fallback';
};

export async function captureCurrentPosition(fallback?: GeoPosition): Promise<GeoPosition> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    if (fallback) return { ...fallback, source: 'fallback' };
    throw new Error('Geolocalização indisponível neste dispositivo.');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          precisaoMetros: Math.round(position.coords.accuracy),
          source: 'gps',
        });
      },
      (error) => {
        if (fallback) {
          resolve({ ...fallback, source: 'fallback' });
          return;
        }
        reject(new Error(error.message || 'Não foi possível obter a localização GPS.'));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  });
}
