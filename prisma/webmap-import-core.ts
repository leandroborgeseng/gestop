import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Prisma, PrismaClient, UnidadeTipo } from '@prisma/client';
import { fetchWebmapGithubStatus } from './webmap-github';
import { logError, logInfo, logStep, logWarn } from './startup-log';
import { resolveWebmapLayers, WEBMAP_RAW_BASE, type WebmapLayerConfig } from './webmap-layers';
import { buildLayerCacheKey, getCachedLayerContent, setCachedLayerContent } from './webmap-layer-cache';
import { isWithinFrancaMunicipio } from './webmap-geo';
import {
  formatFieldValue,
  getManualOverride,
  mergeMetadataForImport,
  valuesEqual,
  WEBMAP_FIELD_LABELS,
  WEBMAP_SYNCABLE_SCALAR_FIELDS,
  type ManualOverride,
  type WebmapSyncableField,
} from './webmap-manual-override';

export type GeoFeature = {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
};

export type GeoFeatureCollection = {
  type: 'FeatureCollection';
  features: GeoFeature[];
};

export type WebmapImportSelection = {
  codigoPatrimonial: string;
  apply: boolean;
  fields?: string[];
};

export type WebmapImportOptions = {
  dryRun?: boolean;
  localDir?: string | null;
  githubCommitSha?: string | null;
  deactivateMissing?: boolean;
  autoDiscoverLayers?: boolean;
  selections?: WebmapImportSelection[];
  applyDeactivations?: boolean;
  logger?: Pick<Console, 'log' | 'warn' | 'error'>;
};

export type WebmapFieldChangeSkipReason = 'MANUAL_LOCK' | 'NOT_SELECTED' | 'UNCHANGED';
export type WebmapUnitChangeAction = 'CREATE' | 'UPDATE' | 'SKIP' | 'DEACTIVATE' | 'UNCHANGED';

export type WebmapFieldChange = {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
  willApply: boolean;
  skipReason?: WebmapFieldChangeSkipReason;
};

export type WebmapUnitChange = {
  codigoPatrimonial: string;
  nome: string;
  action: WebmapUnitChangeAction;
  skipReason?: string;
  changes?: WebmapFieldChange[];
};

export type WebmapSkipReason = 'SECRETARIA_NAO_CADASTRADA' | 'SECRETARIA_NAO_RESOLVIDA';
export type WebmapRejectReason = 'SEM_COORDENADAS' | 'SEM_NOME' | 'FORA_MUNICIPIO' | 'CADASTRO_INVALIDO';

export type WebmapSkippedUnit = {
  reason: WebmapSkipReason;
  codigoPatrimonial: string;
  nome: string;
  secretariaSigla: string;
  layerFile: string;
  layerGroup: WebmapLayerConfig['group'];
  endereco: string;
  bairro: string | null;
  unidadeMunicipal: string | null;
  latitude: number;
  longitude: number;
  sugestao: string;
};

export type WebmapRejectedFeature = {
  reason: WebmapRejectReason;
  layerFile: string;
  layerGroup: WebmapLayerConfig['group'];
  fid: string;
  nomeParcial: string | null;
  unidadeMunicipal: string | null;
  cadastroImobiliario: string | null;
  sugestao: string;
};

export type WebmapImportDiff = {
  previousCommitSha: string | null;
  createdCodigos: string[];
  updatedCodigos: string[];
  deactivatedCodigos: string[];
  unitChanges: WebmapUnitChange[];
  unchangedCount: number;
  blockedCount: number;
};

export type WebmapImportResult = {
  dryRun: boolean;
  triggeredBy: 'manual' | 'cron' | 'webhook';
  durationMs: number;
  featuresRead: number;
  uniqueUnits: number;
  created: number;
  updated: number;
  skipped: number;
  deactivated: number;
  skippedUnits: WebmapSkippedUnit[];
  rejectedFeatures: WebmapRejectedFeature[];
  deactivatedUnits: Array<{ codigoPatrimonial: string; nome: string }>;
  secretariasCadastradas: string[];
  layersProcessed: number;
  layersFailed: number;
  layersDiscovered: number;
  autoDiscoveredLayers: string[];
  totalUnidadesInDb: number;
  diff: WebmapImportDiff;
  github: {
    repo: string;
    branch: string;
    commitSha: string;
    commitMessage: string;
    committedAt: string;
    htmlUrl: string;
  };
};

