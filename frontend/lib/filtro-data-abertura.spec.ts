import { describe, expect, it } from 'vitest';
import {
  aberturaParaQuery,
  DIAS_ABERTURA_RAPIDOS,
  filtroAberturaAtivo,
  formatarDiaBr,
  MSG_PERIODO_INVERTIDO,
  periodoInvertido,
  referenciaRapido,
  resumoDataAbertura,
} from './filtro-data-abertura';

describe('295 · resumo da sanfona recolhida', () => {
  it('os 4 formatos', () => {
    expect(resumoDataAbertura({ rapido: 30, ate: '2026-09-16' })).toBe('Abertos há mais de 30 dias');
    expect(resumoDataAbertura({ de: '2026-10-01' })).toBe('Abertos a partir de 01/10/2026');
    expect(resumoDataAbertura({ ate: '2026-09-30' })).toBe('Abertos até 30/09/2026');
    expect(resumoDataAbertura({ de: '2026-09-01', ate: '2026-09-30' })).toBe('Abertos entre 01/09/2026 e 30/09/2026');
  });
  it('sem filtro ou período inválido: nada', () => {
    expect(resumoDataAbertura(undefined)).toBeNull();
    expect(resumoDataAbertura({})).toBeNull();
    expect(resumoDataAbertura({ de: '2026-10-02', ate: '2026-10-01' })).toBeNull();
  });
});

describe('295 · consulta', () => {
  it('rápido manda só o número de dias, nunca a data de referência', () => {
    expect(aberturaParaQuery({ rapido: 45, ate: '2026-09-01' })).toEqual({ diasMinimos: '45' });
  });
  it('período manual manda as datas YYYY-MM-DD', () => {
    expect(aberturaParaQuery({ de: '2026-09-01', ate: '2026-09-30' })).toEqual({ abertoDe: '2026-09-01', abertoAte: '2026-09-30' });
    expect(aberturaParaQuery({ de: '2026-09-01' })).toEqual({ abertoDe: '2026-09-01' });
    expect(aberturaParaQuery({ ate: '2026-09-30' })).toEqual({ abertoAte: '2026-09-30' });
    expect(aberturaParaQuery({})).toEqual({});
    expect(aberturaParaQuery(undefined)).toEqual({});
  });
  it('inválido não vira consulta', () => {
    expect(periodoInvertido({ de: '2026-10-02', ate: '2026-10-01' })).toBe(true);
    expect(periodoInvertido({ de: '2026-10-01', ate: '2026-10-01' })).toBe(false);
    expect(periodoInvertido({ de: '2026-10-02' })).toBe(false);
    expect(aberturaParaQuery({ de: '2026-10-02', ate: '2026-10-01' })).toEqual({});
    expect(MSG_PERIODO_INVERTIDO).toBe('A data inicial não pode ser posterior à data final.');
  });
  it('ativo', () => {
    expect([filtroAberturaAtivo(undefined), filtroAberturaAtivo({}), filtroAberturaAtivo({ rapido: 10 }), filtroAberturaAtivo({ de: '2026-01-01' }), filtroAberturaAtivo({ ate: '2026-01-01' })]).toEqual([false, false, true, true, true]);
  });
});

describe('295 · referência do rápido (America/Sao_Paulo)', () => {
  it('30 dias em 16/10/2026 → Data final 16/09/2026 e texto de ajuda com a hora de Franca', () => {
    expect(referenciaRapido(30, new Date('2026-10-16T19:56:00.000Z'))).toEqual({
      ate: '2026-09-16',
      ajuda: 'Abertos antes de 16/09/2026 às 16:56 (mais de 30 dias completos).',
    });
  });
  it('perto da meia-noite usa o dia de Franca, não o UTC', () => {
    expect(referenciaRapido(10, new Date('2026-10-17T01:30:00.000Z')).ate).toBe('2026-10-06');
    expect(referenciaRapido(10, new Date('2026-10-17T01:30:00.000Z')).ajuda).toBe('Abertos antes de 06/10/2026 às 22:30 (mais de 10 dias completos).');
  });
  it('valores dos rápidos e formatação', () => {
    expect([...DIAS_ABERTURA_RAPIDOS]).toEqual([10, 15, 30, 45, 60, 90, 180]);
    expect(formatarDiaBr('2026-09-01')).toBe('01/09/2026');
  });
});
