import { formatIsoDate } from './relatorios.csv';
import { formatCoordenada } from './relatorios.execucao-coords';

type FiscalizacaoExportItem = {
  id: string;
  status: string;
  origem: string;
  iniciadaEm: Date | null;
  concluidaEm: Date | null;
  dentroRaioPermitido: boolean | null;
  distanciaCheckinMetros: unknown;
  checkinLatitude: unknown;
  checkinLongitude: unknown;
  checkoutLatitude: unknown;
  checkoutLongitude: unknown;
  observacoes: string | null;
  unidade: {
    codigoPatrimonial: string;
    nome: string;
    secretaria: { sigla: string };
  };
  agente: { nome: string };
  checklistVersao?: {
    versao: number;
    checklist: { nome: string };
  } | null;
};

function toNumber(value: unknown) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export const FISCALIZACOES_EXPORT_HEADERS = [
  'id',
  'status',
  'origem',
  'secretaria_sigla',
  'unidade_codigo',
  'unidade_nome',
  'checklist',
  'checklist_versao',
  'agente',
  'iniciada_em',
  'concluida_em',
  'checkin_latitude',
  'checkin_longitude',
  'checkout_latitude',
  'checkout_longitude',
  'dentro_raio',
  'distancia_metros',
  'observacoes',
] as const;

export function mapFiscalizacoesExportRows(items: FiscalizacaoExportItem[]) {
  return items.map((item) => [
    item.id,
    item.status,
    item.origem,
    item.unidade.secretaria.sigla,
    item.unidade.codigoPatrimonial,
    item.unidade.nome,
    item.checklistVersao?.checklist.nome ?? '',
    item.checklistVersao?.versao ?? '',
    item.agente.nome,
    formatIsoDate(item.iniciadaEm),
    formatIsoDate(item.concluidaEm),
    formatCoordenada(toNumber(item.checkinLatitude)),
    formatCoordenada(toNumber(item.checkinLongitude)),
    formatCoordenada(toNumber(item.checkoutLatitude)),
    formatCoordenada(toNumber(item.checkoutLongitude)),
    item.dentroRaioPermitido == null ? '' : item.dentroRaioPermitido ? 'Sim' : 'Nao',
    item.distanciaCheckinMetros == null ? '' : String(toNumber(item.distanciaCheckinMetros) ?? ''),
    item.observacoes ?? '',
  ]);
}
