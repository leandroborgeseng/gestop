export type LikertCategoria = 'RUIM' | 'NEUTRA' | 'BOA';

export type LikertNivelId = 'PESSIMO' | 'RUIM' | 'REGULAR' | 'BOM' | 'OTIMO';

export type LikertConformidade = 'CONFORME' | 'NAO_CONFORME';

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

export const LIKERT_CONFORMIDADE_PADRAO: Record<LikertNivelId, LikertConformidade> = {
  PESSIMO: 'NAO_CONFORME',
  RUIM: 'NAO_CONFORME',
  REGULAR: 'CONFORME',
  BOM: 'CONFORME',
  OTIMO: 'CONFORME',
};

export type ChecklistLikertOpcoes = {
  niveis: LikertNivelId[];
  conformidadePorNivel?: Partial<Record<LikertNivelId, LikertConformidade>>;
};

export const LIKERT_CATEGORIA_TONE: Record<LikertCategoria, string> = {
  RUIM: 'border-[var(--danger-bd)] bg-[var(--danger-soft)] text-[var(--danger)]',
  NEUTRA: 'border-[var(--warn-bd)] bg-[var(--warn-bg)] text-[var(--warn)]',
  BOA: 'border-[var(--ok-bd)] bg-[var(--ok-bg)] text-[var(--ok)]',
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

function parseConformidadePorNivel(
  raw: unknown,
  niveis: LikertNivelId[],
): Partial<Record<LikertNivelId, LikertConformidade>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const source = raw as Record<string, unknown>;
  const result: Partial<Record<LikertNivelId, LikertConformidade>> = {};
  let hasAny = false;
  for (const id of niveis) {
    const value = source[id];
    if (value === 'CONFORME' || value === 'NAO_CONFORME') {
      result[id] = value;
      hasAny = true;
    }
  }
  return hasAny ? result : undefined;
}

function buildLikertOpcoes(
  ids: LikertNivelId[],
  conformidadeRaw?: unknown,
): ChecklistLikertOpcoes {
  const niveis = ids.length >= 2 ? ids : [...LIKERT_NIVEIS_PADRAO];
  const conformidadePorNivel = parseConformidadePorNivel(conformidadeRaw, niveis);
  return conformidadePorNivel ? { niveis, conformidadePorNivel } : { niveis };
}

export function parseLikertConfig(opcoes: unknown): { niveis: LikertNivelDef[]; opcoes: ChecklistLikertOpcoes } {
  if (opcoes && typeof opcoes === 'object' && Array.isArray((opcoes as ChecklistLikertOpcoes).niveis)) {
    const raw = opcoes as ChecklistLikertOpcoes;
    const ids = normalizeNivelIds(raw.niveis.map(String));
    const parsed = buildLikertOpcoes(ids, raw.conformidadePorNivel);
    return { niveis: parsed.niveis.map((id) => LIKERT_CATALOGO[id]), opcoes: parsed };
  }

  if (opcoes && typeof opcoes === 'object' && Array.isArray((opcoes as { opcoes?: unknown }).opcoes)) {
    const ids = normalizeNivelIds((opcoes as { opcoes: unknown[] }).opcoes.map(String));
    const conformidadeRaw = (opcoes as { conformidadePorNivel?: unknown }).conformidadePorNivel;
    const parsed = buildLikertOpcoes(ids, conformidadeRaw);
    return { niveis: parsed.niveis.map((id) => LIKERT_CATALOGO[id]), opcoes: parsed };
  }

  if (Array.isArray(opcoes)) {
    const ids = normalizeNivelIds(opcoes.map(String));
    const parsed = buildLikertOpcoes(ids);
    return { niveis: parsed.niveis.map((id) => LIKERT_CATALOGO[id]), opcoes: parsed };
  }

  const parsed = buildLikertOpcoes([...LIKERT_NIVEIS_PADRAO]);
  return { niveis: parsed.niveis.map((id) => LIKERT_CATALOGO[id]), opcoes: parsed };
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

export function inferConformidadeFromLikert(nivel: LikertNivelDef): LikertConformidade {
  return LIKERT_CONFORMIDADE_PADRAO[nivel.id] ?? (nivel.categoria === 'RUIM' ? 'NAO_CONFORME' : 'CONFORME');
}

export function resolveLikertConformidade(
  nivel: LikertNivelDef,
  opcoes?: ChecklistLikertOpcoes | unknown,
): LikertConformidade {
  if (opcoes && typeof opcoes === 'object') {
    const map = (opcoes as ChecklistLikertOpcoes).conformidadePorNivel;
    const override = map?.[nivel.id];
    if (override === 'CONFORME' || override === 'NAO_CONFORME') return override;
  }
  return inferConformidadeFromLikert(nivel);
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
