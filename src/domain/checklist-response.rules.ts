import { ChecklistItemTipo, ConformidadeStatus } from '@prisma/client';
import { getMultiplaEscolhaValues } from '../checklists/checklist-item.rules';
import { validateNonConformityEvidence } from './rules';

export type ChecklistItemForValidation = {
  id: string;
  titulo: string;
  tipo: ChecklistItemTipo;
  obrigatorio: boolean;
  exigeEvidencia: boolean;
  opcoes?: unknown;
};

export type ChecklistResponseForValidation = {
  itemId: string;
  conformidade: ConformidadeStatus;
  valorTexto?: string | null;
  comentario?: string | null;
  evidenciasCount: number;
};

const VALUE_TYPES: ChecklistItemTipo[] = [
  ChecklistItemTipo.TEXTO,
  ChecklistItemTipo.NUMERO,
  ChecklistItemTipo.DATA,
  ChecklistItemTipo.MULTIPLA_ESCOLHA,
];

export function validateChecklistItemResponse(
  item: ChecklistItemForValidation,
  response?: ChecklistResponseForValidation,
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (!item.obrigatorio) {
    if (!response) return { valid: true, reasons };
  } else if (!response) {
    reasons.push(`Preencha o item obrigatorio: ${item.titulo}.`);
    return { valid: false, reasons };
  }

  if (!response) return { valid: true, reasons };

  if (VALUE_TYPES.includes(item.tipo) && !response.valorTexto?.trim()) {
    reasons.push(`Informe a resposta do item: ${item.titulo}.`);
  }

  if (item.tipo === ChecklistItemTipo.MULTIPLA_ESCOLHA) {
    const opcoes = getMultiplaEscolhaValues(item.opcoes);
    const valor = response.valorTexto?.trim() ?? '';
    if (valor && !opcoes.includes(valor)) {
      reasons.push(`Resposta invalida para o item: ${item.titulo}.`);
    }
  }

  const needsEvidence =
    item.tipo === ChecklistItemTipo.FOTO ||
    item.tipo === ChecklistItemTipo.ASSINATURA ||
    (response.conformidade === ConformidadeStatus.NAO_CONFORME && item.exigeEvidencia);

  if (needsEvidence && response.evidenciasCount < 1) {
    reasons.push(`Anexe evidencia no item: ${item.titulo}.`);
  }

  const ncValidation = validateNonConformityEvidence({
    conformidade: response.conformidade,
    itemExigeEvidencia: item.exigeEvidencia,
    evidenciasCount: response.evidenciasCount,
    comentario: response.comentario,
  });

  if (!ncValidation.valid) {
    reasons.push(...ncValidation.reasons.map((reason) => `${item.titulo}: ${reason}`));
  }

  return { valid: reasons.length === 0, reasons };
}

export function validateChecklistResponses(
  itens: ChecklistItemForValidation[],
  respostas: ChecklistResponseForValidation[],
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const itemById = new Map(itens.map((item) => [item.id, item]));
  const answeredIds = new Set<string>();

  for (const resposta of respostas) {
    if (answeredIds.has(resposta.itemId)) {
      reasons.push('Resposta duplicada para o mesmo item de checklist.');
      continue;
    }
    answeredIds.add(resposta.itemId);

    const item = itemById.get(resposta.itemId);
    if (!item) {
      reasons.push('Item de checklist invalido.');
      continue;
    }

    const validation = validateChecklistItemResponse(item, resposta);
    if (!validation.valid) {
      reasons.push(...validation.reasons);
    }
  }

  for (const item of itens) {
    if (!item.obrigatorio) continue;
    if (!answeredIds.has(item.id)) {
      reasons.push(`Preencha o item obrigatorio: ${item.titulo}.`);
    }
  }

  return { valid: reasons.length === 0, reasons };
}
