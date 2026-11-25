import { ConformidadeStatus } from '@prisma/client';
import { precisaoMaxCheckinMetros } from './mobile.config';
import { evaluateFiscalizacaoCheckin, validateNonConformityEvidence } from '../domain/rules';

export function validateMobileCheckin(input: {
  unidade: {
    latitude: number;
    longitude: number;
    raioValidacaoMetros: number;
  };
  checkin: {
    latitude: number;
    longitude: number;
    precisaoMetros: number;
  };
  /** G2a: limite de precisão (m); padrão vem da configuração (D2: 50 m). */
  precisaoMaxMetros?: number;
}) {
  const precisaoMax = input.precisaoMaxMetros ?? precisaoMaxCheckinMetros();
  const result = evaluateFiscalizacaoCheckin(
    {
      unidade: input.unidade,
      agente: input.checkin,
    },
    precisaoMax,
  );

  if (!result.canStart) {
    const reasons = [];
    if (!result.gpsAccuracyAccepted) reasons.push(`Precisao do GPS acima de ${precisaoMax} m`);
    if (!result.withinAllowedRadius) reasons.push(`Fora do raio permitido de ${result.radiusMeters} m`);

    return {
      valid: false,
      result,
      reasons,
    };
  }

  return {
    valid: true,
    result,
    reasons: [] as string[],
  };
}

export function validateMobileResponse(input: {
  conformidade: ConformidadeStatus;
  itemExigeEvidencia: boolean;
  evidenciasCount: number;
  comentario?: string | null;
}) {
  return validateNonConformityEvidence({
    conformidade: input.conformidade,
    itemExigeEvidencia: input.itemExigeEvidencia,
    evidenciasCount: input.evidenciasCount,
    comentario: input.comentario,
  });
}
