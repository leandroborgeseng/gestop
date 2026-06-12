import { FRANCA_BOUNDS } from '@/lib/franca-geo';

export type GeocodingResult = {
  label: string;
  latitude: number;
  longitude: number;
  bairro?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  cidade?: string | null;
};

export type ParsedAddress = {
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
};

const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'SIGMA/1.0 (chamados municipais)',
};

type NominatimAddress = {
  road?: string;
  pedestrian?: string;
  footway?: string;
  house_number?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  city?: string;
  town?: string;
  municipality?: string;
  village?: string;
};

function parseNominatimAddress(address?: NominatimAddress): Partial<ParsedAddress> {
  if (!address) return {};

  return {
    logradouro: address.road ?? address.pedestrian ?? address.footway ?? '',
    numero: address.house_number ?? '',
    bairro: address.suburb ?? address.neighbourhood ?? address.quarter ?? '',
    cidade: address.city ?? address.town ?? address.municipality ?? address.village ?? 'Franca',
  };
}

export function composeEnderecoTexto(parts: Pick<ParsedAddress, 'logradouro' | 'numero' | 'complemento' | 'cidade'>) {
  const logradouro = parts.logradouro.trim();
  const numero = parts.numero.trim();
  const complemento = parts.complemento.trim();
  const cidade = parts.cidade.trim();

  const ruaNumero = [logradouro, numero].filter(Boolean).join(', ');
  const withCompl = complemento ? `${ruaNumero} — ${complemento}` : ruaNumero;
  return cidade && !withCompl.toLowerCase().includes(cidade.toLowerCase()) ? `${withCompl} · ${cidade}` : withCompl;
}

export function buildGeocodeQuery(parts: Pick<ParsedAddress, 'logradouro' | 'numero' | 'bairro' | 'cidade'>) {
  const segments = [
    [parts.logradouro.trim(), parts.numero.trim()].filter(Boolean).join(' '),
    parts.bairro.trim(),
    parts.cidade.trim() || 'Franca',
    'SP',
    'Brasil',
  ].filter(Boolean);

  return segments.join(', ');
}

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
    address?: NominatimAddress;
  }>;

  return items.map((item) => {
    const parsed = parseNominatimAddress(item.address);
    return {
      label: item.display_name.split(',').slice(0, 4).join(', '),
      latitude: Number(item.lat),
      longitude: Number(item.lon),
      bairro: parsed.bairro ?? null,
      logradouro: parsed.logradouro ?? null,
      numero: parsed.numero ?? null,
      cidade: parsed.cidade ?? null,
    };
  });
}

export async function reverseGeocodeAddress(latitude: number, longitude: number): Promise<ParsedAddress | null> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'json',
    addressdetails: '1',
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    headers: NOMINATIM_HEADERS,
  });

  if (!response.ok) return null;

  const item = (await response.json()) as { address?: NominatimAddress };
  const parsed = parseNominatimAddress(item.address);

  return {
    logradouro: parsed.logradouro ?? '',
    numero: parsed.numero ?? '',
    complemento: '',
    bairro: parsed.bairro ?? '',
    cidade: parsed.cidade ?? 'Franca',
  };
}

/** @deprecated Use reverseGeocodeAddress */
export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  const parsed = await reverseGeocodeAddress(latitude, longitude);
  return parsed ? composeEnderecoTexto(parsed) : null;
}

export async function geocodeStructuredAddress(
  parts: Pick<ParsedAddress, 'logradouro' | 'numero' | 'bairro' | 'cidade'>,
): Promise<{ latitude: number; longitude: number } | null> {
  const query = buildGeocodeQuery(parts);
  if (query.replace(/[, ]/g, '').length < 6) return null;

  const results = await searchAddresses(query, 1);
  const first = results[0];
  if (!first) return null;

  return { latitude: first.latitude, longitude: first.longitude };
}
