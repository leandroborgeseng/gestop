import { ConformidadeStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { validateMobileCheckin, validateMobileResponse } from './mobile.rules';

describe('regras mobile de fiscalização', () => {
  it('permite check-in dentro do raio com GPS preciso', () => {
    const result = validateMobileCheckin({
      unidade: {
        latitude: -20.53936,
        longitude: -47.40081,
        raioValidacaoMetros: 200,
      },
      checkin: {
        latitude: -20.5394,
        longitude: -47.4008,
        precisaoMetros: 10,
      },
    });

    expect(result.valid).toBe(true);
    expect(result.result.canStart).toBe(true);
  });

  it('bloqueia check-in fora do raio permitido', () => {
    const result = validateMobileCheckin({
      unidade: {
        latitude: -20.53936,
        longitude: -47.40081,
        raioValidacaoMetros: 200,
      },
      checkin: {
        latitude: -20.55,
        longitude: -47.42,
        precisaoMetros: 10,
      },
    });

    expect(result.valid).toBe(false);
    expect(result.reasons.join(' ')).toContain('Fora do raio permitido');
  });

  it('bloqueia nao conformidade sem evidencia e comentario', () => {
    const result = validateMobileResponse({
      conformidade: ConformidadeStatus.NAO_CONFORME,
      itemExigeEvidencia: true,
      evidenciasCount: 0,
      comentario: '',
    });

    expect(result.valid).toBe(false);
    expect(result.reasons).toHaveLength(2);
  });
});
