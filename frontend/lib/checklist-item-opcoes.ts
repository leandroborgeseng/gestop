export type ChecklistTextoFormato = 'CURTO' | 'LONGO';

export type ChecklistMultiplaEscolhaModo = 'SELECT' | 'LISTA';

export type ChecklistTextoOpcoes = {
  formato: ChecklistTextoFormato;
};

export type ChecklistMultiplaEscolhaOpcoes = {
  opcoes: string[];
  modoExibicao: ChecklistMultiplaEscolhaModo;
};

export {
  LIKERT_CATEGORIA_LABELS,
  LIKERT_CATEGORIA_TONE,
  LIKERT_CATALOGO,
  LIKERT_NIVEIS_ORDEM,
  LIKERT_NIVEIS_PADRAO,
  inferConformidadeFromLikert,
  parseLikertConfig,
  resolveLikertNivel,
  serializeLikertOpcoes,
  validateLikertOpcoes,
  type ChecklistLikertOpcoes,
  type LikertCategoria,
  type LikertNivelDef,
  type LikertNivelId,
} from '@/lib/likert-scale';

import {
  LIKERT_NIVEIS_PADRAO,
  parseLikertConfig,
  serializeLikertOpcoes,
  validateLikertOpcoes,
} from '@/lib/likert-scale';

export const TEXTO_FORMATO_LABELS: Record<ChecklistTextoFormato, string> = {
  CURTO: 'Texto curto (uma linha)',
  LONGO: 'Texto longo (várias linhas, expansível)',
};

export const MULTIPLA_ESCOLHA_MODO_LABELS: Record<ChecklistMultiplaEscolhaModo, string> = {
  SELECT: 'Lista suspensa',
  LISTA: 'Todas as opções na tela',
};

/** @deprecated Use parseLikertConfig */
export function parseLikertOpcoes(opcoes: unknown) {
  const config = parseLikertConfig(opcoes);
  return {
    opcoes: config.niveis.map((nivel) => nivel.label),
    niveis: config.niveis,
    opcoesConfig: config.opcoes,
  };
}

export function defaultOpcoesForTipo(tipo: string): unknown {
  if (tipo === 'MULTIPLA_ESCOLHA') {
    return { opcoes: ['', ''], modoExibicao: 'SELECT' satisfies ChecklistMultiplaEscolhaModo };
  }
  if (tipo === 'ESCALA_LIKERT') {
    return { niveis: [...LIKERT_NIVEIS_PADRAO] };
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
    return serializeLikertOpcoes(opcoes);
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
    const config = parseLikertConfig(opcoes);
    return `Escala Likert · ${config.niveis.map((nivel) => `${nivel.label} (${nivel.pontuacao})`).join(' → ')}`;
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
    return validateLikertOpcoes(opcoes, label);
  }

  return null;
}
