import { ChecklistItemTipo } from '@prisma/client';
import { resolveLikertNivel } from './likert-scale';

export type RespostaNotaInput = {
  valorTexto?: string | null;
  valorBooleano?: boolean | null;
  item: {
    tipo: ChecklistItemTipo | string;
    opcoes?: unknown;
    categoriaVistoriaId?: string | null;
    categoriaVistoria?: { id: string; nome: string } | null;
  };
};

/** @deprecated Use RespostaNotaInput */
export type RespostaLikertInput = RespostaNotaInput;

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

function parseNotaSlot(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function resolveMultiplaEscolhaNota(valorTexto: string | null | undefined, opcoes: unknown): number | null {
  if (!valorTexto?.trim() || !opcoes || typeof opcoes !== 'object') return null;
  const raw = opcoes as { opcoes?: unknown; notas?: unknown };
  if (!Array.isArray(raw.opcoes) || !Array.isArray(raw.notas)) return null;

  const target = valorTexto.trim();
  const index = raw.opcoes.findIndex((opcao) => String(opcao).trim() === target);
  if (index < 0) return null;

  const nota = parseNotaSlot(raw.notas[index]);
  if (nota == null || nota < 0 || nota > 10) return null;
  return nota;
}

function resolveBooleanoNota(valorBooleano: boolean | null | undefined, opcoes: unknown): number | null {
  if (valorBooleano == null) return null;
  if (!opcoes || typeof opcoes !== 'object') return null;

  const raw = opcoes as { pontuar?: unknown; notaSim?: unknown; notaNao?: unknown };
  if (!raw.pontuar) return null;

  const nota = parseNotaSlot(valorBooleano ? raw.notaSim : raw.notaNao);
  if (nota == null || nota < 0 || nota > 10) return null;
  return nota;
}

function resolveRespostaNota(resposta: RespostaNotaInput): number | null {
  const tipo = resposta.item.tipo;

  if (tipo === ChecklistItemTipo.ESCALA_LIKERT || tipo === 'ESCALA_LIKERT') {
    return resolveLikertNivel(resposta.valorTexto)?.pontuacao ?? null;
  }

  if (tipo === ChecklistItemTipo.MULTIPLA_ESCOLHA || tipo === 'MULTIPLA_ESCOLHA') {
    return resolveMultiplaEscolhaNota(resposta.valorTexto, resposta.item.opcoes);
  }

  if (tipo === ChecklistItemTipo.BOOLEANO || tipo === 'BOOLEANO') {
    return resolveBooleanoNota(resposta.valorBooleano, resposta.item.opcoes);
  }

  return null;
}

export function computeVistoriaNotas(respostas: RespostaNotaInput[]): VistoriaNotaResumo {
  const scored = respostas
    .map((resposta) => ({ resposta, pontuacao: resolveRespostaNota(resposta) }))
    .filter((entry): entry is { resposta: RespostaNotaInput; pontuacao: number } => entry.pontuacao != null);

  const pontosGeral = scored.map((entry) => entry.pontuacao);
  const notaGeral = pontosGeral.length
    ? clampNota(pontosGeral.reduce((acc, value) => acc + value, 0) / pontosGeral.length)
    : null;

  const porCategoria = new Map<string, { categoriaId: string; categoriaNome: string; pontos: number[] }>();

  for (const { resposta, pontuacao } of scored) {
    if (!resposta.item.categoriaVistoriaId) continue;

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
      pontos: [...bucket.pontos, pontuacao],
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
