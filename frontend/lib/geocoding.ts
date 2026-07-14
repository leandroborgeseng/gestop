import { FRANCA_BOUNDS, FRANCA_CENTER, isWithinFrancaMunicipio } from '@/lib/franca-geo';

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

function normalizeForMatch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeStreetName(value: string) {
  return normalizeForMatch(value);
}

function francaViewbox() {
  return `${FRANCA_BOUNDS.southWest.lng},${FRANCA_BOUNDS.southWest.lat},${FRANCA_BOUNDS.northEast.lng},${FRANCA_BOUNDS.northEast.lat}`;
}

function isLikelyFrancaResult(item: NominatimItem) {
  const lat = Number(item.lat);
  const lon = Number(item.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon) && isWithinFrancaMunicipio(lat, lon)) {
    return true;
  }
  const text = normalizeForMatch(
    [item.display_name, item.address?.city, item.address?.town, item.address?.municipality]
      .filter(Boolean)
      .join(' '),
  );
  return text.includes('franca');
}

function dedupeNominatimItems(items: NominatimItem[]) {
  const seen = new Set<string>();
  const result: NominatimItem[] = [];
  for (const item of items) {
    const key = `${Number(item.lat).toFixed(5)}|${Number(item.lon).toFixed(5)}|${normalizeForMatch(item.display_name)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
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

/** Reverte o formato gerado por `composeEnderecoTexto` (melhor esforço para edição estruturada). */
export function parseEnderecoTexto(
  enderecoTexto: string | null | undefined,
  defaults?: Partial<Pick<ParsedAddress, 'bairro' | 'cidade'>>,
): ParsedAddress {
  const raw = enderecoTexto?.trim() ?? '';
  const empty: ParsedAddress = {
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: defaults?.bairro?.trim() ?? '',
    cidade: defaults?.cidade?.trim() || 'Franca',
  };
  if (!raw) return empty;

  let remaining = raw;
  let cidade = empty.cidade;
  const citySplit = remaining.lastIndexOf(' · ');
  if (citySplit >= 0) {
    const maybeCity = remaining.slice(citySplit + 3).trim();
    if (maybeCity && !/,|—/.test(maybeCity) && maybeCity.length <= 40) {
      cidade = maybeCity;
      remaining = remaining.slice(0, citySplit).trim();
    }
  }

  let complemento = '';
  const complSplit = remaining.indexOf(' — ');
  if (complSplit >= 0) {
    complemento = remaining.slice(complSplit + 3).trim();
    remaining = remaining.slice(0, complSplit).trim();
  }

  let logradouro = remaining;
  let numero = '';
  const lastComma = remaining.lastIndexOf(', ');
  if (lastComma >= 0) {
    const maybeNumero = remaining.slice(lastComma + 2).trim();
    if (/^[\dA-Za-z./\-]+$/.test(maybeNumero) && maybeNumero.length <= 12) {
      logradouro = remaining.slice(0, lastComma).trim();
      numero = maybeNumero;
    }
  }

  return {
    logradouro,
    numero,
    complemento,
    bairro: empty.bairro,
    cidade: cidade || 'Franca',
  };
}

export function buildGeocodeQuery(parts: Pick<ParsedAddress, 'logradouro' | 'numero' | 'bairro' | 'cidade'>) {
  const logradouro = parts.logradouro.trim();
  const numero = parts.numero.trim();
  // Coloca o número junto ao logradouro (ex.: "Rua X, 1000") — essencial para o Nominatim.
  const streetLine = numero ? `${logradouro}, ${numero}` : logradouro;
  const segments = [streetLine, parts.bairro.trim(), parts.cidade.trim() || 'Franca', 'SP', 'Brasil'].filter(Boolean);
  return segments.join(', ');
}

function parseHouseNumber(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function matchesStreet(item: NominatimItem, street: string) {
  const road = item.address?.road ?? item.address?.pedestrian ?? item.address?.footway ?? '';
  if (road && normalizeStreetName(road).includes(normalizeStreetName(street))) return true;
  return normalizeStreetName(item.display_name).includes(normalizeStreetName(street));
}

function isBuildingResult(item: NominatimItem) {
  return (
    item.class === 'building' ||
    item.class === 'place' ||
    item.addresstype === 'building' ||
    item.addresstype === 'house' ||
    item.type === 'house' ||
    item.type === 'yes'
  );
}

function isRoadResult(item: NominatimItem) {
  return item.class === 'highway' || item.addresstype === 'road';
}

function itemHouseNumber(item: NominatimItem) {
  const fromAddress = parseHouseNumber(item.address?.house_number ?? '');
  if (fromAddress) return fromAddress;
  // Ex.: "Rua X, 1000, Bairro, Franca..."
  const match = item.display_name.match(/,\s*(\d{1,6})\b/);
  return match ? parseHouseNumber(match[1]) : null;
}

/**
 * Interpola ao longo do eixo principal do bbox (lógica típica de numeração crescente na via).
 * `houseNumber` é mapeado aproximadamente em 1..3000.
 */
function interpolateHouseOnBoundingBox(
  boundingbox: [string, string, string, string],
  houseNumber: number,
  segmentIndex = 0,
  segmentCount = 1,
) {
  const [south, north, west, east] = boundingbox.map(Number);
  const span = Math.max(segmentCount, 1);
  const segmentStart = Math.min(Math.max(segmentIndex, 0), span - 1) / span;
  const segmentWidth = 1 / span;
  const localT = Math.min(Math.max((houseNumber - 1) / 2999, 0.02), 0.98);
  const t = segmentStart + localT * segmentWidth;

  const latSpan = Math.abs(north - south);
  const lngSpan = Math.abs(east - west);

  if (lngSpan >= latSpan) {
    return {
      latitude: (south + north) / 2,
      longitude: west + (east - west) * t,
    };
  }

  return {
    latitude: south + (north - south) * t,
    longitude: (west + east) / 2,
  };
}

export type GeocodePrecision = 'exact' | 'approximate' | 'street';

export type GeocodeStructuredResult = {
  latitude: number;
  longitude: number;
  precision: GeocodePrecision;
};

function resolveCoordsFromItems(
  items: NominatimItem[],
  street: string,
  houseNumber: number | null,
): GeocodeStructuredResult | null {
  const streetMatches = items.filter((item) => matchesStreet(item, street));
  const pool = streetMatches.length > 0 ? streetMatches : items;
  if (pool.length === 0) return null;

  if (houseNumber) {
    const exact = pool.find((item) => itemHouseNumber(item) === houseNumber);
    if (exact) {
      return {
        latitude: Number(exact.lat),
        longitude: Number(exact.lon),
        precision: 'exact',
      };
    }

    const nearBuilding = pool.find(
      (item) => isBuildingResult(item) && itemHouseNumber(item) != null && !isRoadResult(item),
    );

    const roads = pool.filter((item) => isRoadResult(item) && item.boundingbox?.length === 4);
    if (roads.length > 0) {
      // Ordena segmentos de N→S / O→L para a numeração crescer de forma estável.
      const sortedRoads = [...roads].sort((left, right) => {
        const [lSouth, , lWest] = (left.boundingbox ?? []).map(Number);
        const [rSouth, , rWest] = (right.boundingbox ?? []).map(Number);
        const latDiff = (lSouth ?? 0) - (rSouth ?? 0);
        if (Math.abs(latDiff) > 1e-6) return latDiff;
        return (lWest ?? 0) - (rWest ?? 0);
      });
      const segmentIndex = Math.min(
        Math.floor(((houseNumber - 1) / 2999) * sortedRoads.length),
        sortedRoads.length - 1,
      );
      const road = sortedRoads[Math.max(segmentIndex, 0)];
      if (road?.boundingbox) {
        const interpolated = interpolateHouseOnBoundingBox(
          road.boundingbox,
          houseNumber,
          segmentIndex,
          sortedRoads.length,
        );
        return { ...interpolated, precision: 'approximate' };
      }
    }

    if (nearBuilding) {
      return {
        latitude: Number(nearBuilding.lat),
        longitude: Number(nearBuilding.lon),
        precision: 'approximate',
      };
    }
  }

  const first = pool[0];
  return {
    latitude: Number(first.lat),
    longitude: Number(first.lon),
    precision: houseNumber ? 'approximate' : 'street',
  };
}

async function fetchNominatim(url: string): Promise<NominatimItem[]> {
  const response = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!response.ok) {
    throw new Error('Não foi possível buscar endereços agora.');
  }
  return (await response.json()) as NominatimItem[];
}

async function searchNominatimItems(query: string, limit = 6): Promise<NominatimItem[]> {
  const cleaned = query.trim();
  if (!cleaned) return [];

  const viewbox = francaViewbox();
  const base = {
    format: 'json',
    addressdetails: '1',
    limit: String(Math.max(limit * 2, 8)),
    countrycodes: 'br',
  } as const;

  // Preferência pela área de Franca sem corte duro (bounded=0): permite periferia e variações.
  const softParams = new URLSearchParams({
    ...base,
    q: `${cleaned}, Franca, SP, Brasil`,
    viewbox,
    bounded: '0',
  });

  let items = await fetchNominatim(`https://nominatim.openstreetmap.org/search?${softParams.toString()}`);
  let francaItems = items.filter(isLikelyFrancaResult);

  // Fallback mais restrito se a busca ampla não trouxe Franca.
  if (francaItems.length === 0) {
    const hardParams = new URLSearchParams({
      ...base,
      q: cleaned,
      viewbox,
      bounded: '1',
    });
    items = await fetchNominatim(`https://nominatim.openstreetmap.org/search?${hardParams.toString()}`);
    francaItems = items.filter(isLikelyFrancaResult);
  }

  // Último recurso: Photon (OSM) com bias no centro de Franca.
  if (francaItems.length === 0) {
    const photonItems = await searchPhotonItems(cleaned, limit);
    return dedupeNominatimItems(photonItems).slice(0, limit);
  }

  return dedupeNominatimItems(francaItems).slice(0, limit);
}

async function searchPhotonItems(query: string, limit = 6): Promise<NominatimItem[]> {
  const bbox = `${FRANCA_BOUNDS.southWest.lng},${FRANCA_BOUNDS.southWest.lat},${FRANCA_BOUNDS.northEast.lng},${FRANCA_BOUNDS.northEast.lat}`;
  const params = new URLSearchParams({
    q: `${query.trim()}, Franca`,
    lat: String(FRANCA_CENTER.lat),
    lon: String(FRANCA_CENTER.lng),
    bbox,
    limit: String(limit),
    lang: 'pt',
  });

  try {
    const response = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: {
          name?: string;
          street?: string;
          housenumber?: string;
          district?: string;
          suburb?: string;
          city?: string;
          locality?: string;
          county?: string;
          state?: string;
          country?: string;
        };
      }>;
    };

    return (payload.features ?? [])
      .map((feature) => {
        const [lon, lat] = feature.geometry?.coordinates ?? [];
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        if (!isWithinFrancaMunicipio(lat, lon)) return null;
        const props = feature.properties ?? {};
        const city = props.city ?? props.locality ?? props.county ?? 'Franca';
        if (city && !normalizeForMatch(city).includes('franca') && !normalizeForMatch(String(props.state ?? '')).includes('sao paulo')) {
          // Ainda aceita se estiver dentro do bbox municipal.
        }
        const road = props.street ?? props.name ?? '';
        const display = [road, props.housenumber, props.district ?? props.suburb, city, props.state, props.country]
          .filter(Boolean)
          .join(', ');
        return {
          display_name: display || props.name || query,
          lat: String(lat),
          lon: String(lon),
          class: 'place',
          address: {
            road: props.street ?? props.name,
            house_number: props.housenumber,
            suburb: props.suburb,
            neighbourhood: props.district,
            city,
            state: props.state,
          },
        } satisfies NominatimItem;
      })
      .filter((item): item is NominatimItem => Boolean(item));
  } catch {
    return [];
  }
}

