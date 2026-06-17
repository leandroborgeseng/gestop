import { formatIsoDate } from './relatorios.csv';
import { formatCoordenada, type ExecucaoCoordenadas } from './relatorios.execucao-coords';

type ChamadoExportItem = {
  codigo: string;
  status: string;
  origem: string;
  prioridade: string;
  titulo: string | null;
  descricao: string;
  prazoEm: Date | null;
  concluidoEm: Date | null;
  createdAt: Date;
  encerradoEm: Date | null;
  secretaria: { sigla: string };
  unidade: { codigoPatrimonial: string; nome: string } | null;
  enderecoTexto?: string | null;
  responsavel: { nome: string } | null;
  execucao?: ExecucaoCoordenadas | null;
};

export const CHAMADOS_EXPORT_HEADERS = [
  'codigo',
  'status',
  'origem',
  'prioridade',
  'secretaria_sigla',
  'unidade_codigo',
  'unidade_nome',
  'titulo',
  'descricao',
  'responsavel',
  'prazo_em',
  'concluido_em',
  'criado_em',
  'encerrado_em',
  'execucao_latitude',
  'execucao_longitude',
] as const;

function chamadoUnidadeCodigo(item: ChamadoExportItem) {
  return item.unidade?.codigoPatrimonial ?? '';
}

function chamadoUnidadeNome(item: ChamadoExportItem) {
  if (item.unidade?.nome) return item.unidade.nome;
  if (item.enderecoTexto?.trim()) return item.enderecoTexto.trim();
  return 'Sem unidade vinculada';
}

export function mapChamadosExportRows(items: ChamadoExportItem[]) {
  return items.map((item) => [
    item.codigo,
    item.status,
    item.origem,
    item.prioridade,
    item.secretaria.sigla,
    chamadoUnidadeCodigo(item),
    chamadoUnidadeNome(item),
    item.titulo ?? '',
    item.descricao,
    item.responsavel?.nome ?? '',
    formatIsoDate(item.prazoEm),
    formatIsoDate(item.concluidoEm),
    formatIsoDate(item.createdAt),
    formatIsoDate(item.encerradoEm),
    formatCoordenada(item.execucao?.latitude),
    formatCoordenada(item.execucao?.longitude),
  ]);
}
