import { describe, expect, it } from 'vitest';
import { avaliarConflitoProgramacao } from './programacao-conflito';

const c = {
  id: 'c1', unidadeId: 'u1', checklistId: 'k1', ativo: true, frequencia: 'SEMANAL' as const,
  proximaChecagemEm: new Date('2026-10-23T03:00:00Z'), ultimaChecagemEm: null as Date | null, updatedAt: new Date('2026-10-20T12:00:00Z'),
};
const base = { cronograma: c, unidadeId: 'u1', checklistId: 'k1', dataProgramada: '2026-10-23', programacaoAtualizadaEm: '2026-10-20T12:00:00.000Z', projetar: () => true };

describe('304 O6 — conflito da programação no sync', () => {
  it('sem mudança → sem conflito', () => expect(avaliarConflitoProgramacao(base)).toBeNull());
  it('inexistente / inativa / outro próprio ou checklist', () => {
    expect(avaliarConflitoProgramacao({ ...base, cronograma: null })?.codigo).toBe('PROGRAMACAO_INEXISTENTE');
    expect(avaliarConflitoProgramacao({ ...base, cronograma: { ...c, ativo: false } })?.codigo).toBe('PROGRAMACAO_INATIVA');
    expect(avaliarConflitoProgramacao({ ...base, unidadeId: 'u2' })?.codigo).toBe('PROGRAMACAO_DIVERGENTE');
    expect(avaliarConflitoProgramacao({ ...base, checklistId: 'k2' })?.codigo).toBe('PROGRAMACAO_DIVERGENTE');
  });
  it('já baixada no servidor para a data (ou depois) → conflito', () => {
    const r = avaliarConflitoProgramacao({ ...base, cronograma: { ...c, ultimaChecagemEm: new Date(2026, 9, 23) } });
    expect(r?.codigo).toBe('PROGRAMACAO_JA_BAIXADA');
    expect(avaliarConflitoProgramacao({ ...base, cronograma: { ...c, ultimaChecagemEm: new Date(2026, 9, 16) } })).toBeNull();
  });
  it('alterada depois do download e a data saiu da recorrência → conflito; alterada mas a data continua valendo → ok', () => {
    const alterado = { ...c, updatedAt: new Date('2026-10-22T12:00:00Z') };
    expect(avaliarConflitoProgramacao({ ...base, cronograma: alterado, projetar: () => false })?.codigo).toBe('PROGRAMACAO_ALTERADA');
    expect(avaliarConflitoProgramacao({ ...base, cronograma: alterado, projetar: () => true })).toBeNull();
    expect(avaliarConflitoProgramacao({ ...base, programacaoAtualizadaEm: null, cronograma: alterado, projetar: () => false })).toBeNull();
  });
});