async function searchStructuredNominatim(
  street: string,
  houseNumber: string,
  city: string,
  bairro: string,
  limit = 5,
): Promise<NominatimItem[]> {
  // Nominatim structured: `street` deve ser "número + logradouro" (não existe housenumber separado).
  const streetParam = [houseNumber.trim(), street.trim()].filter(Boolean).join(' ');
  const params = new URLSearchParams({
    format: 'json',
    addressdetails: '1',
    limit: String(limit),
    countrycodes: 'br',
    street: streetParam,
    city: city.trim() || 'Franca',
    state: 'São Paulo',
    country: 'Brazil',
    viewbox: francaViewbox(),
    bounded: '0',
  });

  // Bairro vai na query livre como reforço (county no Nominatim não é bairro BR).
  const items = await fetchNominatim(`https://nominatim.openstreetmap.org/search?${params.toString()}`);
  const francaItems = items.filter(isLikelyFrancaResult);
  if (francaItems.length > 0 || !bairro.trim()) return francaItems;

  return searchNominatimItems(buildGeocodeQuery({ logradouro: street, numero: houseNumber, bairro, cidade: city }), limit);
}

export async function searchAddresses(query: string, limit = 6): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

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

async function resolveAttempt(
  parts: Pick<ParsedAddress, 'logradouro' | 'numero' | 'bairro' | 'cidade'>,
): Promise<GeocodeStructuredResult | null> {
  const street = parts.logradouro.trim();
  const houseNumberRaw = parts.numero.trim();
  const city = parts.cidade.trim() || 'Franca';
  const bairro = parts.bairro.trim();
  const houseNumber = parseHouseNumber(houseNumberRaw);

  const structured = await searchStructuredNominatim(street, houseNumberRaw, city, bairro, 8);
  let resolved = resolveCoordsFromItems(structured, street, houseNumber);

  if (!resolved) {
    const freeText = await searchNominatimItems(buildGeocodeQuery(parts), 10);
    resolved = resolveCoordsFromItems(freeText, street, houseNumber);
  }

  if (!resolved && houseNumberRaw) {
    // Query curta só com logradouro+número+cidade (reforça o uso do número).
    const shortQuery = [street, houseNumberRaw, city, 'SP'].filter(Boolean).join(', ');
    const shortItems = await searchNominatimItems(shortQuery, 10);
    resolved = resolveCoordsFromItems(shortItems, street, houseNumber);
  }

  if (!resolved) return null;
  if (!isWithinFrancaMunicipio(resolved.latitude, resolved.longitude)) return null;
  return resolved;
}

