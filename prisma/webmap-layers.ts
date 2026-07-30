import { fetchGithubLayerFiles } from './webmap-github';

export type WebmapLayerConfig = {
  file: string;
  group: 'proprio_municipal' | 'unidade_escolar' | 'imovel_publico';
  defaultSecretariaSigla: string;
  defaultTipo: string;
};

/** Camadas B + C — SMMAFRANCA/webmap (qgis2web) */
export const WEBMAP_LAYER_FILES: WebmapLayerConfig[] = [
  // Próprio Público Municipal
  { file: 'PrprioPblicoMunicipalArena3unid_48.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMEL', defaultTipo: 'ESPACO_ESPORTIVO' },
  { file: 'PrprioPblicoMunicipalAtenoPrimria24unid_43.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMS', defaultTipo: 'UBS' },
  { file: 'PrprioPblicoMunicipalBiblioteca1unid_49.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMCT', defaultTipo: 'OUTRO' },
  { file: 'PrprioPblicoMunicipalCEPEL12unid_53.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SME', defaultTipo: 'ESCOLA' },
  { file: 'PrprioPblicoMunicipalCampo25unid_50.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMEL', defaultTipo: 'ESPACO_ESPORTIVO' },
  { file: 'PrprioPblicoMunicipalCasa1unid_51.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SSMA', defaultTipo: 'PREDIO_ADMINISTRATIVO' },
  { file: 'PrprioPblicoMunicipalCentro4unid_52.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SSMA', defaultTipo: 'OUTRO' },
  { file: 'PrprioPblicoMunicipalConjunto4unid_54.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SSMA', defaultTipo: 'OUTRO' },
  { file: 'PrprioPblicoMunicipalEstadio1unid_55.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMEL', defaultTipo: 'ESPACO_ESPORTIVO' },
  { file: 'PrprioPblicoMunicipalGestoAdministrativo3unid_44.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMF', defaultTipo: 'PREDIO_ADMINISTRATIVO' },
  { file: 'PrprioPblicoMunicipalGinsio5unid_56.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMEL', defaultTipo: 'ESPACO_ESPORTIVO' },
  { file: 'PrprioPblicoMunicipalMuseu2unid_57.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMCT', defaultTipo: 'OUTRO' },
  { file: 'PrprioPblicoMunicipalParque2unid_58.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SSMA', defaultTipo: 'PRACA' },
  { file: 'PrprioPblicoMunicipalPavilho1unid_59.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMEL', defaultTipo: 'OUTRO' },
  { file: 'PrprioPblicoMunicipalPinacoteca1unid_60.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMCT', defaultTipo: 'OUTRO' },
  { file: 'PrprioPblicoMunicipalPiscina1unid_61.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMEL', defaultTipo: 'ESPACO_ESPORTIVO' },
  { file: 'PrprioPblicoMunicipalPista1unid_62.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMEL', defaultTipo: 'ESPACO_ESPORTIVO' },
  { file: 'PrprioPblicoMunicipalPraa3unid_63.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SSMA', defaultTipo: 'PRACA' },
  { file: 'PrprioPblicoMunicipalQuadra3unid_64.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMEL', defaultTipo: 'ESPACO_ESPORTIVO' },
  { file: 'PrprioPblicoMunicipalSecretaria1unid_65.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMF', defaultTipo: 'PREDIO_ADMINISTRATIVO' },
  { file: 'PrprioPblicoMunicipalServiodeEspecialidadesDiagnstico14unid_46.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMS', defaultTipo: 'UBS' },
  { file: 'PrprioPblicoMunicipalTeatro2unid_66.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMCT', defaultTipo: 'OUTRO' },
  { file: 'PrprioPblicoMunicipalUnidadedeUrgnciaeEmergncia8unid_45.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMS', defaultTipo: 'UBS' },
  { file: 'PrprioPblicoMunicipalVigilnciaemSade5unid_47.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMS', defaultTipo: 'UBS' },
  // Unidades Escolares
  { file: 'UnidadesEscolaresAlfabetizaaodeJovenseAdultos15unid_67.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: 'ESCOLA' },
  { file: 'UnidadesEscolaresAlmoxarifadoEducao1unid_68.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: 'PREDIO_ADMINISTRATIVO' },
  { file: 'UnidadesEscolaresCEICentrodeEducaoIntegradaGustavoChereghiniBichuette1unid_69.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: 'ESCOLA' },
  { file: 'UnidadesEscolaresCreche35unid_70.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: 'ESCOLA' },
  { file: 'UnidadesEscolaresCrechePrEscola45unid_71.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: 'ESCOLA' },
  { file: 'UnidadesEscolaresEdInfantil9unid_72.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: 'ESCOLA' },
  { file: 'UnidadesEscolaresEdInfantilEnsFundamental39unid_73.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: 'ESCOLA' },
  { file: 'UnidadesEscolaresEJA3unid_74.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: 'ESCOLA' },
  { file: 'UnidadesEscolaresEnsFundamental3unid_75.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: 'ESCOLA' },
  { file: 'UnidadesEscolaresEspaodeDifusoCientfica1unid_76.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: 'OUTRO' },
  { file: 'UnidadesEscolaresSecretariaMunicipaldeEducao1unid_77.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: 'PREDIO_ADMINISTRATIVO' },
  { file: 'UnidadesEscolaresSetordeMerenda1unid_78.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: 'PREDIO_ADMINISTRATIVO' },
  { file: 'UnidadesEscolaresUniversidadeAbertadoBrasilUAB1unid_79.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: 'OUTRO' },
  // Imóvel Público (limpeza / SEINFRA)
  { file: 'ImvelPblico120unid_86.js', group: 'imovel_publico', defaultSecretariaSigla: 'SSMA', defaultTipo: 'OUTRO' },
];

export const WEBMAP_RAW_BASE =
  process.env.WEBMAP_RAW_BASE?.trim() ??
  'https://raw.githubusercontent.com/SMMAFRANCA/webmap/main/layers';

const LAYER_PREFIXES = ['PrprioPblicoMunicipal', 'UnidadesEscolares', 'ImvelPblico'] as const;

const STATIC_BY_FILE = new Map(WEBMAP_LAYER_FILES.map((layer) => [layer.file, layer]));

function inferLayerConfig(file: string): WebmapLayerConfig | null {
  if (file.startsWith('PrprioPblicoMunicipal')) {
    const lower = file.toLowerCase();
    let defaultTipo: string = 'OUTRO';
    let defaultSecretariaSigla = 'SSMA';
    if (/arena|campo|estadio|ginsio|piscina|pista|quadra/i.test(file)) {
      defaultTipo = 'ESPACO_ESPORTIVO';
      defaultSecretariaSigla = 'SMEL';
    } else if (/ateno|saude|urgncia|vigilncia|diagnstico/i.test(file)) {
      defaultTipo = 'UBS';
      defaultSecretariaSigla = 'SMS';
    } else if (/biblioteca|museu|teatro|pinacoteca/i.test(file)) {
      defaultSecretariaSigla = 'SMCT';
    } else if (/cep|educa|escolar/i.test(file)) {
      defaultTipo = 'ESCOLA';
      defaultSecretariaSigla = 'SME';
    } else if (/gesto|secretaria|finan/i.test(file) || lower.includes('administr')) {
      defaultTipo = 'PREDIO_ADMINISTRATIVO';
      defaultSecretariaSigla = 'SMF';
    } else if (/parque|praa/i.test(file)) {
      defaultTipo = 'PRACA';
    }
    return { file, group: 'proprio_municipal', defaultSecretariaSigla, defaultTipo };
  }

  if (file.startsWith('UnidadesEscolares')) {
    const defaultTipo = /almoxarifado|secretaria|merenda/i.test(file)
      ? 'PREDIO_ADMINISTRATIVO'
      : 'ESCOLA';
    return { file, group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo };
  }

  if (file.startsWith('ImvelPblico')) {
    return { file, group: 'imovel_publico', defaultSecretariaSigla: 'SSMA', defaultTipo: 'OUTRO' };
  }

  return null;
}

function isSupportedLayerFile(file: string) {
  return LAYER_PREFIXES.some((prefix) => file.startsWith(prefix));
}

export async function resolveWebmapLayers(options: {
  discoveredFiles?: string[];
  autoDiscover?: boolean;
} = {}): Promise<{ layers: WebmapLayerConfig[]; discoveredFiles: string[]; autoDiscovered: string[] }> {
  const autoDiscover = options.autoDiscover ?? process.env.WEBMAP_AUTO_DISCOVER !== 'false';
  let discoveredFiles = options.discoveredFiles ?? [];

  if (autoDiscover && discoveredFiles.length === 0) {
    discoveredFiles = (await fetchGithubLayerFiles()).filter(isSupportedLayerFile);
  }

  const mergedFiles = new Set<string>([
    ...WEBMAP_LAYER_FILES.map((layer) => layer.file),
    ...discoveredFiles,
  ]);

  const autoDiscovered: string[] = [];
  const layers: WebmapLayerConfig[] = [];

  for (const file of mergedFiles) {
    const staticLayer = STATIC_BY_FILE.get(file);
    if (staticLayer) {
      layers.push(staticLayer);
      continue;
    }
    const inferred = inferLayerConfig(file);
    if (inferred) {
      layers.push(inferred);
      autoDiscovered.push(file);
    }
  }

  layers.sort((a, b) => a.file.localeCompare(b.file, 'pt-BR'));
  return { layers, discoveredFiles, autoDiscovered };
}

export { inferLayerConfig as inferLayerConfigForTest };

