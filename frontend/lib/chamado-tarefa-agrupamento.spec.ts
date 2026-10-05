import { describe, expect, it } from 'vitest';
import type { ChamadoTarefaResumo } from './chamado-tarefa';

function agruparTarefas(items: ChamadoTarefaResumo[]) {
  const abertas = items.filter((item) => item.status !== 'CONCLUIDA' && item.status !== 'CANCELADA');
  const encerradas = items.filter((item) => item.status === 'CONCLUIDA' || item.status === 'CANCELADA');
  return { abertas, encerradas };
}

function contarPendentes(items: ChamadoTarefaResumo[]) {
  return items.filter((item) => {
    const statusPendentes = ['NOVA', 'VISUALIZADA', 'EM_ANDAMENTO', 'IMPEDIDA'];
    return statusPendentes.includes(item.status);
  }).length;
}

describe('agrupamento de tarefas', () => {
  const tarefaBase = {
    id: 't1',
    titulo: 'Tarefa',
    descricao: null,
    prazo: null,
    prioridade: 'MEDIA' as const,
    justificativa: null,
    conclusaoTexto: null,
    observacao: null,
    atrasada: false,
    createdAt: new Date().toISOString(),
    concluidaEm: null,
    visualizadaEm: null,
    secretaria: { id: 's1', nome: 'Secretaria', sigla: 'SEC' },
    equipe: null,
    responsavel: null,
    criadaPor: { id: 'u1', nome: 'Admin' },
    concluidaPor: null,
    anexos: [],
    podeAlterarDados: true,
    podeAndamento: true,
    podeConcluir: true,
    podeCancelar: true,
    podeVerHistorico: true,
    podeTratar: true,
    chamado: {
      id: 'ch1',
      codigo: 'CH-001',
      titulo: null,
      descricao: 'Teste',
      status: 'ABERTO',
      prioridade: 'MEDIA',
      enderecoTexto: null,
      prazoEm: null,
      latitude: null,
      longitude: null,
      tipoChamado: null,
      unidade: null,
      secretaria: { id: 's1', nome: 'Secretaria', sigla: 'SEC' },
      equipe: null,
    },
  };

  it('separa tarefas abertas das encerradas', () => {
    const tarefas: ChamadoTarefaResumo[] = [
      { ...tarefaBase, id: 't1', status: 'NOVA' },
      { ...tarefaBase, id: 't2', status: 'EM_ANDAMENTO' },
      { ...tarefaBase, id: 't3', status: 'CONCLUIDA', concluidaEm: new Date().toISOString() },
      { ...tarefaBase, id: 't4', status: 'CANCELADA' },
    ];

    const { abertas, encerradas } = agruparTarefas(tarefas);

    expect(abertas).toHaveLength(2);
    expect(encerradas).toHaveLength(2);
    expect(abertas.map((t) => t.status)).toEqual(['NOVA', 'EM_ANDAMENTO']);
    expect(encerradas.map((t) => t.status)).toEqual(['CONCLUIDA', 'CANCELADA']);
  });

  it('conta pendentes corretamente', () => {
    const tarefas: ChamadoTarefaResumo[] = [
      { ...tarefaBase, id: 't1', status: 'NOVA' },
      { ...tarefaBase, id: 't2', status: 'VISUALIZADA' },
      { ...tarefaBase, id: 't3', status: 'EM_ANDAMENTO' },
      { ...tarefaBase, id: 't4', status: 'IMPEDIDA' },
      { ...tarefaBase, id: 't5', status: 'CONCLUIDA', concluidaEm: new Date().toISOString() },
      { ...tarefaBase, id: 't6', status: 'CANCELADA' },
    ];

    const pendentes = contarPendentes(tarefas);

    expect(pendentes).toBe(4);
  });

  it('identifica lista sem tarefas encerradas', () => {
    const tarefas: ChamadoTarefaResumo[] = [
      { ...tarefaBase, id: 't1', status: 'NOVA' },
      { ...tarefaBase, id: 't2', status: 'EM_ANDAMENTO' },
    ];

    const { abertas, encerradas } = agruparTarefas(tarefas);

    expect(abertas).toHaveLength(2);
    expect(encerradas).toHaveLength(0);
  });

  it('identifica lista sem tarefas abertas', () => {
    const tarefas: ChamadoTarefaResumo[] = [
      { ...tarefaBase, id: 't1', status: 'CONCLUIDA', concluidaEm: new Date().toISOString() },
      { ...tarefaBase, id: 't2', status: 'CANCELADA' },
    ];

    const { abertas, encerradas } = agruparTarefas(tarefas);

    expect(abertas).toHaveLength(0);
    expect(encerradas).toHaveLength(2);
  });
});
