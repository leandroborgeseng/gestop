import { GeoPoint, haversineDistanceMeters, isGpsAccuracyAcceptable } from './geo';
import { DEFAULT_RAIO_VALIDACAO_METROS } from './constants';

export type FiscalizacaoCheckinInput = {
  unidade: GeoPoint & {
    raioValidacaoMetros?: number | null;
  };
  agente: GeoPoint & {
    precisaoMetros: number;
  };
};

export type ChecklistVersionRef = {
  checklistId: string;
  versaoId: string;
  versao: number;
};

export type NonConformityEvidenceInput = {
  conformidade: 'CONFORME' | 'NAO_CONFORME' | 'NAO_APLICAVEL';
  itemExigeEvidencia: boolean;
  evidenciasCount: number;
  comentario?: string | null;
};

export function evaluateFiscalizacaoCheckin(input: FiscalizacaoCheckinInput) {
  const radiusMeters = input.unidade.raioValidacaoMetros ?? DEFAULT_RAIO_VALIDACAO_METROS;
  const distanceMeters = haversineDistanceMeters(input.unidade, input.agente);
  const gpsAccuracyAccepted = isGpsAccuracyAcceptable(input.agente.precisaoMetros);

  return {
    distanceMeters,
    radiusMeters,
    gpsAccuracyAccepted,
    withinAllowedRadius: distanceMeters <= radiusMeters,
    canStart: gpsAccuracyAccepted && distanceMeters <= radiusMeters,
  };
}

export function validateNonConformityEvidence(input: NonConformityEvidenceInput) {
  if (input.conformidade !== 'NAO_CONFORME') {
    return { valid: true, reasons: [] as string[] };
  }

  const reasons: string[] = [];

  if (input.itemExigeEvidencia && input.evidenciasCount < 1) {
    reasons.push('Nao conformidade exige pelo menos uma evidencia.');
  }

  if (!input.comentario?.trim()) {
    reasons.push('Nao conformidade exige comentario descritivo.');
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

export function inspectionKeepsChecklistVersion(
  inspectionVersionId: string,
  originalVersion: ChecklistVersionRef,
) {
  return inspectionVersionId === originalVersion.versaoId;
}
