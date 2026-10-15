/** 287: textos e regras do cancelamento lógico de documento (UX do Designer). */
export const CANCELAR_DOCUMENTO_TEXTO = 'O documento sai das pendências, mas continua no histórico.';
export const CANCELAR_DOCUMENTO_SNACKBAR = 'Documento cancelado.';

export function tituloCancelarDocumento(codigo: string) {
  return `Cancelar documento ${codigo}?`;
}

type DocCancelamento = {
  situacao: string;
  podeCancelar?: boolean;
  cancelamento?: { em: string; por: { nome: string } | null } | null;
};

/** Cancelado = só leitura (sem ações de edição). */
export function documentoSomenteLeitura(doc: Pick<DocCancelamento, 'situacao'>) {
  return doc.situacao === 'CANCELADO';
}

/** O botão aparece só quando o backend libera (permissão) e o documento ainda não é final. */
export function mostrarBotaoCancelarDocumento(doc: DocCancelamento) {
  return Boolean(doc.podeCancelar) && !['CANCELADO', 'SUBSTITUIDO', 'INVALIDO'].includes(doc.situacao);
}

/** "15/10/2026 10:20 · Fulano" (data e usuário do cancelamento). */
export function rotuloCancelamento(doc: DocCancelamento) {
  if (!doc.cancelamento) return null;
  const data = new Date(doc.cancelamento.em).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return doc.cancelamento.por?.nome ? `${data} · ${doc.cancelamento.por.nome}` : data;
}
