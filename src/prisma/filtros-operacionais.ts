import { PrismaClient } from '@prisma/client';
import { applyChamadoOperacionalFilter } from '../chamados/chamado-visibilidade';
import { applyFiscalizacaoOperacionalFilter } from '../fiscalizacoes/fiscalizacao-exclusao';

const CHAMADO_LIST_OPS = new Set(['findMany', 'findFirst', 'count', 'groupBy', 'aggregate']);
const FISCALIZACAO_LIST_OPS = new Set(['findMany', 'findFirst', 'findFirstOrThrow', 'count', 'groupBy', 'aggregate']);

/**
 * Filtros centrais de exclusão lógica: Chamado (excluidoEm) e, desde o 305, Fiscalizacao (vistoria excluída).
 * Uma leitura em lista que não cite `excluidoEm` no where só vê registros não excluídos.
 */
export function withFiltrosOperacionais(client: PrismaClient) {
  return client.$extends({
    query: {
      chamado: {
        async $allOperations({ operation, args, query }) {
          if (!CHAMADO_LIST_OPS.has(operation)) return query(args);
          return query(applyChamadoOperacionalFilter(args as never) as typeof args);
        },
      },
      fiscalizacao: {
        async $allOperations({ operation, args, query }) {
          if (!FISCALIZACAO_LIST_OPS.has(operation)) return query(args);
          return query(applyFiscalizacaoOperacionalFilter(args as never) as typeof args);
        },
      },
    },
  });
}
