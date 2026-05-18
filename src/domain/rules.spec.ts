import { describe, expect, it } from 'vitest';
import { haversineDistanceMeters } from './geo';
import {
  evaluateFiscalizacaoCheckin,
  inspectionKeepsChecklistVersion,
  validateNonConformityEvidence,
} from './rules';

describe('regras de georreferenciamento', () => {
  it('permite iniciar fiscalizacao dentro do raio de 200 m com GPS preciso', () => {
    const result = evaluateFiscalizacaoCheckin({
      unidade: {
        latitude: -20.53936,
        longitude: -47.40081,
        raioValidacaoMetros: 200,
      },
      agente: {
        latitude: -20.5394,
        longitude: -47.4008,
        precisaoMetros: 12,
      },
    });

    expect(result.withinAllowedRadius).toBe(true);
    expect(result.gpsAccuracyAccepted).toBe(true);
    expect(result.canStart).toBe(true);
  });

  it('bloqueia fiscalizacao fora do raio permitido', () => {
    const result = evaluateFiscalizacaoCheckin({
      unidade: {
        latitude: -20.53936,
        longitude: -47.40081,
        raioValidacaoMetros: 200,
      },
      agente: {
        latitude: -20.5475,
        longitude: -47.4089,
        precisaoMetros: 10,
      },
    });

    expect(result.distanceMeters).toBeGreaterThan(200);
    expect(result.canStart).toBe(false);
  });

  it('bloqueia fiscalizacao quando a precisao do GPS excede 50 m', () => {
    const result = evaluateFiscalizacaoCheckin({
      unidade: {
        latitude: -20.53936,
        longitude: -47.40081,
      },
      agente: {
        latitude: -20.5394,
        longitude: -47.4008,
        precisaoMetros: 80,
      },
    });

    expect(result.withinAllowedRadius).toBe(true);
    expect(result.gpsAccuracyAccepted).toBe(false);
    expect(result.canStart).toBe(false);
  });

  it('calcula distancia aproximada entre dois pontos em metros', () => {
    const distance = haversineDistanceMeters(
      { latitude: -20.53936, longitude: -47.40081 },
      { latitude: -20.5394, longitude: -47.4008 },
    );

    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(10);
  });
});

describe('regras de nao conformidade', () => {
  it('exige evidencia e comentario para item nao conforme', () => {
    const result = validateNonConformityEvidence({
      conformidade: 'NAO_CONFORME',
      itemExigeEvidencia: true,
      evidenciasCount: 0,
      comentario: '',
    });

    expect(result.valid).toBe(false);
    expect(result.reasons).toHaveLength(2);
  });

  it('aceita nao conformidade com evidencia e comentario', () => {
    const result = validateNonConformityEvidence({
      conformidade: 'NAO_CONFORME',
      itemExigeEvidencia: true,
      evidenciasCount: 1,
      comentario: 'Luminaria queimada no corredor principal.',
    });

    expect(result.valid).toBe(true);
  });
});

describe('versionamento de checklists', () => {
  it('mantem a fiscalizacao presa a versao usada na execucao', () => {
    expect(
      inspectionKeepsChecklistVersion('versao-1', {
        checklistId: 'checklist-escola',
        versaoId: 'versao-1',
        versao: 1,
      }),
    ).toBe(true);

    expect(
      inspectionKeepsChecklistVersion('versao-2', {
        checklistId: 'checklist-escola',
        versaoId: 'versao-1',
        versao: 1,
      }),
    ).toBe(false);
  });
});
