import { FRANCA_BOUNDS } from '@/lib/franca-geo';

export type GeocodingResult = {
  label: string;
  latitude: number;
  longitude: number;
  bairro?: string | null;
};

const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'SIGMA/1.0 (chamados municipais)',
};

export async function searchAddresses(query: string, limit = 6): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 4) return [];

  const viewbox = `${FRANCA_BOUNDS.southWest.lng},${FRANCA_BOUNDS.southWest.lat},${FRANCA_BOUNDS.northEast.lng},${FRANCA_BOUNDS.northEast.lat}`;
  const params = new URLSearchParams({
    q: `${trimmed}, Franca, SP, Brasil`,
    format: 'json',
    addressdetails: '1',
    limit: String(limit),
    countrycodes: 'br',
    viewbox,
    bounded: '1',
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: NOMINATIM_HEADERS,
  });

  if (!response.ok) {
    throw new Error('Não foi possível buscar endereços agora.');
  }

  const items = (await response.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
    address?: { suburb?: string; neighbourhood?: string; quarter?: string };
  }>;

  return items.map((item) => ({
    label: item.display_name.split(',').slice(0, 3).join(', '),
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    bairro: item.address?.suburb ?? item.address?.neighbourhood ?? item.address?.quarter ?? null,
  }));
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'json',
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    headers: NOMINATIM_HEADERS,
  });

  if (!response.ok) return null;

  const item = (await response.json()) as { display_name?: string };
  return item.display_name?.split(',').slice(0, 3).join(', ') ?? null;
}
