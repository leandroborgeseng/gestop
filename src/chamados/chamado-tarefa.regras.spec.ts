import { situacaoPrazoTarefa, tarefaAtrasada } from './chamado-tarefa.regras';

describe('situacaoPrazoTarefa', () => {
  const agora = new Date('2026-09-30T12:00:00.000Z');

  it('marca pendente com prazo vencido como atrasada', () => {
    expect(tarefaAtrasada('EM_ANDAMENTO', new Date('2026-09-01T00:00:00.000Z'), agora)).toBe(true);
    expect(tarefaAtrasada('CONCLUIDA', new Date('2026-09-01T00:00:00.000Z'), agora)).toBe(false);
    expect(
      situacaoPrazoTarefa(
        { status: 'NOVA', prazo: new Date('2026-09-01T00:00:00.000Z'), concluidaEm: null },
        agora,
      ),
    ).toBe('Atrasada');
  });

  it('distingue conclusão no prazo e com atraso', () => {
    expect(
      situacaoPrazoTarefa(
        {
          status: 'CONCLUIDA',
          prazo: new Date('2026-09-10T00:00:00.000Z'),
          concluidaEm: new Date('2026-09-20T00:00:00.000Z'),
        },
        agora,
      ),
    ).toBe('Concluída com atraso');
    expect(situacaoPrazoTarefa({ status: 'IMPEDIDA', prazo: null, concluidaEm: null }, agora)).toBe('Sem prazo');
  });
});
