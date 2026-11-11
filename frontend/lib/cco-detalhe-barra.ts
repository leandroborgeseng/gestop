/**
 * 321 — convivência da barra de detalhes com Filtros/Camadas.
 * Abaixo de 1024 px só um painel fica aberto. Em qualquer largura o painel de
 * Filtros/Camadas fica à direita (o mesmo lado da barra), então abrir a barra
 * fecha esse painel. Os filtros já aplicados não entram aqui: quem chama só
 * descarta o rascunho não aplicado.
 */
export const LARGURA_UM_PAINEL_PX = 1024;

export function fecharDetalheAoAbrirPainel(larguraPx: number): boolean {
  return larguraPx < LARGURA_UM_PAINEL_PX;
}

export function fecharPainelAoAbrirDetalhe(): boolean {
  return true;
}
