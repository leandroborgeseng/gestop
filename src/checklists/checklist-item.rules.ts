import { ChecklistItemTipo } from '@prisma/client';
import {
  getLikertNivelIds,
  parseLikertConfig,
  serializeLikertOpcoes,
  validateLikertOpcoes,
} from '../domain/likert-scale';
import { ChecklistItemDto } from './checklists.dto';
import { normalizeItemCode } from './checklist.rules';

type MultiplaEscolhaOpcoes = {
  opcoes: string[];
  notas?: Array<number | null>;
  modoExibicao: 'SELECT' | 'LISTA';
};

type TextoOpcoes = {
  formato: 'CURTO' | 'LONGO';
};

type ConformidadeBinaria = 'CONFORME' | 'NAO_CONFORME';

type BooleanoOpcoes = {
  pontuar?: boolean;
  notaSim?: number | null;
  notaNao?: number | null;
  simConformidade?: ConformidadeBinaria;
  naoConformidade?: ConformidadeBinaria;
};

function parseNotaSlot(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function isNotaInRange(nota: number): boolean {
  return nota >= 0 && nota <= 10;
}

function parseMultiplaEscolhaOpcoes(opcoes: unknown): MultiplaEscolhaOpcoes {
  if (Array.isArray(opcoes)) {
    const values = opcoes.map(String).map((value) => value.trim()).filter(Boolean);
    return { opcoes: values.length >= 2 ? values : [], modoExibicao: 'SELECT' };
  }

  if (opcoes && typeof opcoes === 'object') {
    const raw = opcoes as Partial<MultiplaEscolhaOpcoes> & { opcoes?: unknown; notas?: unknown };
    const values = Array.isArray(raw.opcoes)
      ? raw.opcoes.map(String).map((value) => value.trim()).filter(Boolean)
      : [];
    const notasRaw = Array.isArray(raw.notas) ? raw.notas.map(parseNotaSlot) : undefined;
    const notas =
      notasRaw && Array.isArray(raw.opcoes)
        ? (raw.opcoes as unknown[])
            .map((value, index) => ({ value: String(value).trim(), nota: notasRaw[index] ?? null }))
            .filter((entry) => entry.value)
            .map((entry) => entry.nota)
        : undefined;

    return {
      opcoes: values,
      modoExibicao: raw.modoExibicao === 'LISTA' ? 'LISTA' : 'SELECT',
      ...(notasRaw ? { notas: notas ?? values.map(() => null) } : {}),
    };
  }

  return { opcoes: [], modoExibicao: 'SELECT' };
}

function parseTextoOpcoes(opcoes: unknown): TextoOpcoes {
  if (opcoes && typeof opcoes === 'object' && 'formato' in opcoes) {
    const formato = (opcoes as TextoOpcoes).formato;
    if (formato === 'LONGO') return { formato: 'LONGO' };
  }
  return { formato: 'CURTO' };
}

function parseBooleanoOpcoes(opcoes: unknown): BooleanoOpcoes {
  if (!opcoes || typeof opcoes !== 'object') {
    return {
      pontuar: false,
      notaSim: null,
      notaNao: null,
      simConformidade: 'CONFORME',
      naoConformidade: 'NAO_CONFORME',
    };
  }

  const raw = opcoes as Partial<BooleanoOpcoes>;
  return {
    pontuar: Boolean(raw.pontuar),
    notaSim: parseNotaSlot(raw.notaSim),
    notaNao: parseNotaSlot(raw.notaNao),
    simConformidade: raw.simConformidade === 'NAO_CONFORME' ? 'NAO_CONFORME' : 'CONFORME',
    naoConformidade: raw.naoConformidade === 'CONFORME' ? 'CONFORME' : 'NAO_CONFORME',
  };
}

export function normalizeChecklistItemOpcoes(tipo: ChecklistItemTipo, opcoes: unknown): unknown | undefined {
  if (tipo === ChecklistItemTipo.MULTIPLA_ESCOLHA) {
    const config = parseMultiplaEscolhaOpcoes(opcoes);
    const result: MultiplaEscolhaOpcoes = {
      opcoes: config.opcoes,
      modoExibicao: config.modoExibicao,
    };
    if (config.notas) {
      result.notas = config.notas;
    }
    return result;
  }

  if (tipo === ChecklistItemTipo.TEXTO) {
    return parseTextoOpcoes(opcoes);
  }

  if (tipo === ChecklistItemTipo.BOOLEANO) {
    const config = parseBooleanoOpcoes(opcoes);
    const result: BooleanoOpcoes = {
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

  if (tipo === ChecklistItemTipo.ESCALA_LIKERT) {
    return serializeLikertOpcoes(opcoes);
  }

  return undefined;
}

export function validateChecklistItemOpcoes(
  tipo: ChecklistItemTipo,
  opcoes: unknown,
  titulo: string,
  codigo: string,
): string | null {
  const label = titulo.trim() || codigo.trim() || 'sem titulo';

  if (tipo === ChecklistItemTipo.MULTIPLA_ESCOLHA) {
    const config = parseMultiplaEscolhaOpcoes(opcoes);
    if (config.opcoes.length < 2) {
      return `Item "${label}": cadastre ao menos 2 opcoes de multipla escolha.`;
    }

    if (config.notas) {
      for (const nota of config.notas) {
        if (nota != null && !isNotaInRange(nota)) {
          return `Item "${label}": nota da opcao deve estar entre 0 e 10.`;
        }
      }

      const someHaveNota = config.notas.some((nota) => nota != null);
      if (someHaveNota) {
        const allHaveNota =
          config.notas.length === config.opcoes.length &&
          config.notas.every((nota) => nota != null && isNotaInRange(nota));
        if (!allHaveNota) {
          return `Item "${label}": se uma opcao tiver nota, todas as opcoes devem ter nota entre 0 e 10.`;
        }
      }
    }
  }

  if (tipo === ChecklistItemTipo.BOOLEANO) {
    const config = parseBooleanoOpcoes(opcoes);
    if (config.pontuar) {
      if (config.notaSim == null || config.notaNao == null) {
        return `Item "${label}": informe as notas de Sim e Nao (0 a 10).`;
      }
      if (!isNotaInRange(config.notaSim) || !isNotaInRange(config.notaNao)) {
        return `Item "${label}": notas de Sim/Nao devem estar entre 0 e 10.`;
      }
    } else {
      for (const nota of [config.notaSim, config.notaNao]) {
        if (nota != null && !isNotaInRange(nota)) {
          return `Item "${label}": notas de Sim/Nao devem estar entre 0 e 10.`;
        }
      }
    }
  }

  if (tipo === ChecklistItemTipo.ESCALA_LIKERT) {
    return validateLikertOpcoes(opcoes, label);
  }

  return null;
}

export function assertValidChecklistVersionItems(
  itens: ChecklistItemDto[],
  options?: { requireCategoria?: boolean; finalidadeChamado?: boolean },
) {
  if (itens.length === 0) {
    throw new Error('Informe ao menos um item na versao do checklist.');
  }

  const codes = new Set<string>();
  const requireCategoria = options?.requireCategoria !== false && !options?.finalidadeChamado;

  for (const item of itens) {
    if (!item.titulo?.trim()) {
      throw new Error(`Item #${item.ordem}: informe o titulo.`);
    }

    if (!item.codigo?.trim()) {
      throw new Error(`Item #${item.ordem}: informe o codigo.`);
    }

    const normalizedCode = normalizeItemCode(item.codigo);
    if (codes.has(normalizedCode)) {
      throw new Error(`Codigo duplicado na versao: ${normalizedCode}`);
    }
    codes.add(normalizedCode);

    if (options?.finalidadeChamado && item.tipo === ChecklistItemTipo.ESCALA_LIKERT) {
      throw new Error(`Item "${item.titulo.trim()}": escala Likert nao e permitida em checklist de chamado.`);
    }

    const opcoesError = validateChecklistItemOpcoes(item.tipo, item.opcoes, item.titulo, item.codigo);
    if (opcoesError) {
      throw new Error(opcoesError);
    }

    if (requireCategoria && !item.categoriaVistoriaId?.trim()) {
      throw new Error(`Item "${item.titulo.trim() || item.codigo}": selecione a categoria de vistoria.`);
    }
  }
}

export function getMultiplaEscolhaValues(opcoes: unknown): string[] {
  return parseMultiplaEscolhaOpcoes(opcoes).opcoes;
}

export function getLikertValues(opcoes: unknown): string[] {
  return getLikertNivelIds(opcoes);
}

export { parseLikertConfig, parseBooleanoOpcoes, parseMultiplaEscolhaOpcoes };
