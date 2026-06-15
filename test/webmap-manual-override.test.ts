import { describe, expect, it } from 'vitest';
import { UnidadeTipo } from '@prisma/client';
import {
  buildManualOverrideOnEdit,
  getManualOverride,
  isWebmapImported,
  mergeMetadataForImport,
  valuesEqual,
} from '../prisma/webmap-manual-override';

const baseUnidade = {
  secretariaId: 'sec-1',
  nome: 'Escola Teste',
  tipo: UnidadeTipo.ESCOLA,
  endereco: 'Rua A, 100',
  bairro: 'Centro',
  cep: '14400-000',
  latitude: -20.5386,
  longitude: -47.4007,
  raioValidacaoMetros: 200,
  ativo: true,
};

describe('webmap-manual-override', () => {
  it('detecta unidade importada do webmap', () => {
    expect(isWebmapImported({ webmapSource: { repo: 'SMMAFRANCA/webmap' } })).toBe(true);
    expect(isWebmapImported({})).toBe(false);
  });

  it('bloqueia campos alterados manualmente', () => {
    const metadata = { webmapSource: { repo: 'SMMAFRANCA/webmap' } };
    const override = buildManualOverrideOnEdit(
      baseUnidade,
      { ...baseUnidade, bairro: 'Cidade Nova', nome: 'Escola Teste' },
      metadata,
      'user-1',
    );

    expect(override.lockedFields).toContain('bairro');
    expect(override.editedBy).toBe('user-1');
    expect(override.lockedFields).not.toContain('nome');
  });

  it('preserva manualOverride ao importar metadata', () => {
    const existing = {
      webmapSource: { repo: 'SMMAFRANCA/webmap', githubCommitSha: 'old' },
      manualOverride: {
        lockedFields: ['bairro'],
        editedAt: '2026-01-01T00:00:00.000Z',
      },
    };
    const incoming = {
      webmapSource: { repo: 'SMMAFRANCA/webmap', githubCommitSha: 'new' },
      webmapProperties: { fid: 1 },
    };

    const merged = mergeMetadataForImport(existing, incoming) as Record<string, unknown>;
    expect((merged.manualOverride as { lockedFields: string[] }).lockedFields).toEqual(['bairro']);
    expect((merged.webmapSource as { githubCommitSha: string }).githubCommitSha).toBe('new');
  });

  it('compara coordenadas com tolerância', () => {
    expect(valuesEqual('latitude', -20.5386, -20.5386001)).toBe(true);
    expect(valuesEqual('latitude', -20.5386, -20.5396)).toBe(false);
  });
});
