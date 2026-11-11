/** UX-01: grade, modal formal e export (PDF, CSV e XLSX) usam o mesmo teto. */
export const TETO_LINHAS_RELATORIO_TAREFAS = 500;

/**
 * Aviso quando o filtro passa do teto. Com total ≤ teto, não há aviso.
 * O número mostrado é o que a consulta devolveu, no máximo o teto.
 */
export function avisoCorteRelatorioTarefas(
  total: number,
  exibidas: number,
  teto = TETO_LINHAS_RELATORIO_TAREFAS,
): string | null {
  if (!Number.isFinite(total) || total <= teto) return null;
  const mostradas = Math.min(Math.max(0, exibidas), teto);
  return `Mostrando ${mostradas} de ${total} tarefas`;
}
