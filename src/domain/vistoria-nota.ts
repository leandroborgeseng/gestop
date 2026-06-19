import { ChecklistItemTipo } from '@prisma/client';
import { resolveLikertNivel } from './likert-scale';

export type RespostaLikertInput = {
  valorTexto?: string | null;
  item: {
    tipo: ChecklistItemTipo | string;
    categoriaVistoriaId?: string | null;
    categoriaVistoria?: { id: string; nome: string } | null;
  };
};

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

export function computeVistoriaNotas(respostas: RespostaLikertInput[]): VistoriaNotaResumo {
  const likert = respostas.filter((resposta) => resposta.item.tipo === ChecklistItemTipo.ESCALA_LIKERT);
  const pontosGeral = likert
    .map((resposta) => resolveLikertNivel(resposta.valorTexto))
    .filter((nivel): nivel is NonNullable<ReturnType<typeof resolveLikertNivel>> => Boolean(nivel))
    .map((nivel) => nivel.pontuacao);

  const notaGeral = pontosGeral.length
    ? clampNota(pontosGeral.reduce((acc, value) => acc + value, 0) / pontosGeral.length)
    : null;

  const porCategoria = new Map<string, { categoriaId: string; categoriaNome: string; pontos: number[] }>();

  for (const resposta of likert) {
    const nivel = resolveLikertNivel(resposta.valorTexto);
    if (!nivel || !resposta.item.categoriaVistoriaId) continue;

    const categoriaId = resposta.item.categoriaVistoriaId;
    const bucket =
      porCategoria.get(categoriaId) ??
      ({
        categoriaId,
        categoriaNome: resposta.item.categoriaVistoria?.nome ?? categoriaId,
        pontos: [],
      } as const);

    porCategoria.set(categoriaId, {
      ...bucket,
      pontos: [...bucket.pontos, nivel.pontuacao],
    });
  }

  const notasPorCategoria = [...porCategoria.values()]
    .map((item) => ({
      categoriaId: item.categoriaId,
      categoriaNome: item.categoriaNome,
      nota: clampNota(item.pontos.reduce((acc, value) => acc + value, 0) / item.pontos.length),
    }))
    .sort((a, b) => a.categoriaNome.localeCompare(b.categoriaNome));

  return { notaGeral, notasPorCategoria };
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
