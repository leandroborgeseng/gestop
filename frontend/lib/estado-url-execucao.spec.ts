import { describe, expect, it } from 'vitest';
import { paramsIguais } from '@/lib/estado-url';
import { lerEstadoExecucao, serializarEstadoExecucao } from '@/lib/estado-url-execucao';

function ler(query: string) {
  return lerEstadoExecucao(new URLSearchParams(query));
}

describe('322 L1 · query de Execução', () => {
  it('sem parâmetros abre Chamados com mapa e filtros no padrão', () => {
    const { estado, canonico } = ler('');
    expect(estado.aba).toBe('chamados');
    expect(estado.painelChamados).toBe('mapa');
    expect(estado.hoje).toBe(false);
    expect(canonico.toString()).toBe('');
  });

  it('grava seleção, busca, equipes, período e o painel de lista', () => {
    const { estado, canonico } = ler('sel=ch-1&search=ZZ&equipe=e1,e2&responsavel=u1&hoje=1&de=2026-11-01&ate=2026-11-11&painel=lista');
    expect(estado.sel).toBe('ch-1');
    expect(estado.search).toBe('ZZ');
    expect(estado.equipes).toEqual(['e1', 'e2']);
    expect(estado.responsaveis).toEqual(['u1']);
    expect(estado.hoje).toBe(true);
    expect(estado.de).toBe('2026-11-01');
    expect(estado.painelChamados).toBe('lista');
    expect(paramsIguais(canonico, serializarEstadoExecucao(estado))).toBe(true);
  });

  it('na aba Tarefas grava tarefa, status e os atalhos já existentes', () => {
    const { estado, canonico } = ler('aba=tarefas&tarefa=t1&status=em_andamento&atrasadas=1&historico=1&atribuidaAMim=1&minhasEquipes=1&prazoDe=2026-11-01&prazoAte=2026-11-30&secretaria=sec&equipe=eq&responsavel=u&tipo=tp&prioridade=alta&search=lamp&painel=mapa');
    expect(estado.aba).toBe('tarefas');
    expect(estado.tarefa).toBe('t1');
    expect(estado.status).toBe('EM_ANDAMENTO');
    expect(estado.atribuidaAMim).toBe(true);
    expect(estado.minhasEquipes).toBe(true);
    expect(estado.prioridade).toBe('ALTA');
    expect(estado.painelTarefas).toBe('mapa');
    expect(canonico.get('atribuidaAMim')).toBe('1');
    expect(canonico.get('status')).toBe('em_andamento');
    expect(paramsIguais(canonico, serializarEstadoExecucao(estado))).toBe(true);
  });

  it('ignora status, data e painel inválidos', () => {
    const { estado, canonico } = ler('status=xyz&de=13-2026&painel=lado&hoje=sim');
    expect(estado.status).toBe('');
    expect(estado.de).toBe('');
    expect(estado.painelChamados).toBe('mapa');
    expect(estado.hoje).toBe(false);
    expect(canonico.toString()).toBe('');
  });

  it('lista de equipes na aba Chamados não vira equipe da tarefa', () => {
    const { estado } = ler('aba=tarefas&equipe=e1,e2');
    expect(estado.equipeTarefa).toBe('');
  });
});
