import { ChecklistItemTipo } from '@prisma/client';
import { ChecklistItemDto } from './checklists.dto';
import { normalizeItemCode } from './checklist.rules';

type MultiplaEscolhaOpcoes = {
  opcoes: string[];
  modoExibicao: 'SELECT' | 'LISTA';
};

type TextoOpcoes = {
  formato: 'CURTO' | 'LONGO';
};

const LIKERT_ESCALA_PADRAO = ['Péssimo', 'Ruim', 'Bom', 'Ótimo'];

type LikertOpcoes = {
  opcoes: string[];
};

function parseLikertOpcoes(opcoes: unknown): LikertOpcoes {
  if (Array.isArray(opcoes)) {
    const values = opcoes.map(String).map((value) => value.trim()).filter(Boolean);
    return { opcoes: values.length >= 2 ? values : [...LIKERT_ESCALA_PADRAO] };
  }

  if (opcoes && typeof opcoes === 'object' && Array.isArray((opcoes as LikertOpcoes).opcoes)) {
    const values = (opcoes as LikertOpcoes).opcoes.map(String).map((value) => value.trim()).filter(Boolean);
    return { opcoes: values.length >= 2 ? values : [...LIKERT_ESCALA_PADRAO] };
  }

  return { opcoes: [...LIKERT_ESCALA_PADRAO] };
}

function parseMultiplaEscolhaOpcoes(opcoes: unknown): MultiplaEscolhaOpcoes {
  if (Array.isArray(opcoes)) {
    const values = opcoes.map(String).map((value) => value.trim()).filter(Boolean);
    return { opcoes: values.length >= 2 ? values : [], modoExibicao: 'SELECT' };
  }

  if (opcoes && typeof opcoes === 'object') {
    const raw = opcoes as Partial<MultiplaEscolhaOpcoes> & { opcoes?: unknown };
    const values = Array.isArray(raw.opcoes)
      ? raw.opcoes.map(String).map((value) => value.trim()).filter(Boolean)
      : [];
    return {
      opcoes: values,
      modoExibicao: raw.modoExibicao === 'LISTA' ? 'LISTA' : 'SELECT',
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

export function normalizeChecklistItemOpcoes(tipo: ChecklistItemTipo, opcoes: unknown): unknown | undefined {
  if (tipo === ChecklistItemTipo.MULTIPLA_ESCOLHA) {
    const config = parseMultiplaEscolhaOpcoes(opcoes);
    return {
      opcoes: config.opcoes,
      modoExibicao: config.modoExibicao,
    };
  }

  if (tipo === ChecklistItemTipo.TEXTO) {
    return parseTextoOpcoes(opcoes);
  }

  if (tipo === ChecklistItemTipo.ESCALA_LIKERT) {
    const config = parseLikertOpcoes(opcoes);
    return { opcoes: config.opcoes };
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
  }

  if (tipo === ChecklistItemTipo.ESCALA_LIKERT) {
    const raw =
      opcoes && typeof opcoes === 'object' && Array.isArray((opcoes as LikertOpcoes).opcoes)
        ? (opcoes as LikertOpcoes).opcoes.map(String).map((value) => value.trim()).filter(Boolean)
        : parseLikertOpcoes(opcoes).opcoes;
    if (raw.length < 2) {
      return `Item "${label}": cadastre ao menos 2 niveis na escala Likert.`;
    }
  }

  return null;
}

export function assertValidChecklistVersionItems(itens: ChecklistItemDto[]) {
  if (itens.length === 0) {
    throw new Error('Informe ao menos um item na versao do checklist.');
  }

  const codes = new Set<string>();

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

    const opcoesError = validateChecklistItemOpcoes(item.tipo, item.opcoes, item.titulo, item.codigo);
    if (opcoesError) {
      throw new Error(opcoesError);
    }
  }
}

export function getMultiplaEscolhaValues(opcoes: unknown): string[] {
  return parseMultiplaEscolhaOpcoes(opcoes).opcoes;
}

export function getLikertValues(opcoes: unknown): string[] {
  return parseLikertOpcoes(opcoes).opcoes;
}
