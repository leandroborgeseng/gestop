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
  city_district?: string;
  district?: string;
  city?: string;
  town?: string;
  municipality?: string;
  village?: string;
};

const MICRO_AREA_PATTERN = /^(vila|jardim|parque|residencial|conjunto|loteamento|chácara|chacara)\b/i;
const ROAD_SEGMENT_PATTERN =
  /^(rua|avenida|av\.|travessa|rodovia|alameda|praça|praca|estrada|\d+)/i;

function normalizeDistrict(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function extractDistrictsFromDisplayName(displayName: string) {
  const parts = displayName.split(',').map((part) => part.trim());
  const francaIndex = parts.findIndex((part) => /^franca(\s|-|,|$)/i.test(part));
  if (francaIndex < 0) return [] as string[];

  return parts
    .slice(0, francaIndex)
    .map(normalizeDistrict)
    .filter((part) => part.length > 0 && !ROAD_SEGMENT_PATTERN.test(part));
}

export function collectDistrictCandidates(address?: NominatimAddress, displayName?: string) {
  const seen = new Set<string>();
  const candidates: string[] = [];

  function push(value?: string) {
    const normalized = value ? normalizeDistrict(value) : '';
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(normalized);
  }

  push(address?.suburb);
  push(address?.city_district);
  push(address?.district);

  for (const district of extractDistrictsFromDisplayName(displayName ?? '')) {
    push(district);
  }

  return candidates;
}

export function pickBairro(candidates: string[]) {
  if (candidates.length === 0) return '';

  const nonMicro = candidates.filter((candidate) => !MICRO_AREA_PATTERN.test(candidate));
  if (nonMicro.length > 0) return nonMicro[0];

  return candidates[0];
}

export function formatGeocodeLabel(parsed: Partial<ParsedAddress>, fallbackDisplayName?: string) {
  const logradouro = parsed.logradouro?.trim() ?? '';
  const numero = parsed.numero?.trim() ?? '';
  const bairro = parsed.bairro?.trim() ?? '';
  const cidade = parsed.cidade?.trim() || 'Franca';
  const street = [logradouro, numero].filter(Boolean).join(', ');

  if (street && bairro) return `${street}, ${bairro}, ${cidade}`;
  if (street) return `${street}, ${cidade}`;
  if (bairro) return `${bairro}, ${cidade}`;

  return fallbackDisplayName?.split(',').slice(0, 3).join(', ').trim() ?? '';
}

function parseNominatimAddress(address?: NominatimAddress, displayName?: string): Partial<ParsedAddress> {
  if (!address) return {};

  const candidates = collectDistrictCandidates(address, displayName);
  const bairro =
    pickBairro(candidates) ||
    normalizeDistrict(address.neighbourhood ?? '') ||
    normalizeDistrict(address.quarter ?? '');

  return {
    logradouro: address.road ?? address.pedestrian ?? address.footway ?? '',
    numero: address.house_number ?? '',
    bairro,
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
    const parsed = parseNominatimAddress(item.address, item.display_name);
    return {
      label: formatGeocodeLabel(parsed, item.display_name),
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

  const item = (await response.json()) as { display_name?: string; address?: NominatimAddress };
  const parsed = parseNominatimAddress(item.address, item.display_name);

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
