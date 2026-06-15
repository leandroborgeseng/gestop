import { Prisma, UnidadeTipo } from '@prisma/client';

export const WEBMAP_SYNCABLE_SCALAR_FIELDS = [
  'secretariaId',
  'nome',
  'tipo',
  'endereco',
  'bairro',
  'cep',
  'latitude',
  'longitude',
  'raioValidacaoMetros',
  'ativo',
] as const;

export type WebmapSyncableField = (typeof WEBMAP_SYNCABLE_SCALAR_FIELDS)[number];

export type ManualOverride = {
  lockedFields: WebmapSyncableField[];
  editedAt: string;
  editedBy?: string;
  reason?: string;
  deactivatedManually?: boolean;
};

export const WEBMAP_FIELD_LABELS: Record<WebmapSyncableField, string> = {
  secretariaId: 'Secretaria',
  nome: 'Nome',
  tipo: 'Tipo',
  endereco: 'Endereço',
  bairro: 'Bairro',
  cep: 'CEP',
  latitude: 'Latitude',
  longitude: 'Longitude',
  raioValidacaoMetros: 'Raio de validação (m)',
  ativo: 'Status',
};

type UnidadeLike = {
  secretariaId: string;
  nome: string;
  tipo: UnidadeTipo;
  endereco: string;
  bairro: string | null;
  cep: string | null;
  latitude: number;
  longitude: number;
  raioValidacaoMetros: number;
  ativo: boolean;
};

type UnidadeDtoLike = {
  secretariaId: string;
  nome: string;
  tipo: UnidadeTipo;
  endereco: string;
  bairro?: string;
  cep?: string;
  latitude: number;
  longitude: number;
  raioValidacaoMetros?: number;
  ativo?: boolean;
};

export function isWebmapImported(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== 'object') return false;
  const source = (metadata as Record<string, unknown>).webmapSource;
  return Boolean(source && typeof source === 'object');
}

export function getManualOverride(metadata: unknown): ManualOverride | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = (metadata as Record<string, unknown>).manualOverride;
  if (!raw || typeof raw !== 'object') return null;
  const override = raw as ManualOverride;
  if (!Array.isArray(override.lockedFields)) return null;
  return override;
}

export function buildManualOverrideOnEdit(
  before: UnidadeLike,
  dto: UnidadeDtoLike,
  existingMetadata: Record<string, unknown>,
  editedBy: string,
): ManualOverride {
  const previous = getManualOverride(existingMetadata);
  const locked = new Set<WebmapSyncableField>(previous?.lockedFields ?? []);

  const dtoNormalized: UnidadeLike = {
    secretariaId: dto.secretariaId,
    nome: dto.nome.trim(),
    tipo: dto.tipo,
    endereco: dto.endereco.trim(),
    bairro: dto.bairro?.trim() ?? null,
    cep: dto.cep?.trim() ?? null,
    latitude: dto.latitude,
    longitude: dto.longitude,
    raioValidacaoMetros: dto.raioValidacaoMetros ?? 200,
    ativo: dto.ativo ?? true,
  };

  for (const field of WEBMAP_SYNCABLE_SCALAR_FIELDS) {
    if (!valuesEqual(field, before[field], dtoNormalized[field])) {
      locked.add(field);
    }
  }

  return {
    lockedFields: [...locked],
    editedAt: new Date().toISOString(),
    editedBy,
    reason: previous?.reason ?? 'Correção manual pós-importação QGIS',
    deactivatedManually: previous?.deactivatedManually,
  };
}

export function mergeMetadataWithManualOverride(
  existingMetadata: Record<string, unknown>,
  manualOverride: ManualOverride,
): Prisma.InputJsonValue {
  return {
    ...existingMetadata,
    manualOverride,
  } as Prisma.InputJsonValue;
}

export function mergeMetadataForImport(
  existingMetadata: unknown,
  incomingMetadata: Record<string, unknown>,
): Prisma.InputJsonValue {
  const existing = (existingMetadata && typeof existingMetadata === 'object'
    ? existingMetadata
    : {}) as Record<string, unknown>;
  const manualOverride = getManualOverride(existing);

  return {
    ...existing,
    ...incomingMetadata,
    ...(manualOverride ? { manualOverride } : {}),
  } as Prisma.InputJsonValue;
}

export function formatFieldValue(
  field: WebmapSyncableField,
  value: unknown,
  secretariaSiglaById?: Map<string, string>,
): string | null {
  if (value === null || value === undefined) return null;

  if (field === 'secretariaId' && secretariaSiglaById) {
    return secretariaSiglaById.get(String(value)) ?? String(value);
  }
  if (field === 'tipo') return String(value);
  if (field === 'ativo') return value ? 'Ativo' : 'Inativo';
  if (field === 'latitude' || field === 'longitude') {
    const num = Number(value);
    return Number.isFinite(num) ? num.toFixed(6) : String(value);
  }
  if (field === 'raioValidacaoMetros') return String(value);

  const text = String(value).trim();
  return text || null;
}

export function valuesEqual(field: WebmapSyncableField, left: unknown, right: unknown): boolean {
  if (field === 'latitude' || field === 'longitude') {
    return Math.abs(Number(left) - Number(right)) < 0.000001;
  }
  if (field === 'bairro' || field === 'cep') {
    const normalize = (value: unknown) => (value == null || value === '' ? null : String(value).trim());
    return normalize(left) === normalize(right);
  }
  if (field === 'ativo') return Boolean(left) === Boolean(right);
  return String(left).trim() === String(right).trim();
}