/**
 * Geocodifica endereço estruturado priorizando o número:
 * 1) Logradouro + Número + Bairro + Cidade
 * 2) Logradouro + Número + Cidade
 * 3) Logradouro + Bairro + Cidade (aproximado / início da via)
 */
export async function geocodeStructuredAddress(
  parts: Pick<ParsedAddress, 'logradouro' | 'numero' | 'bairro' | 'cidade'>,
): Promise<GeocodeStructuredResult | null> {
  const street = parts.logradouro.trim();
  const houseNumberRaw = parts.numero.trim();
  const city = parts.cidade.trim() || 'Franca';
  const bairro = parts.bairro.trim();

  if (!street) return null;
  if (!houseNumberRaw && !bairro && street.length < 3) return null;

  if (houseNumberRaw && bairro) {
    const withAll = await resolveAttempt({ logradouro: street, numero: houseNumberRaw, bairro, cidade: city });
    if (withAll) return withAll;
  }

  if (houseNumberRaw) {
    const withNumber = await resolveAttempt({ logradouro: street, numero: houseNumberRaw, bairro: '', cidade: city });
    if (withNumber) return withNumber;
  }

  if (bairro) {
    const streetOnly = await resolveAttempt({ logradouro: street, numero: '', bairro, cidade: city });
    if (streetOnly) {
      return { ...streetOnly, precision: houseNumberRaw ? 'approximate' : 'street' };
    }
  }

  return null;
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
