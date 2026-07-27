import type { ChecklistItem } from '@/lib/types';
import { resolveLikertNivel } from '@/lib/likert-scale';

export type EvidenceDraft = {
  id: string;
  dataUrl: string;
  mimeType?: string;
  size?: number;
};

export type ResponseDraft = {
  conformidade: 'CONFORME' | 'NAO_CONFORME' | 'NAO_APLICAVEL';
  comentario: string;
  valorTexto?: string;
  valorNumero?: number;
  valorBooleano?: boolean | null;
  /** Quando NC e item gera chamado: true = abre chamado; false = só registra NC pendente. */
  gerarChamado?: boolean;
  evidencias?: EvidenceDraft[];
  /** @deprecated Preferir `evidencias`. Mantido para rascunhos/offline antigos. */
  evidenceDataUrl?: string;
  evidenceMimeType?: string;
  evidenceSize?: number;
};

export function newEvidenceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Normaliza draft legado (uma foto) para a lista `evidencias`. */
export function getResponseEvidencias(response?: ResponseDraft | null): EvidenceDraft[] {
  if (!response) return [];
  if (Array.isArray(response.evidencias) && response.evidencias.length > 0) {
    return response.evidencias;
  }
  if (response.evidenceDataUrl) {
    return [
      {
        id: 'legacy',
        dataUrl: response.evidenceDataUrl,
        mimeType: response.evidenceMimeType,
        size: response.evidenceSize,
      },
    ];
  }
  return [];
}

export function validateItemResponse(item: ChecklistItem, response?: ResponseDraft) {
  if (!response) {
    if (!item.obrigatorio) return null;
    return `Preencha o item obrigatório: ${item.titulo}.`;
  }

  if (item.obrigatorio) {
    if (item.tipo === 'BOOLEANO') {
      if (response.conformidade === 'NAO_APLICAVEL') {
        // N/A is a valid answer
      } else if (response.valorBooleano == null) {
        return `Selecione Sim, Não ou Não aplicável: ${item.titulo}.`;
      }
    }

    const needsValue = ['TEXTO', 'NUMERO', 'DATA', 'MULTIPLA_ESCOLHA', 'ESCALA_LIKERT'].includes(item.tipo);
    if (needsValue && item.tipo === 'ESCALA_LIKERT' && !resolveLikertNivel(response.valorTexto)) {
      return `Selecione um nível na escala: ${item.titulo}.`;
    }
    if (needsValue && item.tipo !== 'ESCALA_LIKERT' && !response.valorTexto?.trim()) {
      return `Informe a resposta do item: ${item.titulo}.`;
    }
  }

  const needsEvidence =
    item.tipo === 'FOTO' ||
    item.tipo === 'ASSINATURA' ||
    (response.conformidade === 'NAO_CONFORME' && item.exigeEvidencia);

  const evidenciasCount = getResponseEvidencias(response).length;

  if (needsEvidence && evidenciasCount < 1) {
    return `A pergunta exige evidência fotográfica: ${item.titulo}.`;
  }

  if (response.conformidade === 'NAO_CONFORME' && item.exigeEvidencia) {
    if (evidenciasCount < 1 || !response.comentario.trim()) {
      return `Não conformidade exige comentário e evidência: ${item.titulo}.`;
    }
  }

  return null;
}

export function buildRespostaPayload(
  item: ChecklistItem,
  response: ResponseDraft,
  checkin: { latitude: number; longitude: number; precisaoMetros: number },
  capturedAt: string,
) {
  const localizacao = {
    latitude: checkin.latitude,
    longitude: checkin.longitude,
    precisaoMetros: checkin.precisaoMetros,
  };

  const evidencias = getResponseEvidencias(response).map((evidencia) => ({
    tipo: 'FOTO' as const,
    url: evidencia.dataUrl,
    mimeType: evidencia.mimeType,
    tamanhoBytes: evidencia.size,
    capturadaEm: capturedAt,
    localizacao,
  }));

  return {
    itemId: item.id,
    conformidade: response.conformidade,
    valorBooleano:
      item.tipo === 'BOOLEANO'
        ? response.conformidade === 'NAO_APLICAVEL'
          ? null
          : response.valorBooleano ?? null
        : undefined,
    valorTexto: item.tipo === 'ESCALA_LIKERT' ? response.valorTexto : response.valorTexto,
    valorNumero: item.tipo === 'ESCALA_LIKERT' ? response.valorNumero : undefined,
    comentario: response.comentario,
    ...(response.conformidade === 'NAO_CONFORME' && item.geraNaoConformidade
      ? { gerarChamado: response.gerarChamado !== false }
      : {}),
    evidencias,
  };
}
