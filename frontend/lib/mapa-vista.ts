/** BK-321-O1: um reflow depois de zoom ou arraste manual não chama fitBounds. */
export function devePreservarVistaNoLayout(entrada: {
  motivo: 'data' | 'layout';
  vistaManual: boolean;
  zoomAtual: number;
  zoomAoAgendar: number;
}): boolean {
  if (entrada.motivo !== 'layout') return false;
  return entrada.vistaManual || entrada.zoomAtual > entrada.zoomAoAgendar + 0.01;
}
