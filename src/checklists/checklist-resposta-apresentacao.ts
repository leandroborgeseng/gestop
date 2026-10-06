import { apresentarValorTexto } from './checklist-item.rules';

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
    return resposta.conformidade === 'CONFORME' ? 'Conforme' : resposta.conformidade === 'NAO_CONFORME' ? 'Não conforme' : String(resposta.conformidade);
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
