import { UnidadeTipo } from '@prisma/client';

export type WebmapLayerConfig = {
  file: string;
  group: 'proprio_municipal' | 'unidade_escolar' | 'imovel_publico';
  defaultSecretariaSigla: string;
  defaultTipo: UnidadeTipo;
};

/** Camadas B + C — SMMAFRANCA/webmap (qgis2web) */
export const WEBMAP_LAYER_FILES: WebmapLayerConfig[] = [
  // Próprio Público Municipal
  { file: 'PrprioPblicoMunicipalArena3unid_48.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMEL', defaultTipo: UnidadeTipo.ESPACO_ESPORTIVO },
  { file: 'PrprioPblicoMunicipalAtenoPrimria24unid_43.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMS', defaultTipo: UnidadeTipo.UBS },
  { file: 'PrprioPblicoMunicipalBiblioteca1unid_49.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMCT', defaultTipo: UnidadeTipo.OUTRO },
  { file: 'PrprioPblicoMunicipalCEPEL12unid_53.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SME', defaultTipo: UnidadeTipo.ESCOLA },
  { file: 'PrprioPblicoMunicipalCampo25unid_50.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMEL', defaultTipo: UnidadeTipo.ESPACO_ESPORTIVO },
  { file: 'PrprioPblicoMunicipalCasa1unid_51.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SSMA', defaultTipo: UnidadeTipo.PREDIO_ADMINISTRATIVO },
  { file: 'PrprioPblicoMunicipalCentro4unid_52.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SSMA', defaultTipo: UnidadeTipo.OUTRO },
  { file: 'PrprioPblicoMunicipalConjunto4unid_54.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SSMA', defaultTipo: UnidadeTipo.OUTRO },
  { file: 'PrprioPblicoMunicipalEstadio1unid_55.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMEL', defaultTipo: UnidadeTipo.ESPACO_ESPORTIVO },
  { file: 'PrprioPblicoMunicipalGestoAdministrativo3unid_44.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMF', defaultTipo: UnidadeTipo.PREDIO_ADMINISTRATIVO },
  { file: 'PrprioPblicoMunicipalGinsio5unid_56.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMEL', defaultTipo: UnidadeTipo.ESPACO_ESPORTIVO },
  { file: 'PrprioPblicoMunicipalMuseu2unid_57.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMCT', defaultTipo: UnidadeTipo.OUTRO },
  { file: 'PrprioPblicoMunicipalParque2unid_58.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SSMA', defaultTipo: UnidadeTipo.PRACA },
  { file: 'PrprioPblicoMunicipalPavilho1unid_59.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMEL', defaultTipo: UnidadeTipo.OUTRO },
  { file: 'PrprioPblicoMunicipalPinacoteca1unid_60.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMCT', defaultTipo: UnidadeTipo.OUTRO },
  { file: 'PrprioPblicoMunicipalPiscina1unid_61.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMEL', defaultTipo: UnidadeTipo.ESPACO_ESPORTIVO },
  { file: 'PrprioPblicoMunicipalPista1unid_62.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMEL', defaultTipo: UnidadeTipo.ESPACO_ESPORTIVO },
  { file: 'PrprioPblicoMunicipalPraa3unid_63.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SSMA', defaultTipo: UnidadeTipo.PRACA },
  { file: 'PrprioPblicoMunicipalQuadra3unid_64.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMEL', defaultTipo: UnidadeTipo.ESPACO_ESPORTIVO },
  { file: 'PrprioPblicoMunicipalSecretaria1unid_65.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMF', defaultTipo: UnidadeTipo.PREDIO_ADMINISTRATIVO },
  { file: 'PrprioPblicoMunicipalServiodeEspecialidadesDiagnstico14unid_46.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMS', defaultTipo: UnidadeTipo.UBS },
  { file: 'PrprioPblicoMunicipalTeatro2unid_66.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMCT', defaultTipo: UnidadeTipo.OUTRO },
  { file: 'PrprioPblicoMunicipalUnidadedeUrgnciaeEmergncia8unid_45.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMS', defaultTipo: UnidadeTipo.UBS },
  { file: 'PrprioPblicoMunicipalVigilnciaemSade5unid_47.js', group: 'proprio_municipal', defaultSecretariaSigla: 'SMS', defaultTipo: UnidadeTipo.UBS },
  // Unidades Escolares
  { file: 'UnidadesEscolaresAlfabetizaaodeJovenseAdultos15unid_67.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: UnidadeTipo.ESCOLA },
  { file: 'UnidadesEscolaresAlmoxarifadoEducao1unid_68.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: UnidadeTipo.PREDIO_ADMINISTRATIVO },
  { file: 'UnidadesEscolaresCEICentrodeEducaoIntegradaGustavoChereghiniBichuette1unid_69.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: UnidadeTipo.ESCOLA },
  { file: 'UnidadesEscolaresCreche35unid_70.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: UnidadeTipo.ESCOLA },
  { file: 'UnidadesEscolaresCrechePrEscola45unid_71.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: UnidadeTipo.ESCOLA },
  { file: 'UnidadesEscolaresEdInfantil9unid_72.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: UnidadeTipo.ESCOLA },
  { file: 'UnidadesEscolaresEdInfantilEnsFundamental39unid_73.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: UnidadeTipo.ESCOLA },
  { file: 'UnidadesEscolaresEJA3unid_74.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: UnidadeTipo.ESCOLA },
  { file: 'UnidadesEscolaresEnsFundamental3unid_75.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: UnidadeTipo.ESCOLA },
  { file: 'UnidadesEscolaresEspaodeDifusoCientfica1unid_76.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: UnidadeTipo.OUTRO },
  { file: 'UnidadesEscolaresSecretariaMunicipaldeEducao1unid_77.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: UnidadeTipo.PREDIO_ADMINISTRATIVO },
  { file: 'UnidadesEscolaresSetordeMerenda1unid_78.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: UnidadeTipo.PREDIO_ADMINISTRATIVO },
  { file: 'UnidadesEscolaresUniversidadeAbertadoBrasilUAB1unid_79.js', group: 'unidade_escolar', defaultSecretariaSigla: 'SME', defaultTipo: UnidadeTipo.OUTRO },
  // Imóvel Público (limpeza / SEINFRA)
  { file: 'ImvelPblico120unid_86.js', group: 'imovel_publico', defaultSecretariaSigla: 'SSMA', defaultTipo: UnidadeTipo.OUTRO },
];

export const WEBMAP_RAW_BASE =
  process.env.WEBMAP_RAW_BASE?.trim() ??
  'https://raw.githubusercontent.com/SMMAFRANCA/webmap/main/layers';
