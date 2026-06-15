export type LikertCategoria = 'RUIM' | 'NEUTRA' | 'BOA';

export type LikertNivelId = 'PESSIMO' | 'RUIM' | 'REGULAR' | 'BOM' | 'OTIMO';

export type LikertNivelDef = {
  id: LikertNivelId;
  label: string;
  categoria: LikertCategoria;
  pontuacao: number;
};

export const LIKERT_CATEGORIA_LABELS: Record<LikertCategoria, string> = {
  RUIM: 'Ruim',
  NEUTRA: 'Neutra',
  BOA: 'Boa',
};

export const LIKERT_NIVEIS_ORDEM: LikertNivelId[] = ['PESSIMO', 'RUIM', 'REGULAR', 'BOM', 'OTIMO'];

export const LIKERT_CATALOGO: Record<LikertNivelId, LikertNivelDef> = {
  PESSIMO: { id: 'PESSIMO', label: 'Péssimo', categoria: 'RUIM', pontuacao: 0 },
  RUIM: { id: 'RUIM', label: 'Ruim', categoria: 'RUIM', pontuacao: 2 },
  REGULAR: { id: 'REGULAR', label: 'Regular', categoria: 'NEUTRA', pontuacao: 5 },
  BOM: { id: 'BOM', label: 'Bom', categoria: 'BOA', pontuacao: 8 },
  OTIMO: { id: 'OTIMO', label: 'Ótimo', categoria: 'BOA', pontuacao: 10 },
};

export const LIKERT_NIVEIS_PADRAO: LikertNivelId[] = [...LIKERT_NIVEIS_ORDEM];

export type ChecklistLikertOpcoes = {
  niveis: LikertNivelId[];
};

const LEGACY_LABEL_TO_ID: Record<string, LikertNivelId> = {
  Péssimo: 'PESSIMO',
  Pessimo: 'PESSIMO',
  Ruim: 'RUIM',
  Regular: 'REGULAR',
  Neutro: 'REGULAR',
  Bom: 'BOM',
  Ótimo: 'OTIMO',
  Otimo: 'OTIMO',
};

function isLikertNivelId(value: string): value is LikertNivelId {
  return value in LIKERT_CATALOGO;
}

function normalizeNivelIds(raw: string[]): LikertNivelId[] {
  const ids = raw
    .map((value) => {
      const trimmed = value.trim();
      if (isLikertNivelId(trimmed)) return trimmed;
      return LEGACY_LABEL_TO_ID[trimmed] ?? null;
    })
    .filter((value): value is LikertNivelId => value !== null);

  return LIKERT_NIVEIS_ORDEM.filter((id) => ids.includes(id));
}

export function parseLikertConfig(opcoes: unknown): { niveis: LikertNivelDef[]; opcoes: ChecklistLikertOpcoes } {
  if (opcoes && typeof opcoes === 'object' && Array.isArray((opcoes as ChecklistLikertOpcoes).niveis)) {
    const ids = normalizeNivelIds((opcoes as ChecklistLikertOpcoes).niveis.map(String));
    const niveis = ids.length >= 2 ? ids.map((id) => LIKERT_CATALOGO[id]) : LIKERT_NIVEIS_PADRAO.map((id) => LIKERT_CATALOGO[id]);
    return { niveis, opcoes: { niveis: niveis.map((nivel) => nivel.id) } };
  }

  if (opcoes && typeof opcoes === 'object' && Array.isArray((opcoes as { opcoes?: unknown }).opcoes)) {
    const ids = normalizeNivelIds((opcoes as { opcoes: unknown[] }).opcoes.map(String));
    const niveis = ids.length >= 2 ? ids.map((id) => LIKERT_CATALOGO[id]) : LIKERT_NIVEIS_PADRAO.map((id) => LIKERT_CATALOGO[id]);
    return { niveis, opcoes: { niveis: niveis.map((nivel) => nivel.id) } };
  }

  if (Array.isArray(opcoes)) {
    const ids = normalizeNivelIds(opcoes.map(String));
    const niveis = ids.length >= 2 ? ids.map((id) => LIKERT_CATALOGO[id]) : LIKERT_NIVEIS_PADRAO.map((id) => LIKERT_CATALOGO[id]);
    return { niveis, opcoes: { niveis: niveis.map((nivel) => nivel.id) } };
  }

  const niveis = LIKERT_NIVEIS_PADRAO.map((id) => LIKERT_CATALOGO[id]);
  return { niveis, opcoes: { niveis: [...LIKERT_NIVEIS_PADRAO] } };
}

export function serializeLikertOpcoes(opcoes: unknown): ChecklistLikertOpcoes {
  return parseLikertConfig(opcoes).opcoes;
}

export function resolveLikertNivel(valor: string | null | undefined): LikertNivelDef | null {
  if (!valor?.trim()) return null;
  const trimmed = valor.trim();
  if (isLikertNivelId(trimmed)) return LIKERT_CATALOGO[trimmed];
  const legacyId = LEGACY_LABEL_TO_ID[trimmed];
  return legacyId ? LIKERT_CATALOGO[legacyId] : null;
}

export function inferConformidadeFromLikert(nivel: LikertNivelDef): 'CONFORME' | 'NAO_CONFORME' {
  if (nivel.categoria === 'RUIM') return 'NAO_CONFORME';
  return 'CONFORME';
}

export function validateLikertOpcoes(opcoes: unknown, label: string): string | null {
  if (opcoes && typeof opcoes === 'object' && Array.isArray((opcoes as ChecklistLikertOpcoes).niveis)) {
    const ids = normalizeNivelIds((opcoes as ChecklistLikertOpcoes).niveis.map(String));
    if (ids.length < 2) {
      return `Item "${label}": selecione ao menos 2 níveis na escala Likert.`;
    }
    return null;
  }

  return null;
}

export function getLikertNivelIds(opcoes: unknown): string[] {
  return parseLikertConfig(opcoes).niveis.map((nivel) => nivel.id);
}

export function getLikertNivelLabels(opcoes: unknown): string[] {
  return parseLikertConfig(opcoes).niveis.map((nivel) => nivel.label);
}
