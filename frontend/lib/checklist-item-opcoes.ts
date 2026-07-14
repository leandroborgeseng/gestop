export type ChecklistTextoFormato = 'CURTO' | 'LONGO';

export type ChecklistMultiplaEscolhaModo = 'SELECT' | 'LISTA';

export type ChecklistConformidadeBinaria = 'CONFORME' | 'NAO_CONFORME';

export type ChecklistTextoOpcoes = {
  formato: ChecklistTextoFormato;
};

export type ChecklistMultiplaEscolhaOpcoes = {
  opcoes: string[];
  notas?: Array<number | null>;
  modoExibicao: ChecklistMultiplaEscolhaModo;
};

export type ChecklistBooleanoOpcoes = {
  pontuar?: boolean;
  notaSim?: number | null;
  notaNao?: number | null;
  simConformidade?: ChecklistConformidadeBinaria;
  naoConformidade?: ChecklistConformidadeBinaria;
};

export {
  LIKERT_CATEGORIA_LABELS,
  LIKERT_CATEGORIA_TONE,
  LIKERT_CATALOGO,
  LIKERT_CONFORMIDADE_PADRAO,
  LIKERT_NIVEIS_ORDEM,
  LIKERT_NIVEIS_PADRAO,
  inferConformidadeFromLikert,
  parseLikertConfig,
  resolveLikertConformidade,
  resolveLikertNivel,
  serializeLikertOpcoes,
  validateLikertOpcoes,
  type ChecklistLikertOpcoes,
  type LikertCategoria,
  type LikertConformidade,
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

export const CONFORMIDADE_BINARIA_LABELS: Record<ChecklistConformidadeBinaria, string> = {
  CONFORME: 'Conforme',
  NAO_CONFORME: 'Não conforme',
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

function parseNotaSlot(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function isNotaInRange(nota: number): boolean {
  return nota >= 0 && nota <= 10;
}

function alignNotas(opcoes: string[], notas: Array<number | null> | undefined): Array<number | null> | undefined {
  if (!notas) return undefined;
  return opcoes.map((_, index) => (index < notas.length ? notas[index] ?? null : null));
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
  if (tipo === 'BOOLEANO') {
    return {
      simConformidade: 'CONFORME' satisfies ChecklistConformidadeBinaria,
      naoConformidade: 'NAO_CONFORME' satisfies ChecklistConformidadeBinaria,
    };
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

export function parseBooleanoOpcoes(opcoes: unknown): ChecklistBooleanoOpcoes {
  if (!opcoes || typeof opcoes !== 'object') {
    return {
      pontuar: false,
      notaSim: null,
      notaNao: null,
      simConformidade: 'CONFORME',
      naoConformidade: 'NAO_CONFORME',
    };
  }

  const raw = opcoes as Partial<ChecklistBooleanoOpcoes>;
  return {
    pontuar: Boolean(raw.pontuar),
    notaSim: parseNotaSlot(raw.notaSim),
    notaNao: parseNotaSlot(raw.notaNao),
    simConformidade: raw.simConformidade === 'NAO_CONFORME' ? 'NAO_CONFORME' : 'CONFORME',
    naoConformidade: raw.naoConformidade === 'CONFORME' ? 'CONFORME' : 'NAO_CONFORME',
  };
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
    const filled = values.length >= 2 ? values : ['', ''];
    const notasRaw = Array.isArray(raw.notas) ? raw.notas.map(parseNotaSlot) : undefined;
    return {
      opcoes: filled,
      modoExibicao,
      notas: alignNotas(filled, notasRaw),
    };
  }

  return { opcoes: ['', ''], modoExibicao: 'SELECT' };
}

export function serializeItemOpcoes(tipo: string, opcoes: unknown): unknown {
  if (tipo === 'MULTIPLA_ESCOLHA') {
    const config = parseMultiplaEscolhaOpcoes(opcoes);
    const paired = config.opcoes
      .map((value, index) => ({
        opcao: value.trim(),
        nota: config.notas ? config.notas[index] ?? null : null,
      }))
      .filter((entry) => entry.opcao);

    const result: ChecklistMultiplaEscolhaOpcoes = {
      opcoes: paired.map((entry) => entry.opcao),
      modoExibicao: config.modoExibicao,
    };

    if (config.notas != null) {
      result.notas = paired.map((entry) => entry.nota);
    }

    return result;
  }

  if (tipo === 'TEXTO') {
    return parseTextoOpcoes(opcoes);
  }

  if (tipo === 'BOOLEANO') {
    const config = parseBooleanoOpcoes(opcoes);
    const result: ChecklistBooleanoOpcoes = {
      simConformidade: config.simConformidade,
      naoConformidade: config.naoConformidade,
    };
    if (config.pontuar) {
      result.pontuar = true;
      result.notaSim = config.notaSim;
      result.notaNao = config.notaNao;
    }
    return result;
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
    const comNotas = config.notas?.some((nota) => nota != null) ? ' · com notas' : '';
    return `${count} opção(ões) · ${MULTIPLA_ESCOLHA_MODO_LABELS[config.modoExibicao]}${comNotas}`;
  }

  if (tipo === 'TEXTO') {
    const config = parseTextoOpcoes(opcoes);
    return TEXTO_FORMATO_LABELS[config.formato];
  }

  if (tipo === 'BOOLEANO') {
    const config = parseBooleanoOpcoes(opcoes);
    const sim = CONFORMIDADE_BINARIA_LABELS[config.simConformidade ?? 'CONFORME'];
    const nao = CONFORMIDADE_BINARIA_LABELS[config.naoConformidade ?? 'NAO_CONFORME'];
    const pontuar = config.pontuar ? ' · pontua' : '';
    return `Sim=${sim} · Não=${nao}${pontuar}`;
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
    const filledIndexes = config.opcoes
      .map((value, index) => ({ value: value.trim(), index }))
      .filter((entry) => entry.value);

    if (filledIndexes.length < 2) {
      return `Item "${label}": cadastre ao menos 2 opções de múltipla escolha.`;
    }

    if (config.notas) {
      for (const entry of filledIndexes) {
        const nota = config.notas[entry.index];
        if (nota != null && !isNotaInRange(nota)) {
          return `Item "${label}": nota da opção deve estar entre 0 e 10.`;
        }
      }

      const someHaveNota = filledIndexes.some((entry) => config.notas![entry.index] != null);
      if (someHaveNota) {
        const allHaveNota = filledIndexes.every((entry) => {
          const nota = config.notas![entry.index];
          return nota != null && isNotaInRange(nota);
        });
        if (!allHaveNota) {
          return `Item "${label}": se uma opção tiver nota, todas as opções devem ter nota entre 0 e 10.`;
        }
      }
    }
  }

  if (tipo === 'BOOLEANO') {
    const config = parseBooleanoOpcoes(opcoes);
    if (config.pontuar) {
      if (config.notaSim == null || config.notaNao == null) {
        return `Item "${label}": informe as notas de Sim e Não (0 a 10).`;
      }
      if (!isNotaInRange(config.notaSim) || !isNotaInRange(config.notaNao)) {
        return `Item "${label}": notas de Sim/Não devem estar entre 0 e 10.`;
      }
    } else {
      for (const nota of [config.notaSim, config.notaNao]) {
        if (nota != null && !isNotaInRange(nota)) {
          return `Item "${label}": notas de Sim/Não devem estar entre 0 e 10.`;
        }
      }
    }
  }

  if (tipo === 'ESCALA_LIKERT') {
    return validateLikertOpcoes(opcoes, label);
  }

  return null;
}
