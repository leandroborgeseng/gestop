import { ChamadoMapaItem, TipoPendencia, UnidadeOperacional } from '@/lib/types';

/** Status de chamado que ainda contam como pendência (alinhado ao backend). */
export const CHAMADO_PENDENCIA_STATUSES = new Set([
  'ABERTO',
  'EM_TRIAGEM',
  'EM_AVALIACAO_TECNICA',
  'EM_ATENDIMENTO',
  'EM_EXECUCAO',
  'IMPEDIDO',
]);

/**
 * Conta chamados pendentes únicos (por ID).
 * SLA dentro/fora é só classificação — não altera o total.
 */
export function countChamadosPendenciasUnicas(chamados: ChamadoMapaItem[]) {
  const ids = new Set<string>();
  for (const chamado of chamados) {
    if (CHAMADO_PENDENCIA_STATUSES.has(chamado.status)) {
      ids.add(chamado.id);
    }
  }
  return ids.size;
}

/**
 * Soma pendências únicas dos próprios já filtrados.
 * Prefere `pendenciasUnicas` da API; fallback local sem somar SLA.
 */
export function countUnidadesPendenciasUnicas(
  unidades: UnidadeOperacional[],
  tiposPendencia: TipoPendencia[],
) {
  return unidades.reduce((sum, unidade) => {
    if (typeof unidade.pendenciasUnicas === 'number') {
      return sum + unidade.pendenciasUnicas;
    }

    let total = 0;
    if (tiposPendencia.includes('CHAMADOS')) {
      total += unidade.pendencias.chamadosAbertos;
    }
    if (tiposPendencia.includes('NAO_CONFORMIDADES')) {
      total +=
        unidade.pendencias.naoConformidadesSemChamadoAberto ??
        unidade.pendencias.naoConformidadesAbertas;
    }
    if (tiposPendencia.includes('VISTORIAS') && unidade.pendencias.semVistoria) {
      total += 1;
    }
    return sum + total;
  }, 0);
}