type NormalizedUnidade = {
  codigoPatrimonial: string;
  nome: string;
  tipo: UnidadeTipo;
  secretariaSigla: string;
  unidadeMunicipalRaw: string | null;
  endereco: string;
  bairro: string | null;
  cep: string | null;
  latitude: number;
  longitude: number;
  metadata: Record<string, unknown>;
};

const SECRETARIA_ALIASES: Array<{ match: RegExp; sigla: string }> = [
  { match: /educa/i, sigla: 'SME' },
  { match: /sa[uú]de/i, sigla: 'SMS' },
  { match: /esporte/i, sigla: 'SMEL' },
  { match: /cultura/i, sigla: 'SMCT' },
  { match: /finan/i, sigla: 'SMF' },
  { match: /obra/i, sigla: 'SMO' },
  { match: /servi/i, sigla: 'SSMA' },
  { match: /transporte/i, sigla: 'SMT' },
  { match: /desenvolvimento/i, sigla: 'SMDHC' },
];

const PARALLEL_LAYERS = 6;
const UPSERT_BATCH = 25;

export async function runWebmapImport(
  prisma: PrismaClient,
  options: WebmapImportOptions = {},
  triggeredBy: WebmapImportResult['triggeredBy'] = 'manual',
  previousCommitSha: string | null = null,
): Promise<WebmapImportResult> {
  const startedAt = Date.now();
  const dryRun = options.dryRun ?? false;
  const localDir = options.localDir ?? null;
  const deactivateMissing = options.deactivateMissing ?? !dryRun;

  const github = options.githubCommitSha
    ? { ...(await fetchWebmapGithubStatus()), commitSha: options.githubCommitSha }
    : await fetchWebmapGithubStatus();

  const discoveredFiles = localDir ? await readdir(localDir).then((files) => files.filter((f) => f.endsWith('.js'))) : [];
  const layerResolution = await resolveWebmapLayers({
    discoveredFiles,
    autoDiscover: options.autoDiscoverLayers ?? !localDir,
  });
  const layers = layerResolution.layers;

  logStep('webmap', 'Importando unidades do webmap SMMAFRANCA');
  logInfo('webmap', `Fonte: ${localDir ?? WEBMAP_RAW_BASE}`);
  logInfo('webmap', `GitHub: ${github.repo}@${github.commitSha.slice(0, 7)}`);
  logInfo('webmap', `Camadas: ${layers.length} (${layerResolution.autoDiscovered.length} auto-descobertas)`);
  if (dryRun) logWarn('webmap', 'Modo dry-run: nenhuma alteracao sera persistida.');

  const secretarias = await prisma.secretaria.findMany({ select: { id: true, sigla: true } });
  const secretariaBySigla = new Map(secretarias.map((item) => [item.sigla.toUpperCase(), item.id]));
  const secretariasCadastradas = secretarias.map((item) => item.sigla).sort();

  const byCodigo = new Map<string, NormalizedUnidade>();
  const rejectedFeatures: WebmapRejectedFeature[] = [];
  let featuresRead = 0;
  let layersFailed = 0;
  let layersProcessed = 0;

  for (let index = 0; index < layers.length; index += PARALLEL_LAYERS) {
    const chunk = layers.slice(index, index + PARALLEL_LAYERS);
    const results = await Promise.all(
      chunk.map(async (layer) => {
        try {
          const content = await loadLayerContent(layer.file, localDir, github.commitSha);
          const collection = parseFeatureCollection(content, layer.file);
          return { layer, collection, error: null as unknown };
        } catch (error) {
          return { layer, collection: null, error };
        }
      }),
    );

    for (const item of results) {
      if (item.error || !item.collection) {
        layersFailed += 1;
        logError('webmap', `Falha na camada ${item.layer.file}`, item.error);
        continue;
      }

      featuresRead += item.collection.features.length;
      layersProcessed += 1;

      for (const feature of item.collection.features) {
        const rejection = validateFeature(feature, item.layer);
        if (rejection) {
          rejectedFeatures.push(rejection);
          continue;
        }

        const normalized = normalizeFeature(feature, item.layer, github.commitSha);
        if (!normalized) continue;

        const existing = byCodigo.get(normalized.codigoPatrimonial);
        if (existing) {
          if (JSON.stringify(normalized.metadata).length > JSON.stringify(existing.metadata).length) {
            byCodigo.set(normalized.codigoPatrimonial, normalized);
          }
          continue;
        }
        byCodigo.set(normalized.codigoPatrimonial, normalized);
      }

      logInfo('webmap', `${item.layer.file}: ${item.collection.features.length} features`);
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let unchangedCount = 0;
  let blockedCount = 0;
  const skippedUnits: WebmapSkippedUnit[] = [];
  const createdCodigos: string[] = [];
  const updatedCodigos: string[] = [];
  const unitChanges: WebmapUnitChange[] = [];
  const importedCodigos = new Set<string>();

  const persistQueue: Array<{ unidade: NormalizedUnidade; secretariaId: string }> = [];

  for (const unidade of byCodigo.values()) {
    const secretariaId = secretariaBySigla.get(unidade.secretariaSigla.toUpperCase());
    if (!secretariaId) {
      skipped += 1;
      skippedUnits.push(buildSkippedUnit(unidade, secretariasCadastradas));
      unitChanges.push({
        codigoPatrimonial: unidade.codigoPatrimonial,
        nome: unidade.nome,
        action: 'SKIP',
        skipReason: 'SECRETARIA_NAO_CADASTRADA',
      });
      continue;
    }
    persistQueue.push({ unidade, secretariaId });
  }

  const codigosToFetch = persistQueue.map((item) => item.unidade.codigoPatrimonial);
  const existingUnits = codigosToFetch.length
    ? await prisma.unidadePublica.findMany({
        where: { codigoPatrimonial: { in: codigosToFetch } },
        select: {
          id: true,
          secretariaId: true,
          codigoPatrimonial: true,
          nome: true,
          tipo: true,
          endereco: true,
          bairro: true,
          cep: true,
          latitude: true,
          longitude: true,
          raioValidacaoMetros: true,
          ativo: true,
          metadata: true,
        },
      })
    : [];
  const existingByCodigo = new Map(
    existingUnits.map((unit) => [unit.codigoPatrimonial, normalizeExistingUnit(unit)]),
  );
  const secretariaSiglaById = new Map(secretarias.map((item) => [item.id, item.sigla]));

  for (let index = 0; index < persistQueue.length; index += UPSERT_BATCH) {
    const batch = persistQueue.slice(index, index + UPSERT_BATCH);
    await Promise.all(
      batch.map(async ({ unidade, secretariaId }) => {
        const incoming = buildPayload(unidade, secretariaId);
        const existing = existingByCodigo.get(incoming.codigoPatrimonial) ?? null;
        const selection = resolveSelection(options.selections, incoming.codigoPatrimonial);
        const unitChange = buildUnitChange(
          incoming,
          existing,
          selection,
          secretariaSiglaById,
        );

        unitChanges.push(unitChange);

        if (unitChange.action === 'SKIP') {
          if (unitChange.skipReason?.includes('bloqueado')) blockedCount += 1;
          return;
        }

        if (unitChange.action === 'UNCHANGED') {
          unchangedCount += 1;
          importedCodigos.add(incoming.codigoPatrimonial);
          return;
        }

        if (dryRun) {
          if (unitChange.action === 'CREATE') created += 1;
          if (unitChange.action === 'UPDATE') updated += 1;
          if (unitChange.action === 'CREATE') createdCodigos.push(incoming.codigoPatrimonial);
          if (unitChange.action === 'UPDATE') updatedCodigos.push(incoming.codigoPatrimonial);
          importedCodigos.add(incoming.codigoPatrimonial);
          return;
        }

        const finalData = buildFinalPersistData(incoming, existing, selection, secretariaSiglaById);

        if (existing) {
          await prisma.unidadePublica.update({ where: { id: existing.id }, data: finalData });
          updated += 1;
          updatedCodigos.push(incoming.codigoPatrimonial);
        } else {
          await prisma.unidadePublica.create({ data: finalData as Prisma.UnidadePublicaCreateInput });
          created += 1;
          createdCodigos.push(incoming.codigoPatrimonial);
        }
        importedCodigos.add(incoming.codigoPatrimonial);
      }),
    );
  }

  const deactivatedUnits: Array<{ codigoPatrimonial: string; nome: string }> = [];
  const deactivatedCodigos: string[] = [];

  const shouldProcessDeactivations = dryRun || deactivateMissing;
  if (shouldProcessDeactivations) {
    const webmapUnits = await prisma.unidadePublica.findMany({
      where: {
        ativo: true,
        metadata: { path: ['webmapSource', 'repo'], equals: github.repo },
      },
      select: { id: true, codigoPatrimonial: true, nome: true, metadata: true },
    });

    for (const unit of webmapUnits) {
      if (importedCodigos.has(unit.codigoPatrimonial)) continue;

      const override = getManualOverride(unit.metadata);
      if (override?.deactivatedManually) {
        unitChanges.push({
          codigoPatrimonial: unit.codigoPatrimonial,
          nome: unit.nome,
          action: 'SKIP',
          skipReason: 'Desativação manual — não será desativado pela sync',
        });
        blockedCount += 1;
        continue;
      }

      const deactivationSelection = resolveSelection(options.selections, unit.codigoPatrimonial);
      const applyDeactivation =
        options.applyDeactivations ??
        (options.selections ? deactivationSelection?.apply !== false : true);

      unitChanges.push({
        codigoPatrimonial: unit.codigoPatrimonial,
        nome: unit.nome,
        action: 'DEACTIVATE',
        changes: [
          {
            field: 'ativo',
            label: WEBMAP_FIELD_LABELS.ativo,
            before: 'Ativo',
            after: 'Inativo',
            willApply: applyDeactivation,
            skipReason: applyDeactivation ? undefined : 'NOT_SELECTED',
          },
        ],
      });

      if (!applyDeactivation) {
        blockedCount += 1;
        continue;
      }

      if (dryRun) {
        deactivatedUnits.push({ codigoPatrimonial: unit.codigoPatrimonial, nome: unit.nome });
        deactivatedCodigos.push(unit.codigoPatrimonial);
        continue;
      }

      if (!deactivateMissing) continue;

      await prisma.unidadePublica.update({
        where: { id: unit.id },
        data: {
          ativo: false,
          metadata: {
            ...(unit.metadata as Record<string, unknown>),
            webmapSource: {
              ...(((unit.metadata as Record<string, unknown>)?.webmapSource as Record<string, unknown>) ?? {}),
              deactivatedAt: new Date().toISOString(),
              deactivatedReason: 'Ausente na ultima sync do webmap',
              lastSeenCommitSha: previousCommitSha ?? github.commitSha,
            },
          } as Prisma.InputJsonValue,
        },
      });
      deactivatedUnits.push({ codigoPatrimonial: unit.codigoPatrimonial, nome: unit.nome });
      deactivatedCodigos.push(unit.codigoPatrimonial);
    }
  }

  const totalUnidadesInDb = dryRun ? byCodigo.size : await prisma.unidadePublica.count({ where: { ativo: true } });
  skippedUnits.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  rejectedFeatures.sort((a, b) => a.layerFile.localeCompare(b.layerFile, 'pt-BR'));

  const result: WebmapImportResult = {
    dryRun,
    triggeredBy,
    durationMs: Date.now() - startedAt,
    featuresRead,
    uniqueUnits: byCodigo.size,
    created,
    updated,
    skipped,
    deactivated: deactivatedUnits.length,
    skippedUnits,
    rejectedFeatures,
    deactivatedUnits,
    secretariasCadastradas,
    layersProcessed,
    layersFailed,
    layersDiscovered: layers.length,
    autoDiscoveredLayers: layerResolution.autoDiscovered,
    totalUnidadesInDb,
    diff: {
      previousCommitSha,
      createdCodigos,
      updatedCodigos,
      deactivatedCodigos,
      unitChanges,
      unchangedCount,
      blockedCount,
    },
    github,
  };

  logInfo(
    'webmap',
    `Importacao concluida em ${result.durationMs}ms: ${created} criadas, ${updated} atualizadas, ${skipped} ignoradas, ${deactivatedUnits.length} desativadas, ${rejectedFeatures.length} rejeitadas.`,
  );

  return result;
}

function buildPayload(unidade: NormalizedUnidade, secretariaId: string) {
  return {
    secretariaId,
    codigoPatrimonial: unidade.codigoPatrimonial,
    nome: unidade.nome,
    tipo: unidade.tipo,
    endereco: unidade.endereco,
    bairro: unidade.bairro,
    cep: unidade.cep,
    latitude: unidade.latitude,
    longitude: unidade.longitude,
    raioValidacaoMetros: 200,
    ativo: true,
    metadata: unidade.metadata as Prisma.InputJsonValue,
  };
}

type ExistingUnidade = {
  id: string;
  secretariaId: string;
  codigoPatrimonial: string;
  nome: string;
  tipo: UnidadeTipo;
  endereco: string;
  bairro: string | null;
  cep: string | null;
  latitude: number;
  longitude: number;
  raioValidacaoMetros: number;
  ativo: boolean;
  metadata: Prisma.JsonValue;
};

type IncomingPayload = ReturnType<typeof buildPayload>;

function resolveSelection(selections: WebmapImportSelection[] | undefined, codigo: string) {
  return selections?.find((item) => item.codigoPatrimonial === codigo);
}

function getLockedFields(metadata: Prisma.JsonValue | null | undefined): Set<WebmapSyncableField> {
  const override = getManualOverride(metadata);
  return new Set(override?.lockedFields ?? []);
}

function isFieldSelected(
  field: WebmapSyncableField,
  selection: WebmapImportSelection | undefined,
): boolean {
  if (!selection?.fields?.length) return true;
  return selection.fields.includes(field);
}

function buildFieldChanges(
  incoming: IncomingPayload,
  existing: ExistingUnidade | null,
  lockedFields: Set<WebmapSyncableField>,
  selection: WebmapImportSelection | undefined,
  secretariaSiglaById: Map<string, string>,
): WebmapFieldChange[] {
  const changes: WebmapFieldChange[] = [];

  for (const field of WEBMAP_SYNCABLE_SCALAR_FIELDS) {
    const beforeValue = existing ? existing[field] : null;
    let afterValue = incoming[field];
    const manualOverride = existing ? getManualOverride(existing.metadata) : null;

    if (field === 'ativo' && manualOverride?.deactivatedManually) {
      afterValue = false;
    }

    const changed = existing ? !valuesEqual(field, beforeValue, afterValue) : true;
    const isLocked = existing ? lockedFields.has(field) : false;
    const userApproved = selection?.apply !== false;
    const fieldSelected = isFieldSelected(field, selection);
    const willApply = !existing
      ? userApproved
      : changed && !isLocked && userApproved && fieldSelected;

    let skipReason: WebmapFieldChangeSkipReason | undefined;
    if (!changed) skipReason = 'UNCHANGED';
    else if (isLocked) skipReason = 'MANUAL_LOCK';
    else if (!userApproved || !fieldSelected) skipReason = 'NOT_SELECTED';

    if (!existing && !userApproved) {
      continue;
    }

    changes.push({
      field,
      label: WEBMAP_FIELD_LABELS[field],
      before: existing ? formatFieldValue(field, beforeValue, secretariaSiglaById) : null,
      after: formatFieldValue(field, afterValue, secretariaSiglaById),
      willApply: existing ? willApply : userApproved,
      skipReason: willApply ? undefined : skipReason,
    });
  }

  return changes;
}

function buildUnitChange(
  incoming: IncomingPayload,
  existing: ExistingUnidade | null,
  selection: WebmapImportSelection | undefined,
  secretariaSiglaById: Map<string, string>,
): WebmapUnitChange {
  const lockedFields = getLockedFields(existing?.metadata);
  const manualOverride = getManualOverride(existing?.metadata);

  if (manualOverride?.deactivatedManually && existing) {
    return {
      codigoPatrimonial: incoming.codigoPatrimonial,
      nome: incoming.nome,
      action: 'SKIP',
      skipReason: 'Próprio desativado manualmente — sync bloqueada',
    };
  }

  if (!existing) {
    if (selection?.apply === false) {
      return {
        codigoPatrimonial: incoming.codigoPatrimonial,
        nome: incoming.nome,
        action: 'SKIP',
        skipReason: 'Criação não selecionada no preview',
      };
    }

    return {
      codigoPatrimonial: incoming.codigoPatrimonial,
      nome: incoming.nome,
      action: 'CREATE',
      changes: buildFieldChanges(incoming, null, lockedFields, selection, secretariaSiglaById),
    };
  }

  const changes = buildFieldChanges(incoming, existing, lockedFields, selection, secretariaSiglaById);
  const applicableChanges = changes.filter((change) => change.willApply);

  if (selection?.apply === false) {
    return {
      codigoPatrimonial: incoming.codigoPatrimonial,
      nome: incoming.nome,
      action: 'SKIP',
      skipReason: 'Atualização não selecionada no preview',
      changes,
    };
  }

  if (applicableChanges.length === 0) {
    const hasLockedDiff = changes.some((change) => change.skipReason === 'MANUAL_LOCK' && change.before !== change.after);
    if (metadataNeedsUpdate(existing, incoming)) {
      return {
        codigoPatrimonial: incoming.codigoPatrimonial,
        nome: incoming.nome,
        action: 'UPDATE',
        changes,
      };
    }
    return {
      codigoPatrimonial: incoming.codigoPatrimonial,
      nome: incoming.nome,
      action: 'UNCHANGED',
      skipReason: hasLockedDiff ? 'Alterações bloqueadas por edição manual' : undefined,
      changes,
    };
  }

  return {
    codigoPatrimonial: incoming.codigoPatrimonial,
    nome: incoming.nome,
    action: 'UPDATE',
    changes,
  };
}

function buildFinalPersistData(
  incoming: IncomingPayload,
  existing: ExistingUnidade | null,
  selection: WebmapImportSelection | undefined,
  secretariaSiglaById: Map<string, string>,
): Prisma.UnidadePublicaUpdateInput | Prisma.UnidadePublicaCreateInput {
  if (!existing) {
    return incoming;
  }

  const lockedFields = getLockedFields(existing.metadata);
  const changes = buildFieldChanges(incoming, existing, lockedFields, selection, secretariaSiglaById);
  const data: Prisma.UnidadePublicaUpdateInput = {
    metadata: mergeMetadataForImport(existing.metadata, incoming.metadata as Record<string, unknown>),
  };

  for (const change of changes) {
    if (!change.willApply) continue;
    const field = change.field as WebmapSyncableField;
    (data as Record<string, unknown>)[field] = incoming[field];
  }

  const manualOverride = getManualOverride(existing.metadata);
  if (manualOverride?.deactivatedManually) {
    data.ativo = false;
  }

  return data;
}

function normalizeExistingUnit(unit: {
  id: string;
  secretariaId: string;
  codigoPatrimonial: string;
  nome: string;
  tipo: UnidadeTipo;
  endereco: string;
  bairro: string | null;
  cep: string | null;
  latitude: Prisma.Decimal | number;
  longitude: Prisma.Decimal | number;
  raioValidacaoMetros: number;
  ativo: boolean;
  metadata: Prisma.JsonValue;
}): ExistingUnidade {
  return {
    ...unit,
    latitude: Number(unit.latitude),
    longitude: Number(unit.longitude),
  };
}

function metadataNeedsUpdate(existing: ExistingUnidade, incoming: IncomingPayload): boolean {
  const incomingSource = (incoming.metadata as Record<string, unknown>)?.webmapSource as
    | Record<string, unknown>
    | undefined;
  const existingSource = (existing.metadata as Record<string, unknown>)?.webmapSource as
    | Record<string, unknown>
    | undefined;
  return (
    incomingSource?.githubCommitSha !== existingSource?.githubCommitSha ||
    incomingSource?.layerFile !== existingSource?.layerFile
  );
}

async function loadLayerContent(file: string, localDir: string | null, commitSha: string) {
  const cacheKey = buildLayerCacheKey(commitSha, file);
  const cached = getCachedLayerContent(cacheKey);
  if (cached) return cached;

  const content = localDir
    ? await readFile(resolve(localDir, file), 'utf8')
    : await fetch(`${WEBMAP_RAW_BASE.replace(/\/$/, '')}/${file}`).then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status} ao baixar ${file}`);
        return response.text();
      });

  setCachedLayerContent(cacheKey, content);
  return content;
}

export function parseFeatureCollection(content: string, label: string): GeoFeatureCollection {
  const start = content.indexOf('{"type":"FeatureCollection"');
  if (start < 0) throw new Error(`FeatureCollection nao encontrada em ${label}`);

  let depth = 0;
  for (let index = start; index < content.length; index += 1) {
    const char = content[index];
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return JSON.parse(content.slice(start, index + 1)) as GeoFeatureCollection;
      }
    }
  }
  throw new Error(`FeatureCollection incompleta em ${label}`);
}

function validateFeature(feature: GeoFeature, layer: WebmapLayerConfig): WebmapRejectedFeature | null {
  const props = feature.properties ?? {};
  const fid = String(props.fid ?? props.FID ?? '0');
  const coords = extractCoordinates(feature);

  if (!coords) {
    return buildRejectedFeature(feature, layer, 'SEM_COORDENADAS');
  }
  if (!isWithinFrancaMunicipio(coords.latitude, coords.longitude)) {
    return buildRejectedFeature(feature, layer, 'FORA_MUNICIPIO', coords);
  }
  const cadastroRaw = pickString(props, ['cadastro_imobiliario', 'CADASTRO_IMOBILIARIO']);
  if (cadastroRaw && !extractCadastro(props)) {
    return buildRejectedFeature(feature, layer, 'CADASTRO_INVALIDO', coords);
  }
  if (!extractNome(props, layer)) {
    return buildRejectedFeature(feature, layer, 'SEM_NOME', coords);
  }
  return null;
}

function buildSkippedUnit(unidade: NormalizedUnidade, secretariasCadastradas: string[]): WebmapSkippedUnit {
  const source = (unidade.metadata.webmapSource ?? {}) as Record<string, unknown>;
  const reason: WebmapSkipReason = unidade.unidadeMunicipalRaw
    ? 'SECRETARIA_NAO_CADASTRADA'
    : 'SECRETARIA_NAO_RESOLVIDA';

  return {
    reason,
    codigoPatrimonial: unidade.codigoPatrimonial,
    nome: unidade.nome,
    secretariaSigla: unidade.secretariaSigla,
    layerFile: String(source.layerFile ?? ''),
    layerGroup: String(source.group ?? '') as WebmapLayerConfig['group'],
    endereco: unidade.endereco,
    bairro: unidade.bairro,
    unidadeMunicipal: unidade.unidadeMunicipalRaw,
    latitude: unidade.latitude,
    longitude: unidade.longitude,
    sugestao:
      reason === 'SECRETARIA_NAO_RESOLVIDA'
        ? `Preencher unidade_municipal no QGIS ou cadastrar secretaria "${unidade.secretariaSigla}". Disponiveis: ${secretariasCadastradas.join(', ')}.`
        : `Cadastrar secretaria "${unidade.secretariaSigla}" no SIGMA ou corrigir unidade_municipal. Disponiveis: ${secretariasCadastradas.join(', ')}.`,
  };
}

function buildRejectedFeature(
  feature: GeoFeature,
  layer: WebmapLayerConfig,
  reason: WebmapRejectReason,
  coords?: { latitude: number; longitude: number },
): WebmapRejectedFeature {
  const props = feature.properties ?? {};
  const fid = String(props.fid ?? props.FID ?? '0');
  const nome = extractNome(props, layer);
  const cadastro = extractCadastro(props);
  const sugestoes: Record<WebmapRejectReason, string> = {
    SEM_COORDENADAS: 'Incluir geometria Point valida ou campos lat/long no QGIS.',
    SEM_NOME: 'Preencher nome da unidade (unidade_escolar, proprio_municipal, nome ou RUA+BAIRRO).',
    FORA_MUNICIPIO: `Coordenadas (${coords?.latitude}, ${coords?.longitude}) fora dos limites de Franca/SP.`,
    CADASTRO_INVALIDO: 'Cadastro imobiliario deve ter ao menos 8 digitos numericos.',
  };

  return {
    reason,
    layerFile: layer.file,
    layerGroup: layer.group,
    fid,
    nomeParcial: nome,
    unidadeMunicipal: pickString(props, ['unidade_municipal', 'unidade']),
    cadastroImobiliario: cadastro,
    sugestao: sugestoes[reason],
  };
}

function normalizeFeature(
  feature: GeoFeature,
  layer: WebmapLayerConfig,
  githubCommitSha: string,
): NormalizedUnidade | null {
  const props = feature.properties ?? {};
  const coords = extractCoordinates(feature);
  const nome = extractNome(props, layer);
  if (!coords || !nome) return null;

  const cadastro = extractCadastro(props);
  const fid = String(props.fid ?? props.FID ?? '0');
  const codigoPatrimonial = cadastro
    ? formatCodigoPatrimonial(cadastro)
    : `PMF-WEBMAP-${layer.file.replace(/\.js$/, '')}-${fid}`;

  const endereco = extractEndereco(props);
  const bairro = extractBairro(props, endereco);
  const unidadeMunicipalRaw = pickString(props, ['unidade_municipal', 'unidade']);
  const secretariaSigla =
    resolveSecretariaSigla(unidadeMunicipalRaw) ?? layer.defaultSecretariaSigla;

  return {
    codigoPatrimonial,
    nome: nome.trim(),
    tipo: resolveUnidadeTipo(props, layer),
    secretariaSigla,
    unidadeMunicipalRaw,
    endereco: endereco || 'Endereco nao informado no webmap',
    bairro,
    cep: extractCep(props, endereco),
    latitude: coords.latitude,
    longitude: coords.longitude,
    metadata: {
      webmapSource: {
        repo: 'SMMAFRANCA/webmap',
        layerFile: layer.file,
        group: layer.group,
        githubCommitSha,
        importedAt: new Date().toISOString(),
      },
      webmapProperties: props,
    },
  };
}

function resolveUnidadeTipo(props: Record<string, unknown>, layer: WebmapLayerConfig) {
  const raw = pickString(props, ['tipo', 'TIPO', 'categoria', 'CATEGORIA'])?.toLowerCase() ?? '';
  if (/ubs|saude|posto/.test(raw)) return UnidadeTipo.UBS;
  if (/escola|creche|eja|infantil/.test(raw)) return UnidadeTipo.ESCOLA;
  if (/praca|parque/.test(raw)) return UnidadeTipo.PRACA;
  if (/predio|administr/.test(raw)) return UnidadeTipo.PREDIO_ADMINISTRATIVO;
  if (/esport|quadra|ginasio|campo/.test(raw)) return UnidadeTipo.ESPACO_ESPORTIVO;
  return layer.defaultTipo;
}

function extractCoordinates(feature: GeoFeature) {
  const geometry = feature.geometry;
  if (geometry?.type === 'Point' && Array.isArray(geometry.coordinates) && geometry.coordinates.length >= 2) {
    const [longitude, latitude] = geometry.coordinates as number[];
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }

  const props = feature.properties ?? {};
  const lat = parseCoordinate(props.lat ?? props.LAT ?? props.latitude);
  const lng = parseCoordinate(props.long ?? props.lng ?? props.LONG ?? props.log ?? props.longitude ?? props.LON);
  if (lat !== null && lng !== null) return { latitude: lat, longitude: lng };
  return null;
}

function parseCoordinate(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.trim().replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function extractCadastro(props: Record<string, unknown>) {
  const raw = pickString(props, [
    'cadastro_imobiliario',
    'CADASTRO_IMOBILIARIO',
    'CADASTRO IMOBILIÁRIO',
    'cadastro_imobiliário',
  ]);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

function formatCodigoPatrimonial(cadastroDigits: string) {
  return `PMF-${cadastroDigits.replace(/\D/g, '')}`;
}

function extractNome(props: Record<string, unknown>, layer: WebmapLayerConfig) {
  const direct = pickString(props, [
    'unidade_escolar',
    'EQUIPAMENTO_DE_SAÚDE',
    'EQUIPAMENTO_DE_SAUDE',
    'proprio_municipal',
    'PROPRIO_MUNICIPAL',
    'nome',
    'NOME',
    'equipamento',
  ]);
  if (direct) return direct;

  if (layer.group === 'imovel_publico') {
    const rua = pickString(props, ['RUA', 'rua']);
    const bairro = pickString(props, ['BAIRRO', 'bairro']);
    if (rua && bairro) return `Imovel Publico — ${rua} (${bairro})`;
    if (rua) return `Imovel Publico — ${rua}`;
  }
  return null;
}

function extractEndereco(props: Record<string, unknown>) {
  return (
    pickString(props, ['endereco', 'ENDERECO', 'endereço', 'Endereco']) ??
    pickString(props, ['RUA', 'rua']) ??
    ''
  );
}

function extractBairro(props: Record<string, unknown>, endereco: string) {
  const bairro = pickString(props, ['BAIRRO', 'bairro', 'regiao', 'REGIAO']);
  if (bairro) return bairro;
  const match = endereco.match(/\b([A-ZÀ-Ú][A-Za-zÀ-ú\s\.]+)\s*[-–—]\s*[A-Z]{2}\b/);
  return match?.[1]?.trim() ?? null;
}

function extractCep(props: Record<string, unknown>, endereco: string) {
  const direct = pickString(props, ['cep', 'CEP']);
  if (direct) {
    const digits = direct.replace(/\D/g, '');
    if (digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }
  const match = endereco.match(/\b(\d{5})-?(\d{3})\b/);
  return match ? `${match[1]}-${match[2]}` : null;
}

function resolveSecretariaSigla(unidadeMunicipal: string | null) {
  if (!unidadeMunicipal) return null;
  for (const alias of SECRETARIA_ALIASES) {
    if (alias.match.test(unidadeMunicipal)) return alias.sigla;
  }
  return null;
}

function pickString(props: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = props[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}
