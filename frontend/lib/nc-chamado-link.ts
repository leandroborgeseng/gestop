/** 315: número do chamado na aba Não conformidades do CCO vira link para a tela de Chamados, já selecionado. */
export type NcChamadoRef = { id?: string | null; codigo?: string | null; excluidoEm?: string | Date | null } | null | undefined;

export function hrefChamadoDaNc(chamado: NcChamadoRef): string | null {
  if (!chamado?.id || !chamado.codigo || chamado.excluidoEm) return null;
  return `/chamados?id=${encodeURIComponent(chamado.id)}`;
}
