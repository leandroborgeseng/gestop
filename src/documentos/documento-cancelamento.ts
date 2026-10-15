import { ConflictException } from '@nestjs/common';
import { AuditAction, DocumentoAssinaturaPedidoStatus, DocumentoSituacao, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/jwt';
import { hasAnyPermission, isAdministradorSistema } from '../auth/permissions';

/** 287: chave da permissão de cancelamento lógico (catálogo: `matriz.documentos.cancelar.executar`). */
export const DOCUMENTOS_CANCELAR = 'documentos.cancelar';

/** Situações finais que não podem ser canceladas de novo. */
export const SITUACOES_NAO_CANCELAVEIS: DocumentoSituacao[] = [
  DocumentoSituacao.CANCELADO,
  DocumentoSituacao.SUBSTITUIDO,
  DocumentoSituacao.INVALIDO,
];

export function podeCancelarDocumento(user: Pick<JwtPayload, 'perfis' | 'permissoes'>) {
  return isAdministradorSistema(user) || hasAnyPermission(user, [DOCUMENTOS_CANCELAR]);
}

/**
 * Lista padrão esconde cancelados. Eles aparecem com o filtro de histórico ligado
 * ou quando o usuário filtra explicitamente por Cancelado.
 */
export function filtroCanceladosNaLista(query: {
  historico?: string;
  situacao?: DocumentoSituacao | string;
  assinatura?: string;
}): Prisma.DocumentoWhereInput | null {
  const historico = query.historico === '1' || query.historico === 'true';
  const pedeCancelado =
    query.situacao === DocumentoSituacao.CANCELADO || query.assinatura?.trim().toLowerCase() === 'cancelado';
  if (historico || pedeCancelado) return null;
  return { situacao: { not: DocumentoSituacao.CANCELADO } };
}

type TxCancelamento = {
  documento: {
    updateMany(args: Prisma.DocumentoUpdateManyArgs): Promise<{ count: number }>;
  };
  documentoAssinaturaPedido: {
    updateMany(args: Prisma.DocumentoAssinaturaPedidoUpdateManyArgs): Promise<{ count: number }>;
  };
  historicoStatus: { create(args: Prisma.HistoricoStatusCreateArgs): Promise<unknown> };
  logAuditoria: { create(args: Prisma.LogAuditoriaCreateArgs): Promise<unknown> };
};

/**
 * Cancelamento LÓGICO: nunca apaga. Muda a situação para CANCELADO com data e usuário,
 * retira os pedidos de assinatura pendentes (sai das pendências) e grava histórico + auditoria.
 * O update é condicional na situação atual: duas chamadas simultâneas não cancelam duas vezes.
 * Deve rodar dentro de `$transaction`.
 */
export async function cancelarDocumentoLogico(
  tx: TxCancelamento,
  input: {
    documentoId: string;
    situacaoAnterior: DocumentoSituacao;
    user: Pick<JwtPayload, 'sub' | 'nome' | 'email' | 'perfis'> & { secretariaId?: string | null };
    motivo?: string | null;
    agora?: Date;
  },
) {
  const agora = input.agora ?? new Date();
  const motivo = input.motivo?.trim() || null;
  const { count } = await tx.documento.updateMany({
    where: { id: input.documentoId, situacao: { notIn: SITUACOES_NAO_CANCELAVEIS } },
    data: {
      situacao: DocumentoSituacao.CANCELADO,
      canceladoEm: agora,
      canceladoPorId: input.user.sub,
      canceladoMotivo: motivo,
    },
  });
  if (count !== 1) {
    throw new ConflictException('Este documento já está cancelado, substituído ou inválido.');
  }

  const pedidos = await tx.documentoAssinaturaPedido.updateMany({
    where: { documentoId: input.documentoId, status: DocumentoAssinaturaPedidoStatus.PENDENTE },
    data: {
      status: DocumentoAssinaturaPedidoStatus.CANCELADO,
      canceladoEm: agora,
      canceladoMotivo: 'Documento cancelado',
    },
  });

  await tx.historicoStatus.create({
    data: {
      entidadeTipo: 'DOCUMENTO',
      entidadeId: input.documentoId,
      statusAnterior: input.situacaoAnterior,
      statusNovo: DocumentoSituacao.CANCELADO,
      motivo: motivo ?? 'Documento cancelado',
      alteradoPorId: input.user.sub,
      metadata: { cancelamentoLogico: true, pedidosCancelados: pedidos.count } as Prisma.InputJsonValue,
    },
  });

  await tx.logAuditoria.create({
    data: {
      usuarioId: input.user.sub,
      acao: AuditAction.STATUS_CHANGE,
      entidadeTipo: 'Documento',
      entidadeId: input.documentoId,
      valorAntigo: { situacao: input.situacaoAnterior } as Prisma.InputJsonValue,
      valorNovo: {
        situacao: DocumentoSituacao.CANCELADO,
        canceladoEm: agora.toISOString(),
        canceladoPorId: input.user.sub,
        canceladoPorNome: input.user.nome,
        motivo,
        pedidosCancelados: pedidos.count,
      } as Prisma.InputJsonValue,
      perfilAtivoNome: input.user.perfis[0] ?? null,
      secretariaAtivaId: input.user.secretariaId ?? null,
      tela: 'documentos',
      funcao: 'cancelar',
      descricao: 'Cancelamento lógico do documento',
    },
  });

  return { canceladoEm: agora, pedidosCancelados: pedidos.count };
}

/** Documento cancelado é só leitura. */
export function assertDocumentoNaoCancelado(documento: { situacao: DocumentoSituacao }) {
  if (documento.situacao === DocumentoSituacao.CANCELADO) {
    throw new ConflictException('Documento cancelado é somente leitura.');
  }
}
