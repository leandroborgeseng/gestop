import { ConformidadeStatus } from '@prisma/client';
import { apresentarValorTexto } from './checklist-item.rules';

/** Mapa único de ConformidadeStatus. Valor fora do mapa vira "Outro", nunca o enum. */
export const CONFORMIDADE_STATUS_LABEL: Record<ConformidadeStatus, string> = {
  [ConformidadeStatus.CONFORME]: 'Conforme',
  [ConformidadeStatus.NAO_CONFORME]: 'Não conforme',
  [ConformidadeStatus.NAO_APLICAVEL]: 'Não se aplica',
};

export function conformidadeStatusLabel(status: string): string {
  if (Object.prototype.hasOwnProperty.call(CONFORMIDADE_STATUS_LABEL, status)) {
    return CONFORMIDADE_STATUS_LABEL[status as ConformidadeStatus];
  }
  return 'Outro';
}

export type RespostaParaApresentar = {
  valorTexto?: string | null;
  valorBooleano?: boolean | null;
  valorNumero?: unknown;
  conformidade?: string | null;
  naoSeAplica?: boolean;
};

/** Formata o valor gravado no banco para exibição. Usado pelo PDF de vistoria e pelos demais pontos. */
export function resolveRespostaTexto(resposta: RespostaParaApresentar): string {
  if (resposta.naoSeAplica) return 'Não se aplica';
  if (resposta.valorTexto?.trim()) return apresentarValorTexto(resposta.valorTexto.trim());
  if (resposta.valorBooleano === true) return 'Sim';
  if (resposta.valorBooleano === false) return 'Não';
  if (resposta.valorNumero != null) return String(resposta.valorNumero);
  if (resposta.conformidade) {
    return conformidadeStatusLabel(resposta.conformidade);
  }
  return '—';
}

/** Título visível da pergunta: nunca inclui o código técnico do item. */
export function tituloPerguntaChecklist(titulo: string, _codigo?: string): string {
  void _codigo;
  return titulo;
}

/** Cabeçalho de seção só na primeira pergunta de um grupo consecutivo. */
export function deveExibirCabecalhoSecao(atual?: string | null, anterior?: string | null): boolean {
  const secao = atual?.trim() ?? '';
  const previa = anterior?.trim() ?? '';
  return Boolean(secao) && secao !== previa;
}
