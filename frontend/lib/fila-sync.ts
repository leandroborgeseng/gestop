import { FilaItemSync } from './types';

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
