import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Prisma, PrismaClient, UnidadeTipo } from '@prisma/client';
import { fetchWebmapGithubStatus } from './webmap-github';
import { logError, logInfo, logStep, logWarn } from './startup-log';
import { WEBMAP_LAYER_FILES, WEBMAP_RAW_BASE, type WebmapLayerConfig } from './webmap-layers';

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
  logger?: Pick<Console, 'log' | 'warn' | 'error'>;
};

export type WebmapImportResult = {
  dryRun: boolean;
  featuresRead: number;
  uniqueUnits: number;
  created: number;
  updated: number;
  skipped: number;
  layersProcessed: number;
  layersFailed: number;
  totalUnidadesInDb: number;
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
  endereco: string;
  bairro: string | null;
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
];

export async function runWebmapImport(
  prisma: PrismaClient,
  options: WebmapImportOptions = {},
): Promise<WebmapImportResult> {
  const dryRun = options.dryRun ?? false;
  const localDir = options.localDir ?? null;
  const github = options.githubCommitSha
    ? {
        ...(await fetchWebmapGithubStatus()),
        commitSha: options.githubCommitSha,
      }
    : await fetchWebmapGithubStatus();

  logStep('webmap', 'Importando unidades do webmap SMMAFRANCA');
  logInfo('webmap', `Fonte: ${localDir ?? WEBMAP_RAW_BASE}`);
  logInfo('webmap', `GitHub: ${github.repo}@${github.commitSha.slice(0, 7)}`);
  logInfo('webmap', `Camadas: ${WEBMAP_LAYER_FILES.length}`);
  if (dryRun) logWarn('webmap', 'Modo dry-run: nenhuma alteracao sera persistida.');

  const secretarias = await prisma.secretaria.findMany({ select: { id: true, sigla: true } });
  const secretariaBySigla = new Map(secretarias.map((item) => [item.sigla.toUpperCase(), item.id]));

  const byCodigo = new Map<string, NormalizedUnidade>();
  let featuresRead = 0;
  let layersFailed = 0;
  let layersProcessed = 0;

  for (const layer of WEBMAP_LAYER_FILES) {
    try {
      const content = await loadLayerContent(layer.file, localDir);
      const collection = parseFeatureCollection(content, layer.file);
      featuresRead += collection.features.length;
      layersProcessed += 1;

      for (const feature of collection.features) {
        const normalized = normalizeFeature(feature, layer, github.commitSha);
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

      logInfo('webmap', `${layer.file}: ${collection.features.length} features`);
    } catch (error) {
      layersFailed += 1;
      logError('webmap', `Falha na camada ${layer.file}`, error);
    }
  }

  logInfo('webmap', `${featuresRead} features lidas -> ${byCodigo.size} unidades unicas.`);

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const unidade of byCodigo.values()) {
    const secretariaId = secretariaBySigla.get(unidade.secretariaSigla.toUpperCase());
    if (!secretariaId) {
      skipped += 1;
      logWarn(
        'webmap',
        `Secretaria ${unidade.secretariaSigla} nao encontrada para ${unidade.codigoPatrimonial}.`,
      );
      continue;
    }

    const payload = {
      secretariaId,
      codigoPatrimonial: unidade.codigoPatrimonial,
      nome: unidade.nome,
      tipo: unidade.tipo,
      endereco: unidade.endereco,
      bairro: unidade.bairro,
      cep: null as string | null,
      latitude: unidade.latitude,
      longitude: unidade.longitude,
      raioValidacaoMetros: 200,
      ativo: true,
      metadata: unidade.metadata as Prisma.InputJsonValue,
    };

    if (dryRun) {
      logInfo('webmap', `[dry-run] ${payload.codigoPatrimonial} | ${payload.nome}`);
      continue;
    }

    const existing = await prisma.unidadePublica.findUnique({
      where: { codigoPatrimonial: payload.codigoPatrimonial },
      select: { id: true },
    });

    if (existing) {
      await prisma.unidadePublica.update({ where: { id: existing.id }, data: payload });
      updated += 1;
    } else {
      await prisma.unidadePublica.create({ data: payload });
      created += 1;
    }
  }

  const totalUnidadesInDb = dryRun ? byCodigo.size : await prisma.unidadePublica.count();

  logInfo(
    'webmap',
    `Importacao concluida: ${created} criadas, ${updated} atualizadas, ${skipped} ignoradas, ${layersFailed} camadas com erro.`,
  );
  logInfo('webmap', `Total de unidades no banco: ${totalUnidadesInDb}`);

  return {
    dryRun,
    featuresRead,
    uniqueUnits: byCodigo.size,
    created,
    updated,
    skipped,
    layersProcessed,
    layersFailed,
    totalUnidadesInDb,
    github,
  };
}

async function loadLayerContent(file: string, localDir: string | null) {
  if (localDir) {
    return readFile(resolve(localDir, file), 'utf8');
  }

  const url = `${WEBMAP_RAW_BASE.replace(/\/$/, '')}/${file}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao baixar ${url}`);
  }
  return response.text();
}

export function parseFeatureCollection(content: string, label: string): GeoFeatureCollection {
  const start = content.indexOf('{"type":"FeatureCollection"');
  if (start < 0) {
    throw new Error(`FeatureCollection nao encontrada em ${label}`);
  }

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

function normalizeFeature(
  feature: GeoFeature,
  layer: WebmapLayerConfig,
  githubCommitSha: string,
): NormalizedUnidade | null {
  const props = feature.properties ?? {};
  const coords = extractCoordinates(feature);
  if (!coords) return null;

  const nome = extractNome(props, layer);
  if (!nome) return null;

  const cadastro = extractCadastro(props);
  const fid = String(props.fid ?? props.FID ?? '0');
  const codigoPatrimonial = cadastro
    ? formatCodigoPatrimonial(cadastro)
    : `PMF-WEBMAP-${layer.file.replace(/\.js$/, '')}-${fid}`;

  const endereco = extractEndereco(props);
  const bairro = extractBairro(props, endereco);
  const secretariaSigla =
    resolveSecretariaSigla(pickString(props, ['unidade_municipal', 'unidade'])) ??
    layer.defaultSecretariaSigla;

  return {
    codigoPatrimonial,
    nome: nome.trim(),
    tipo: layer.defaultTipo,
    secretariaSigla,
    endereco: endereco || 'Endereco nao informado no webmap',
    bairro,
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
  const lng = parseCoordinate(
    props.long ?? props.lng ?? props.LONG ?? props.log ?? props.longitude ?? props.LON,
  );
  if (lat !== null && lng !== null) {
    return { latitude: lat, longitude: lng };
  }

  return null;
}

function parseCoordinate(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(',', '.');
  const parsed = Number(normalized);
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
