import { formatCoordenada } from './relatorios.execucao-coords';

type UnidadeExportItem = {
  codigoPatrimonial: string;
  nome: string;
  tipo: string;
  endereco: string;
  bairro: string | null;
  cep: string | null;
  latitude: unknown;
  longitude: unknown;
  raioValidacaoMetros: number;
  ativo: boolean;
  secretaria: { sigla: string; nome: string };
};

export const UNIDADES_EXPORT_HEADERS = [
  'secretaria_sigla',
  'secretaria_nome',
  'codigo_patrimonial',
  'nome',
  'tipo',
  'endereco',
  'bairro',
  'cep',
  'latitude',
  'longitude',
  'raio_validacao_metros',
  'ativo',
] as const;

function toNumber(value: unknown) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapUnidadesExportRows(items: UnidadeExportItem[]) {
  return items.map((item) => [
    item.secretaria.sigla,
    item.secretaria.nome,
    item.codigoPatrimonial,
    item.nome,
    item.tipo,
    item.endereco,
    item.bairro ?? '',
    item.cep ?? '',
    formatCoordenada(toNumber(item.latitude)),
    formatCoordenada(toNumber(item.longitude)),
    item.raioValidacaoMetros,
    item.ativo ? 'Sim' : 'Nao',
  ]);
}
