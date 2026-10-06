import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { summarizeChamadoFiltros } from './chamado-filtros';
import { resumoFiltrosTarefasExecucao } from './chamado-tarefa';

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
    expect(execucaoSrc).toContain('{!filtrosAbertos ? <p className="mt-0.5 truncate text-[11px] text-[var(--ink-3)]">{resumoFiltros}</p> : null}');
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
