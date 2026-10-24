import { describe, expect, it } from 'vitest';
import { chaveProgramada, chaveRascunho, rascunhoTemDados } from './mobile-draft';

describe('M-2 rascunho por vistoria', () => {
  it('programada usa cronograma+data; avulsa usa próprio+checklist', () => {
    expect(chaveRascunho({ unidadeId: 'u', checklistId: 'k', programadaCtx: { cronogramaId: 'c', dataProgramada: '2026-10-16', checklistNome: 'x' } })).toBe(chaveProgramada('c', '2026-10-16'));
    expect(chaveRascunho({ unidadeId: 'u', checklistId: 'k', programadaCtx: null })).toBe('avulsa:u:k');
  });
  it('UM2-2: só há "dados" com resposta, foto ou check-in', () => {
    expect(rascunhoTemDados({ responses: {}, checkin: null })).toBe(false);
    expect(rascunhoTemDados({ responses: { i1: { conformidade: 'CONFORME' } }, checkin: null })).toBe(true);
    expect(rascunhoTemDados({ responses: {}, checkin: { latitude: 1, longitude: 1, precisaoMetros: 5, capturadoEm: 'x' } as never })).toBe(true);
  });
});
