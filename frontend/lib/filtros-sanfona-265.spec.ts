import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { summarizeChamadoFiltros } from './chamado-filtros';
import { contarFiltrosAtivosTarefas, resumoFiltrosTarefasExecucao, rotuloContagemFiltros } from './chamado-tarefa';

const execucaoSrc = readFileSync(join(__dirname, '../components/chamados/execucao-tarefas-panel.tsx'), 'utf8');
const chamadosSrc = readFileSync(join(__dirname, '../components/chamados/chamados-filtros-panel.tsx'), 'utf8');

const VAZIO = {
  status: '',
  historico: false,
  prioridade: '',
  atribuidaAMim: false,
  minhasEquipes: false,
  atrasadas: false,
  prazoFrom: '',
  prazoTo: '',
};

describe('UX-12 — contagem de filtros da sanfona', () => {
  it('não conta o padrão não finalizados e conta os demais, inclusive o prazo como um', () => {
    expect(contarFiltrosAtivosTarefas(VAZIO)).toBe(0);
    expect(rotuloContagemFiltros(0)).toBeNull();
    expect(rotuloContagemFiltros(1)).toBe('(1 filtro)');
    expect(
      contarFiltrosAtivosTarefas({
        ...VAZIO,
        secretariaSigla: 'EDU',
        equipeNome: 'Norte',
        responsavelNome: 'Ana',
        tipoNome: 'Elétrica',
        prioridade: 'ALTA',
      }),
    ).toBe(5);
    expect(rotuloContagemFiltros(5)).toBe('(5 filtros)');
    expect(contarFiltrosAtivosTarefas({ ...VAZIO, status: 'NOVA' })).toBe(1);
    expect(contarFiltrosAtivosTarefas({ ...VAZIO, prazoFrom: '2026-10-01', prazoTo: '2026-10-05' })).toBe(1);
  });
});

describe('265 — sanfona de filtros', () => {
  it('o padrão mostra Status: não finalizados; outros filtros entram junto', () => {
    expect(resumoFiltrosTarefasExecucao(VAZIO)).toBe('Status: não finalizados');
    expect(resumoFiltrosTarefasExecucao({ ...VAZIO, secretariaSigla: 'EDU', atrasadas: true })).toBe(
      'Status: não finalizados · Secretaria: EDU · Atrasadas',
    );
    expect(
      resumoFiltrosTarefasExecucao({
        ...VAZIO,
        status: 'EM_ANDAMENTO',
        secretariaSigla: 'EDU',
        atribuidaAMim: true,
      }),
    ).toBe('Status: Em andamento · Secretaria: EDU · Atribuídas a mim');
    expect(resumoFiltrosTarefasExecucao({})).toBe('Nenhum filtro ativo');

    expect(
      summarizeChamadoFiltros({
        statusTodos: true,
        statusCount: 0,
        prioridade: 'TODAS',
        sla: 'TODOS',
        atribuicao: 'TODOS',
        equipe: '',
        secretariaProprio: '',
        secretariaExecucao: '',
        tipoChamado: '',
      }),
    ).toBe('Nenhum filtro ativo');
    expect(
      summarizeChamadoFiltros({
        statusTodos: false,
        statusCount: 2,
        prioridade: 'ALTA',
        sla: 'FORA',
        atribuicao: 'MIM',
        equipe: 'eq-1',
        equipeNome: 'Equipe Norte',
        secretariaProprio: '',
        secretariaExecucao: '',
        tipoChamado: '',
      }),
    ).toBe('2 status · Prioridade ALTA · Fora do prazo · Atribuídos a mim · Equipe Norte');
  });

  it('fechar a sanfona só alterna o aberto; não zera os filtros', () => {
    expect(execucaoSrc).toContain('onClick={() => setFiltrosAbertos((current) => !current)}');
    expect(execucaoSrc).toContain('resumoFiltrosTarefasExecucao');
    expect(execucaoSrc).toContain('title={resumoFiltros}');
    expect(execucaoSrc).toContain('line-clamp-2');
    expect(execucaoSrc).toContain('Limpar filtros');
    expect(execucaoSrc).not.toMatch(/setFiltrosAbertos\([^)]*\)[\s\S]{0,120}setStatus\(''\)/);
    expect(execucaoSrc).not.toMatch(
      /\}, \[status, atribuidaAMim, minhasEquipes, atrasadas, historico, prazoFrom, prazoTo, secretariaId, equipeId, responsavelId, tipoChamadoId, prioridade, filtrosAbertos\]/,
    );

    expect(chamadosSrc).toContain('onClick={() => setOpen((current) => !current)}');
    expect(chamadosSrc).toContain('summarizeChamadoFiltros');
    expect(chamadosSrc).toContain('{!open ? <p className="mt-0.5 truncate text-[11px] text-[var(--ink-3)]">{summary}</p> : null}');
    expect(chamadosSrc).not.toMatch(/setOpen\([^)]*\)[\s\S]{0,80}onChange\(\{/);
  });
});
