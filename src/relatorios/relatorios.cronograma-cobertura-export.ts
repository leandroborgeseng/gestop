import { CronogramaFrequencia, UnidadeTipo } from '@prisma/client';
import { formatIsoDate } from './relatorios.csv';

const UNIDADE_TIPO_LABELS: Record<UnidadeTipo, string> = {
  ESCOLA: 'Escola',
  UBS: 'UBS',
  PRACA: 'Praça',
  PREDIO_ADMINISTRATIVO: 'Prédio administrativo',
  ESPACO_ESPORTIVO: 'Espaço esportivo',
  OUTRO: 'Outro',
};

const FREQUENCIA_LABELS: Record<CronogramaFrequencia, string> = {
  SEMANAL: 'Semanal',
  QUINZENAL: 'Quinzenal',
  MENSAL: 'Mensal',
  BIMESTRAL: 'Bimestral',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
};

export type CronogramaCoberturaCronograma = {
  frequencia: CronogramaFrequencia;
  proximaChecagemEm: Date;
  ativo: boolean;
  createdAt: Date;
  checklist: { nome: string };
  responsavel: { nome: string } | null;
  responsaveis: Array<{ usuario: { nome: string } }>;
};

export type CronogramaCoberturaUnidade = {
  codigoPatrimonial: string;
  nome: string;
  tipo: UnidadeTipo;
  endereco: string;
  secretaria: { sigla: string; nome: string };
  cronogramas: CronogramaCoberturaCronograma[];
};

export const CRONOGRAMA_COBERTURA_HEADERS = [
  'secretaria_sigla',
  'secretaria_nome',
  'codigo_patrimonial',
  'nome',
  'tipo',
  'endereco',
  'checklist',
  'periodicidade',
  'data_inicio',
  'proxima_data',
  'responsaveis',
  'situacao_cronograma',
  'status_cobertura',
] as const;

export type CronogramaCoberturaRow = {
  secretariaSigla: string;
  secretariaNome: string;
  codigo: string;
  nome: string;
  tipo: string;
  endereco: string;
  checklist: string;
  periodicidade: string;
  dataInicio: string;
  proximaData: string;
  responsaveis: string;
  situacaoCronograma: string;
  statusCobertura: string;
};

function resolveResponsaveisLabel(cronograma: CronogramaCoberturaCronograma) {
  const fromJunction = cronograma.responsaveis.map((item) => item.usuario.nome).filter(Boolean);
  if (fromJunction.length > 0) return fromJunction.join(', ');
  return cronograma.responsavel?.nome ?? '';
}

export function mapCronogramaCoberturaRow(
  unidade: CronogramaCoberturaUnidade,
  cronograma: CronogramaCoberturaCronograma | null,
): CronogramaCoberturaRow {
  const base = {
    secretariaSigla: unidade.secretaria.sigla,
    secretariaNome: unidade.secretaria.nome,
    codigo: unidade.codigoPatrimonial,
    nome: unidade.nome,
    tipo: UNIDADE_TIPO_LABELS[unidade.tipo] ?? unidade.tipo,
    endereco: unidade.endereco,
  };

  if (!cronograma) {
    return {
      ...base,
      checklist: '—',
      periodicidade: '—',
      dataInicio: '',
      proximaData: 'Sem vistoria programada',
      responsaveis: '—',
      situacaoCronograma: '—',
      statusCobertura: 'Sem cronograma vinculado',
    };
  }

  return {
    ...base,
    checklist: cronograma.checklist.nome,
    periodicidade: FREQUENCIA_LABELS[cronograma.frequencia] ?? cronograma.frequencia,
    dataInicio: formatIsoDate(cronograma.createdAt),
    proximaData: formatIsoDate(cronograma.proximaChecagemEm),
    responsaveis: resolveResponsaveisLabel(cronograma) || 'Sem responsável definido',
    situacaoCronograma: cronograma.ativo ? 'Ativo' : 'Inativo',
    statusCobertura: 'Com cronograma vinculado',
  };
}

/** Uma linha por próprio sem cronograma; uma linha por cronograma quando houver mais de um. */
export function buildCronogramaCoberturaRows(unidades: CronogramaCoberturaUnidade[]): CronogramaCoberturaRow[] {
  const rows: CronogramaCoberturaRow[] = [];
  for (const unidade of unidades) {
    if (unidade.cronogramas.length === 0) {
      rows.push(mapCronogramaCoberturaRow(unidade, null));
      continue;
    }
    for (const cronograma of unidade.cronogramas) {
      rows.push(mapCronogramaCoberturaRow(unidade, cronograma));
    }
  }
  return rows;
}

export function mapCronogramaCoberturaExportRows(unidades: CronogramaCoberturaUnidade[]) {
  return buildCronogramaCoberturaRows(unidades).map((row) => [
    row.secretariaSigla,
    row.secretariaNome,
    row.codigo,
    row.nome,
    row.tipo,
    row.endereco,
    row.checklist,
    row.periodicidade,
    row.dataInicio,
    row.proximaData,
    row.responsaveis,
    row.situacaoCronograma,
    row.statusCobertura,
  ]);
}

export type CronogramaCoberturaTotais = {
  totalUnidades: number;
  comCronograma: number;
  semCronograma: number;
  totalCronogramas: number;
  cronogramasAtivos: number;
};

export function computeCronogramaCoberturaTotais(unidades: CronogramaCoberturaUnidade[]): CronogramaCoberturaTotais {
  const totalUnidades = unidades.length;
  const comCronograma = unidades.filter((unidade) => unidade.cronogramas.length > 0).length;
  const totalCronogramas = unidades.reduce((sum, unidade) => sum + unidade.cronogramas.length, 0);
  const cronogramasAtivos = unidades.reduce(
    (sum, unidade) => sum + unidade.cronogramas.filter((cronograma) => cronograma.ativo).length,
    0,
  );

  return {
    totalUnidades,
    comCronograma,
    semCronograma: totalUnidades - comCronograma,
    totalCronogramas,
    cronogramasAtivos,
  };
}

export function formatCronogramaCoberturaSummaryLines(totais: CronogramaCoberturaTotais): string[] {
  const percentual =
    totais.totalUnidades > 0 ? Math.round((totais.comCronograma / totais.totalUnidades) * 100) : 0;

  return [
    `Total de próprios ativos: ${totais.totalUnidades}`,
    `Com cronograma vinculado: ${totais.comCronograma} (${percentual}%)`,
    `Sem cronograma vinculado: ${totais.semCronograma}`,
    `Total de cronogramas no filtro: ${totais.totalCronogramas} (${totais.cronogramasAtivos} ativo(s))`,
  ];
}
