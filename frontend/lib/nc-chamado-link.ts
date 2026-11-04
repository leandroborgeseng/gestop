/** 315: link de chamado no drawer do CCO (mesma regra da aba Chamados). */
export type ChamadoLinkRef = { id?: string | null; status?: string | null };
export type NcChamadoRef = (ChamadoLinkRef & { codigo?: string | null; excluidoEm?: string | Date | null }) | null | undefined;

/** Em execução abre a Execução; os demais, a tela de Chamados já selecionado. */
export function hrefChamado(chamado: ChamadoLinkRef & { id: string }): string {
  return chamado.status === 'EM_EXECUCAO'
    ? `/execucao/${encodeURIComponent(chamado.id)}`
    : `/chamados?id=${encodeURIComponent(chamado.id)}`;
}

/** Número do chamado na aba Não conformidades: sem chamado, sem código ou excluído não gera link. */
export function hrefChamadoDaNc(chamado: NcChamadoRef): string | null {
  if (!chamado?.id || !chamado.codigo || chamado.excluidoEm) return null;
  return hrefChamado({ id: chamado.id, status: chamado.status });
}

/** Situações da NC em que o número do chamado aparece como link. */
export function ncMostraLinkChamado(situacao: string): boolean {
  return situacao === 'VINCULADA_EM_ANDAMENTO' || situacao === 'RESOLVIDA_CHAMADO';
}
