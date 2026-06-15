export type ChecklistTextoFormato = 'CURTO' | 'LONGO';

export type ChecklistMultiplaEscolhaModo = 'SELECT' | 'LISTA';

export type ChecklistTextoOpcoes = {
  formato: ChecklistTextoFormato;
};

export type ChecklistMultiplaEscolhaOpcoes = {
  opcoes: string[];
  modoExibicao: ChecklistMultiplaEscolhaModo;
};

export const TEXTO_FORMATO_LABELS: Record<ChecklistTextoFormato, string> = {
  CURTO: 'Texto curto (uma linha)',
  LONGO: 'Texto longo (várias linhas, expansível)',
};

export const MULTIPLA_ESCOLHA_MODO_LABELS: Record<ChecklistMultiplaEscolhaModo, string> = {
  SELECT: 'Lista suspensa',
  LISTA: 'Todas as opções na tela',
};

export const LIKERT_ESCALA_PADRAO = ['Péssimo', 'Ruim', 'Bom', 'Ótimo'] as const;

export type ChecklistLikertOpcoes = {
  opcoes: string[];
};

export const LIKERT_TONE_CLASSES = [
  'border-[var(--danger-bd)] bg-[var(--danger-soft)] text-[var(--danger)]',
  'border-[var(--warn-bd)] bg-[var(--warn-bg)] text-[var(--warn)]',
  'border-[color-mix(in_srgb,var(--ok)_35%,var(--surface))] bg-[var(--ok-bg)] text-[var(--ok)]',
  'border-[var(--ok-bd)] bg-[var(--ok-bg)] text-[var(--ok)]',
] as const;

export function parseLikertOpcoes(opcoes: unknown): ChecklistLikertOpcoes {
  if (Array.isArray(opcoes)) {
    const values = opcoes.map(String).map((value) => value.trim()).filter(Boolean);
    return { opcoes: values.length >= 2 ? values : [...LIKERT_ESCALA_PADRAO] };
  }

  if (opcoes && typeof opcoes === 'object' && Array.isArray((opcoes as ChecklistLikertOpcoes).opcoes)) {
    const values = (opcoes as ChecklistLikertOpcoes).opcoes.map(String).map((value) => value.trim()).filter(Boolean);
    return { opcoes: values.length >= 2 ? values : [...LIKERT_ESCALA_PADRAO] };
  }

  return { opcoes: [...LIKERT_ESCALA_PADRAO] };
}

export function inferConformidadeFromLikert(opcoes: string[], valor: string): 'CONFORME' | 'NAO_CONFORME' {
  const index = opcoes.indexOf(valor);
  if (index < 0) return 'CONFORME';
  const threshold = Math.ceil(opcoes.length / 2);
  return index < threshold ? 'NAO_CONFORME' : 'CONFORME';
}

export function defaultOpcoesForTipo(tipo: string): unknown {
  if (tipo === 'MULTIPLA_ESCOLHA') {
    return { opcoes: ['', ''], modoExibicao: 'SELECT' satisfies ChecklistMultiplaEscolhaModo };
  }
  if (tipo === 'ESCALA_LIKERT') {
    return { opcoes: [...LIKERT_ESCALA_PADRAO] };
  }
  if (tipo === 'TEXTO') {
    return { formato: 'CURTO' satisfies ChecklistTextoFormato };
  }
  return undefined;
}

export function parseTextoOpcoes(opcoes: unknown): ChecklistTextoOpcoes {
  if (opcoes && typeof opcoes === 'object' && 'formato' in opcoes) {
    const formato = (opcoes as ChecklistTextoOpcoes).formato;
    if (formato === 'LONGO') return { formato: 'LONGO' };
  }
  return { formato: 'CURTO' };
}

export function parseMultiplaEscolhaOpcoes(opcoes: unknown): ChecklistMultiplaEscolhaOpcoes {
  if (Array.isArray(opcoes)) {
    const values = opcoes.map(String);
    return {
      opcoes: values.length >= 2 ? values : ['', ''],
      modoExibicao: 'SELECT',
    };
  }

  if (opcoes && typeof opcoes === 'object') {
    const raw = opcoes as Partial<ChecklistMultiplaEscolhaOpcoes> & { opcoes?: unknown };
    const values = Array.isArray(raw.opcoes) ? raw.opcoes.map(String) : ['', ''];
    const modoExibicao = raw.modoExibicao === 'LISTA' ? 'LISTA' : 'SELECT';
    return {
      opcoes: values.length >= 2 ? values : ['', ''],
      modoExibicao,
    };
  }

  return { opcoes: ['', ''], modoExibicao: 'SELECT' };
}

export function serializeItemOpcoes(tipo: string, opcoes: unknown): unknown {
  if (tipo === 'MULTIPLA_ESCOLHA') {
    const config = parseMultiplaEscolhaOpcoes(opcoes);
    return {
      opcoes: config.opcoes.map((value) => value.trim()).filter(Boolean),
      modoExibicao: config.modoExibicao,
    };
  }

  if (tipo === 'TEXTO') {
    return parseTextoOpcoes(opcoes);
  }

  if (tipo === 'ESCALA_LIKERT') {
    const config = parseLikertOpcoes(opcoes);
    return { opcoes: config.opcoes.map((value) => value.trim()).filter(Boolean) };
  }

  return undefined;
}

export function formatOpcoesResumo(tipo: string, opcoes: unknown): string | null {
  if (tipo === 'MULTIPLA_ESCOLHA') {
    const config = parseMultiplaEscolhaOpcoes(opcoes);
    const count = config.opcoes.map((value) => value.trim()).filter(Boolean).length;
    return `${count} opção(ões) · ${MULTIPLA_ESCOLHA_MODO_LABELS[config.modoExibicao]}`;
  }

  if (tipo === 'TEXTO') {
    const config = parseTextoOpcoes(opcoes);
    return TEXTO_FORMATO_LABELS[config.formato];
  }

  if (tipo === 'ESCALA_LIKERT') {
    const config = parseLikertOpcoes(opcoes);
    return `Escala Likert · ${config.opcoes.join(' → ')}`;
  }

  return null;
}

export function validateItemOpcoes(tipo: string, opcoes: unknown, titulo: string, codigo: string): string | null {
  const label = titulo.trim() || codigo.trim() || 'sem título';

  if (tipo === 'MULTIPLA_ESCOLHA') {
    const config = parseMultiplaEscolhaOpcoes(opcoes);
    const filled = config.opcoes.map((value) => value.trim()).filter(Boolean);
    if (filled.length < 2) {
      return `Item "${label}": cadastre ao menos 2 opções de múltipla escolha.`;
    }
  }

  if (tipo === 'ESCALA_LIKERT') {
    const raw =
      opcoes && typeof opcoes === 'object' && Array.isArray((opcoes as ChecklistLikertOpcoes).opcoes)
        ? (opcoes as ChecklistLikertOpcoes).opcoes.map(String).map((value) => value.trim()).filter(Boolean)
        : parseLikertOpcoes(opcoes).opcoes;
    if (raw.length < 2) {
      return `Item "${label}": cadastre ao menos 2 níveis na escala Likert.`;
    }
  }

  return null;
}
