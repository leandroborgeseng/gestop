import { FilaItemSync, MobileQueuedInspection } from './types';

/** 304/O6/O10: classifica o erro do envio para o item ficar na fila com o motivo visível. */
export function classificarErroSync(err: unknown, agora = new Date(), anterior?: FilaItemSync): FilaItemSync {
  const e = (err ?? {}) as { status?: number; codigo?: string; rede?: boolean; message?: string };
  const mensagem = e.message || 'Falha ao sincronizar.';
  const tipo: FilaItemSync['tipo'] = e.rede
    ? 'REDE'
    : e.status === 409
      ? 'CONFLITO'
      : e.status === 403
        ? 'ESCOPO'
        : e.status === 400
          ? 'VALIDACAO'
          : 'ERRO';
  return { tipo, mensagem, ...(e.codigo ? { codigo: e.codigo } : {}), tentativas: (anterior?.tentativas ?? 0) + 1, ultimaTentativaEm: agora.toISOString() };
}

export function rotuloErroSync(s: FilaItemSync) {
  switch (s.tipo) {
    case 'CONFLITO':
      return `Conflito com o servidor: ${s.mensagem} Nada foi sobrescrito.`;
    case 'ESCOPO':
      return `Sem acesso: ${s.mensagem}`;
    case 'VALIDACAO':
      return `Recusada pelo servidor: ${s.mensagem}`;
    case 'REDE':
      return 'Sem conexão com o servidor. Tenta de novo ao reconectar.';
    default:
      return s.mensagem;
  }
}

export const MOTIVO_AVULSA_MIN = 5;

/**
 * 304/O6a: transforma um item em CONFLITO em vistoria avulsa: tira o vínculo de baixa (cronogramaId/dataProgramada),
 * guarda a referência da programação e o motivo (obrigatório). Retorna `{ erro }` se não der.
 */
export function marcarComoAvulsaPorConflito<T extends MobileQueuedInspection>(
  item: T,
  motivo: string,
): { item: T } | { erro: string } {
  const texto = motivo.trim();
  if (texto.length < MOTIVO_AVULSA_MIN) return { erro: `Informe o motivo (mínimo ${MOTIVO_AVULSA_MIN} caracteres).` };
  if (!item.cronogramaId || !item.dataProgramada) return { erro: 'Esta vistoria não está ligada a uma programação.' };
  const { cronogramaId, dataProgramada, programacaoAtualizadaEm: _p, sync, ...resto } = item;
  void _p;
  return {
    item: {
      ...resto,
      avulsaPorConflito: { motivo: texto, cronogramaId, dataProgramada, ...(sync?.codigo ? { codigo: sync.codigo } : {}) },
    } as T,
  };
}
