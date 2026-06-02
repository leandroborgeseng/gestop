import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Prisma, PrismaClient, UnidadeTipo } from '@prisma/client';
import { fetchWebmapGithubStatus } from './webmap-github';
import { logError, logInfo, logStep, logWarn } from './startup-log';
import { resolveWebmapLayers, WEBMAP_RAW_BASE, type WebmapLayerConfig } from './webmap-layers';
import { buildLayerCacheKey, getCachedLayerContent, setCachedLayerContent } from './webmap-layer-cache';
import { isWithinFrancaMunicipio } from './webmap-geo';

export type GeoFeature = {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown };
};

export type GeoFeatureCollection = {
  type: 'FeatureCollection';
  features: GeoFeature[];
};

export type WebmapImportOptions = {
  dryRun?: boolean;
  localDir?: string | null;
  githubCommitSha?: string | null;
  deactivateMissing?: boolean;
  autoDiscoverLayers?: boolean;
  logger?: Pick<Console, 'log' | 'warn' | 'error'>;
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
  const skippedUnits: WebmapSkippedUnit[] = [];
  const createdCodigos: string[] = [];
  const updatedCodigos: string[] = [];
  const importedCodigos = new Set<string>();

  const persistQueue: Array<{ unidade: NormalizedUnidade; secretariaId: string }> = [];

  for (const unidade of byCodigo.values()) {
    const secretariaId = secretariaBySigla.get(unidade.secretariaSigla.toUpperCase());
    if (!secretariaId) {
      skipped += 1;
      skippedUnits.push(buildSkippedUnit(unidade, secretariasCadastradas));
      continue;
    }
    persistQueue.push({ unidade, secretariaId });
  }

  if (!dryRun) {
    for (let index = 0; index < persistQueue.length; index += UPSERT_BATCH) {
      const batch = persistQueue.slice(index, index + UPSERT_BATCH);
      await Promise.all(
        batch.map(async ({ unidade, secretariaId }) => {
          const payload = buildPayload(unidade, secretariaId);
          const existing = await prisma.unidadePublica.findUnique({
            where: { codigoPatrimonial: payload.codigoPatrimonial },
            select: { id: true },
          });

          if (existing) {
            await prisma.unidadePublica.update({ where: { id: existing.id }, data: payload });
            updated += 1;
            updatedCodigos.push(payload.codigoPatrimonial);
          } else {
            await prisma.unidadePublica.create({ data: payload });
            created += 1;
            createdCodigos.push(payload.codigoPatrimonial);
          }
          importedCodigos.add(payload.codigoPatrimonial);
        }),
      );
    }
  } else {
    for (const { unidade } of persistQueue) {
      importedCodigos.add(unidade.codigoPatrimonial);
      logInfo('webmap', `[dry-run] ${unidade.codigoPatrimonial} | ${unidade.nome}`);
    }
  }

  const deactivatedUnits: Array<{ codigoPatrimonial: string; nome: string }> = [];
  const deactivatedCodigos: string[] = [];

  if (!dryRun && deactivateMissing) {
    const webmapUnits = await prisma.unidadePublica.findMany({
      where: {
        ativo: true,
        metadata: { path: ['webmapSource', 'repo'], equals: github.repo },
      },
      select: { id: true, codigoPatrimonial: true, nome: true, metadata: true },
    });

    for (const unit of webmapUnits) {
      if (importedCodigos.has(unit.codigoPatrimonial)) continue;
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
        : `Cadastrar secretaria "${unidade.secretariaSigla}" no GestOP ou corrigir unidade_municipal. Disponiveis: ${secretariasCadastradas.join(', ')}.`,
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
