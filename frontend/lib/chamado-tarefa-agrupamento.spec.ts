import { describe, expect, it } from 'vitest';
import {
  agruparTarefasDoChamado,
  contarTarefasPendentes,
  formatarDataCriacaoTarefa,
  tarefaEncerrada,
  type ChamadoTarefaResumo,
  type ChamadoTarefaStatus,
} from './chamado-tarefa';

function resumo(id: string, status: ChamadoTarefaStatus): ChamadoTarefaResumo {
  return {
    id,
    titulo: id,
    descricao: null,
    prazo: null,
    prioridade: 'MEDIA',
    status,
    justificativa: null,
    conclusaoTexto: null,
    observacao: null,
    atrasada: false,
    createdAt: '2026-10-01T15:30:00.000Z',
    concluidaEm: status === 'CONCLUIDA' ? '2026-10-02T00:00:00.000Z' : null,
    visualizadaEm: null,
    secretaria: { id: 's1', nome: 'Secretaria', sigla: 'SEC' },
    equipe: null,
    responsavel: null,
    criadaPor: { id: 'u1', nome: 'Admin' },
    concluidaPor: null,
    anexos: [],
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
}

describe('agruparTarefasDoChamado', () => {
  it('coloca abertas primeiro e encerradas (concluída/cancelada) no grupo recolhido', () => {
    const items = [
      resumo('t1', 'NOVA'),
      resumo('t2', 'EM_ANDAMENTO'),
      resumo('t3', 'IMPEDIDA'),
      resumo('t4', 'CONCLUIDA'),
      resumo('t5', 'CANCELADA'),
    ];

    const { abertas, encerradas } = agruparTarefasDoChamado(items);

    expect(abertas.map((item) => item.id)).toEqual(['t1', 't2', 't3']);
    expect(encerradas.map((item) => item.id)).toEqual(['t4', 't5']);
    expect(encerradas.every((item) => tarefaEncerrada(item.status))).toBe(true);
    expect(abertas.some((item) => tarefaEncerrada(item.status))).toBe(false);
  });

  it('conta pendentes só entre não encerradas da rotina ativa', () => {
    const items = [
      resumo('t1', 'NOVA'),
      resumo('t2', 'VISUALIZADA'),
      resumo('t3', 'EM_ANDAMENTO'),
      resumo('t4', 'IMPEDIDA'),
      resumo('t5', 'CONCLUIDA'),
      resumo('t6', 'CANCELADA'),
    ];

    expect(contarTarefasPendentes(items)).toBe(3);
  });
});

describe('formatarDataCriacaoTarefa', () => {
  it('exibe data e hora de criação em pt-BR', () => {
    const texto = formatarDataCriacaoTarefa('2026-10-01T15:30:00.000Z');
    expect(texto.startsWith('Criada em ')).toBe(true);
    expect(texto).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(texto).toContain(' às ');
  });
});
