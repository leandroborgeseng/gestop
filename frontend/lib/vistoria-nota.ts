export type VistoriaNotaResumo = {
  notaGeral: number | null;
  notasPorCategoria: Array<{
    categoriaId: string;
    categoriaNome: string;
    nota: number;
  }>;
};

export function clampNota(nota: number) {
  return Math.min(10, Math.max(0, Math.round(nota * 10) / 10));
}

export function formatNotaBr(nota: number | null | undefined) {
  if (nota == null || Number.isNaN(nota)) return '—';
  return clampNota(nota).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function resolveNotaExibicao(
  resumo: VistoriaNotaResumo | null | undefined,
  categoriaId?: string | null,
): number | null {
  if (!resumo) return null;
  if (categoriaId) {
    return resumo.notasPorCategoria.find((item) => item.categoriaId === categoriaId)?.nota ?? null;
  }
  return resumo.notaGeral;
}

/** Cores conforme escala do PDF (86). */
export function notaCorHex(nota: number): string {
  const value = clampNota(nota);
  if (value <= 2) return '#7f1d1d';
  if (value <= 5) return '#fca5a5';
  if (value <= 8) return '#f97316';
  if (value <= 9) return '#86efac';
  return '#15803d';
}
