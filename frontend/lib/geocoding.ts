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

type NominatimItem = {
  display_name: string;
  lat: string;
  lon: string;
  class?: string;
  type?: string;
  addresstype?: string;
  importance?: number;
  boundingbox?: [string, string, string, string];
  address?: NominatimAddress;
};

const MICRO_AREA_PATTERN = /^(vila|jardim|parque|residencial|conjunto|loteamento|chácara|chacara)\b/i;
const ROAD_SEGMENT_PATTERN =
  /^(rua|avenida|av\.|travessa|rodovia|alameda|praça|praca|estrada|\d+)/i;
const MUNICIPALITY_PATTERN = /^franca(\s|-|,|$)/i;

function normalizeDistrict(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function isMunicipalityName(value: string, city?: string) {
  const normalized = normalizeDistrict(value).toLowerCase();
  if (MUNICIPALITY_PATTERN.test(normalized)) return true;
  if (city && normalized === normalizeDistrict(city).toLowerCase()) return true;
  return false;
}

function extractDistrictsFromDisplayName(displayName: string, city?: string) {
  const parts = displayName.split(',').map((part) => part.trim());
  const francaIndex = parts.findIndex((part) => MUNICIPALITY_PATTERN.test(part));
  if (francaIndex < 0) return [] as string[];

  return parts
    .slice(0, francaIndex)
    .map(normalizeDistrict)
    .filter(
      (part) =>
        part.length > 0 &&
        !ROAD_SEGMENT_PATTERN.test(part) &&
        !isMunicipalityName(part, city) &&
        !MICRO_AREA_PATTERN.test(part),
    );
}

export function collectDistrictCandidates(address?: NominatimAddress, displayName?: string) {
  const seen = new Set<string>();
  const candidates: string[] = [];
  const city = address?.city ?? address?.town ?? address?.municipality ?? 'Franca';

  function push(value?: string) {
    const normalized = value ? normalizeDistrict(value) : '';
    if (!normalized || isMunicipalityName(normalized, city)) return;
    if (MICRO_AREA_PATTERN.test(normalized) && candidates.some((item) => !MICRO_AREA_PATTERN.test(item))) {
      return;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(normalized);
  }

  push(address?.neighbourhood);
  push(address?.quarter);
  push(address?.district);
  push(address?.city_district);
  push(address?.suburb);

  for (const district of extractDistrictsFromDisplayName(displayName ?? '', city)) {
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

function normalizeStreetName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function formatGeocodeLabel(parsed: Partial<ParsedAddress>, fallbackDisplayName?: string) {
  const logradouro = parsed.logradouro?.trim() ?? '';
  const numero = parsed.numero?.trim() ?? '';
  const bairro = parsed.bairro?.trim() ?? '';
  const cidade = parsed.cidade?.trim() || 'Franca';
  const street = [logradouro, numero].filter(Boolean).join(', ');

  if (street && bairro) return `${street}, ${bairro}, ${cidade}`;
  if (street) {
    const sanitized = sanitizeDisplayNameLabel(fallbackDisplayName);
    const withoutCity = sanitized.replace(/,?\s*Franca\s*$/i, '').trim();
    if (withoutCity && !ROAD_SEGMENT_PATTERN.test(withoutCity) && normalizeStreetName(withoutCity) !== normalizeStreetName(street)) {
      return `${street}, ${withoutCity}, ${cidade}`;
    }
    return `${street}, ${cidade}`;
  }
  if (bairro) return `${bairro}, ${cidade}`;

  return sanitizeDisplayNameLabel(fallbackDisplayName);
}

function sanitizeDisplayNameLabel(displayName?: string) {
  if (!displayName) return '';

  const parts = displayName
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  const francaIndex = parts.findIndex((part) => MUNICIPALITY_PATTERN.test(part));
  const beforeCity = francaIndex >= 0 ? parts.slice(0, francaIndex) : parts.slice(0, 4);

  const cleaned = beforeCity.filter(
    (part) => !ROAD_SEGMENT_PATTERN.test(part) && !MICRO_AREA_PATTERN.test(part) && !isMunicipalityName(part),
  );

  if (cleaned.length === 0) {
    return parts.slice(0, 3).join(', ');
  }

  return [...cleaned, 'Franca'].join(', ');
}

function parseNominatimAddress(address?: NominatimAddress, displayName?: string): Partial<ParsedAddress> {
  if (!address) return {};

  const cidade = address.city ?? address.town ?? address.municipality ?? address.village ?? 'Franca';
  const candidates = collectDistrictCandidates(address, displayName);
  const bairro = pickBairro(candidates);

  return {
    logradouro: address.road ?? address.pedestrian ?? address.footway ?? '',
    numero: address.house_number ?? '',
    bairro,
    cidade,
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

function parseHouseNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}


function matchesStreet(item: NominatimItem, street: string) {
  const road = item.address?.road ?? item.address?.pedestrian ?? item.address?.footway ?? item.display_name;
  return normalizeStreetName(road ?? '').includes(normalizeStreetName(street));
}

function isBuildingResult(item: NominatimItem) {
  return item.class === 'building' || item.class === 'place' || item.addresstype === 'building';
}

function isRoadResult(item: NominatimItem) {
  return item.class === 'highway' || item.addresstype === 'road';
}

function interpolateHouseOnBoundingBox(
  boundingbox: [string, string, string, string],
  houseNumber: number,
  segmentIndex = 0,
  segmentCount = 1,
) {
  const [south, north, west, east] = boundingbox.map(Number);
  const span = Math.max(segmentCount, 1);
  const segmentOffset = Math.min(segmentIndex, span - 1) / span;
  const localT = Math.min(Math.max((houseNumber % 2000) / 2000, 0.05), 0.95);
  const t = Math.min(segmentOffset + localT / span, 0.98);

  return {
    latitude: south + (north - south) * t,
    longitude: west + (east - west) * t,
  };
}

function resolveCoordsFromItems(items: NominatimItem[], street: string, houseNumber: number | null) {
  const streetMatches = items.filter((item) => matchesStreet(item, street));
  const pool = streetMatches.length > 0 ? streetMatches : items;

  if (houseNumber) {
    const exactBuilding = pool.find(
      (item) =>
        isBuildingResult(item) &&
        parseHouseNumber(item.address?.house_number ?? '') === houseNumber,
    );
    if (exactBuilding) {
      return { latitude: Number(exactBuilding.lat), longitude: Number(exactBuilding.lon) };
    }

    const roads = pool.filter((item) => isRoadResult(item) && item.boundingbox?.length === 4);
    if (roads.length > 0) {
      const sortedRoads = [...roads].sort((left, right) => Number(right.importance ?? 0) - Number(left.importance ?? 0));
      const segmentIndex = Math.min(
        Math.floor((houseNumber / 2000) * sortedRoads.length),
        sortedRoads.length - 1,
      );
      const road = sortedRoads[segmentIndex];
      if (road?.boundingbox) {
        return interpolateHouseOnBoundingBox(road.boundingbox, houseNumber, segmentIndex, sortedRoads.length);
      }
    }
  }

  const first = pool[0];
  if (!first) return null;
  return { latitude: Number(first.lat), longitude: Number(first.lon) };
}

async function fetchNominatim(url: string): Promise<NominatimItem[]> {
  const response = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!response.ok) {
    throw new Error('Não foi possível buscar endereços agora.');
  }
  return (await response.json()) as NominatimItem[];
}

async function searchNominatimItems(query: string, limit = 6): Promise<NominatimItem[]> {
  const viewbox = `${FRANCA_BOUNDS.southWest.lng},${FRANCA_BOUNDS.southWest.lat},${FRANCA_BOUNDS.northEast.lng},${FRANCA_BOUNDS.northEast.lat}`;
  const params = new URLSearchParams({
    q: `${query.trim()}, Franca, SP, Brasil`,
    format: 'json',
    addressdetails: '1',
    limit: String(limit),
    countrycodes: 'br',
    viewbox,
    bounded: '1',
  });

  return fetchNominatim(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
}

async function searchStructuredNominatim(
  street: string,
  houseNumber: string,
  city: string,
  bairro: string,
  limit = 5,
): Promise<NominatimItem[]> {
  const params = new URLSearchParams({
    format: 'json',
    addressdetails: '1',
    limit: String(limit),
    countrycodes: 'br',
    street,
    city,
    state: 'São Paulo',
    country: 'Brazil',
  });

  if (houseNumber) params.set('housenumber', houseNumber);
  if (bairro) params.set('county', bairro);

  return fetchNominatim(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
}

export async function searchAddresses(query: string, limit = 6): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 4) return [];

  const items = await searchNominatimItems(trimmed, limit);

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
  const street = parts.logradouro.trim();
  const houseNumberRaw = parts.numero.trim();
  const city = parts.cidade.trim() || 'Franca';
  const bairro = parts.bairro.trim();
  const houseNumber = parseHouseNumber(houseNumberRaw);

  if (!street) return null;
  if (!houseNumber && !bairro && street.length < 4) return null;

  const structured = await searchStructuredNominatim(street, houseNumberRaw, city, bairro, 5);
  let coords = resolveCoordsFromItems(structured, street, houseNumber);

  if (!coords) {
    const freeText = await searchNominatimItems(buildGeocodeQuery(parts), 5);
    coords = resolveCoordsFromItems(freeText, street, houseNumber);
  }

  return coords;
}

// Test helpers
export function interpolateHouseOnBoundingBoxForTest(
  boundingbox: [string, string, string, string],
  houseNumber: number,
  segmentIndex = 0,
  segmentCount = 1,
) {
  return interpolateHouseOnBoundingBox(boundingbox, houseNumber, segmentIndex, segmentCount);
}

export function resolveCoordsFromItemsForTest(items: NominatimItem[], street: string, houseNumber: number | null) {
  return resolveCoordsFromItems(items, street, houseNumber);
}
