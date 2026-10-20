import { describe, expect, it } from 'vitest';
import { CcoFiltrosSnapshot, contarFiltrosAtivos, defaultChamadoFilters, defaultUnidadeFilters, formatarHoraBrt, limparSnapshot, snapshotsIguais } from './cco-filtros-estado';

const padrao = (): CcoFiltrosSnapshot => ({ filters: defaultUnidadeFilters(), chamadoFilters: defaultChamadoFilters(), kpiFilter: 'none' });

describe('299 · estado de filtros do CCO', () => {
  it('padrão do Limpar conta 0', () => {
    expect(contarFiltrosAtivos('proprios', padrao())).toBe(0);
    expect(contarFiltrosAtivos('chamados', padrao())).toBe(0);
    expect(contarFiltrosAtivos('proprios', { ...padrao(), filters: {} })).toBe(0);
  });
  it('conta grupos diferentes do padrão', () => {
    const s = padrao();
    s.chamadoFilters = { ...s.chamadoFilters, prioridade: ['ALTA', 'URGENTE'], abertura: { rapido: 30 } as never, search: ' x ' };
    expect(contarFiltrosAtivos('chamados', s)).toBe(3);
    s.chamadoFilters.status = ['ABERTO'];
    expect(contarFiltrosAtivos('chamados', s)).toBe(4);
    const p = padrao();
    p.kpiFilter = 'pendencias';
    p.filters = { ...p.filters, bairros: ['Centro'], tiposPendencia: ['CHAMADOS'] };
    expect(contarFiltrosAtivos('proprios', p)).toBe(3);
  });
  it('comparação ignora ordem e vazios', () => {
    const a = padrao();
    const b = padrao();
    b.chamadoFilters = { ...b.chamadoFilters, status: [...(b.chamadoFilters.status ?? [])].reverse(), search: '' };
    expect(snapshotsIguais(a, b)).toBe(true);
    b.chamadoFilters.sla = 'FORA';
    expect(snapshotsIguais(a, b)).toBe(false);
  });
  it('Limpar zera só a aba ativa', () => {
    const s = padrao();
    s.kpiFilter = 'pendencias';
    s.chamadoFilters = { ...s.chamadoFilters, sla: 'FORA' };
    const p = limparSnapshot('proprios', s);
    expect(p.kpiFilter).toBe('none');
    expect(p.chamadoFilters.sla).toBe('FORA');
    expect(limparSnapshot('chamados', s).chamadoFilters).toEqual(defaultChamadoFilters());
  });
  it('hora BRT 14h35', () => {
    expect(formatarHoraBrt(new Date('2026-10-20T17:35:00Z'))).toBe('14h35');
    expect(formatarHoraBrt(new Date('2026-10-20T03:05:00Z'))).toBe('00h05');
  });
});
