/**
 * 321 — convivência da barra de detalhes com Filtros/Camadas.
 * Abaixo de 1024 px só um painel fica aberto. Em qualquer largura o painel de
 * Filtros/Camadas fica à direita (o mesmo lado da barra), então abrir a barra
 * fecha esse painel. Os filtros já aplicados não entram aqui: quem chama só
 * descarta o rascunho não aplicado.
 */
export const LARGURA_UM_PAINEL_PX = 1024;

/** O `xl:` da grade é 80rem. A barra usa o mesmo corte, em rem, para acompanhar a fonte do navegador. */
export const CORTE_GRADE_REM = 80;
export const CONSULTA_BARRA_ESTREITA = '(max-width: 79.999rem)';

export function barraEmpilhada(larguraPx: number, fontSizePx: number): boolean {
  return larguraPx < CORTE_GRADE_REM * fontSizePx;
}

export function fecharDetalheAoAbrirPainel(larguraPx: number): boolean {
  return larguraPx < LARGURA_UM_PAINEL_PX;
}

export function fecharPainelAoAbrirDetalhe(): boolean {
  return true;
}
