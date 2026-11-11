import { describe, expect, it } from 'vitest';
import { paramsIguais } from '@/lib/estado-url';
import { lerEstadoChamados, serializarEstadoChamados } from '@/lib/estado-url-chamados';

const agora = new Date(2026, 10, 11, 15, 0, 0);

function ler(query: string) {
  return lerEstadoChamados(new URLSearchParams(query), agora);
}

describe('322 L1 · query de Chamados', () => {
  it('sem parâmetros é triagem com filtros no padrão e a URL fica limpa', () => {
    const { estado, canonico } = ler('');
    expect(estado.aba).toBe('triagem');
    expect(estado.statuses).toBe('TODOS');
    expect(estado.prioridade).toBe('TODAS');
    expect(estado.pagina).toBe(1);
    expect(estado.porPagina).toBe(50);
    expect(estado.visao).toBe('mensal');
    expect(estado.mes).toBeNull();
    expect(estado.dia).toBeNull();
    expect(canonico.toString()).toBe('');
  });

  it('grava aba, filtros, busca, página e registro; omite o padrão', () => {
    const { estado } = ler('aba=programacao&search=ZZ&status=aberto,impedido&prioridade=alta&sla=fora&atribuicao=mim&equipe=eq-1&secProprio=sec-1&secExecucao=sec-2&tipo=tipo-1&abertura=30d&excluidos=1&pagina=2&porPagina=100&visao=semanal&mes=2026-08&semana=2026-08-02&dia=2026-08-04&id=ch-1');
    expect(estado.aba).toBe('programacao');
    expect(estado.search).toBe('ZZ');
    expect([...(estado.statuses as Set<string>)]).toEqual(['ABERTO', 'IMPEDIDO']);
    expect(estado.prioridade).toBe('ALTA');
    expect(estado.sla).toBe('FORA');
    expect(estado.atribuicao).toBe('MIM');
    expect(estado.equipeId).toBe('eq-1');
    expect(estado.secProprio).toBe('sec-1');
    expect(estado.secExecucao).toBe('sec-2');
    expect(estado.tipo).toBe('tipo-1');
    expect(estado.abertura).toEqual({ rapido: 30 });
    expect(estado.excluidos).toBe(true);
    expect(estado.pagina).toBe(2);
    expect(estado.porPagina).toBe(100);
    expect(estado.visao).toBe('semanal');
    expect(estado.mes).toBe('2026-08');
    expect(estado.semana).toBe('2026-08-02');
    expect(estado.dia).toBe('2026-08-04');
    expect(estado.id).toBe('ch-1');
    const deVolta = ler(serializarEstadoChamados(estado, agora).toString());
    expect(paramsIguais(deVolta.canonico, serializarEstadoChamados(estado, agora))).toBe(true);
  });

  it('aceita atribuicao já usada em maiúsculas e regrava em minúsculas', () => {
    const { estado, canonico } = ler('atribuicao=MINHA_EQUIPE');
    expect(estado.atribuicao).toBe('MINHA_EQUIPE');
    expect(canonico.get('atribuicao')).toBe('minha_equipe');
  });

  it('ignora status, mês e página inválidos e tira esses parâmetros da URL', () => {
    const { estado, canonico } = ler('status=xyz,aberto&mes=13-2026&pagina=0&porPagina=7&abertura=7d&dia=2026-02-31&prioridade=xyz');
    expect([...(estado.statuses as Set<string>)]).toEqual(['ABERTO']);
    expect(estado.mes).toBeNull();
    expect(estado.pagina).toBe(1);
    expect(estado.porPagina).toBe(50);
    expect(estado.abertura).toEqual({});
    expect(estado.dia).toBeNull();
    expect(estado.prioridade).toBe('TODAS');
    expect(canonico.get('status')).toBe('aberto');
    expect(canonico.has('mes')).toBe(false);
    expect(canonico.has('pagina')).toBe(false);
    expect(canonico.has('abertura')).toBe(false);
    expect(canonico.has('dia')).toBe(false);
  });

  it('mês atual, hoje e a semana corrente não entram na URL', () => {
    const { canonico } = ler('mes=2026-11&dia=2026-11-11&semana=2026-11-08&visao=semanal');
    expect(canonico.get('visao')).toBe('semanal');
    expect(canonico.has('mes')).toBe(false);
    expect(canonico.has('dia')).toBe(false);
    expect(canonico.has('semana')).toBe(false);
  });

  it('período manual usa aberturaDe e aberturaAte', () => {
    const { estado, canonico } = ler('aberturaDe=2026-09-01&aberturaAte=2026-09-30');
    expect(estado.abertura).toEqual({ de: '2026-09-01', ate: '2026-09-30' });
    expect(canonico.get('aberturaDe')).toBe('2026-09-01');
    expect(canonico.has('abertura')).toBe(false);
  });
});
