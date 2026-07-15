import { describe, expect, it } from 'vitest';
import {
  computeProdutividadeTotais,
  mapChamadoProdutividadeRow,
  resolveLocalChamado,
  resolveSlaConclusao,
} from './relatorios.chamados-produtividade';

describe('resolveSlaConclusao', () => {
  it('classifica dentro/fora/sem SLA', () => {
    expect(resolveSlaConclusao(new Date('2026-07-10'), new Date('2026-07-15'))).toBe('Dentro do prazo');
    expect(resolveSlaConclusao(new Date('2026-07-20'), new Date('2026-07-15'))).toBe('Fora do prazo');
    expect(resolveSlaConclusao(new Date('2026-07-10'), null)).toBe('Sem SLA');
  });
});

describe('resolveLocalChamado', () => {
  it('prioriza próprio público com endereço', () => {
    expect(
      resolveLocalChamado({
        unidade: { nome: 'Escola A', endereco: 'Rua 1' },
        enderecoTexto: 'Outro',
      }),
    ).toBe('Escola A — Rua 1');
  });

  it('usa endereço avulso sem unidade', () => {
    expect(
      resolveLocalChamado({
        unidade: null,
        enderecoTexto: 'Rua X',
        enderecoBairro: 'Centro',
      }),
    ).toBe('Rua X · Centro');
  });
});

describe('mapChamadoProdutividadeRow', () => {
  it('usa placeholders quando não há participantes no log', () => {
    const row = mapChamadoProdutividadeRow({
      codigo: 'CH-1',
      titulo: 'Teste',
      descricao: 'Desc',
      status: 'CONCLUIDO',
      concluidoEm: new Date('2026-07-10'),
      prazoEm: new Date('2026-07-15'),
      secretaria: { sigla: 'SEC' },
      unidade: null,
      tipoChamado: { nome: 'Manutenção' },
      participantesExecucao: null,
    });

    expect(row.equipe).toBe('Sem equipe');
    expect(row.funcionarios).toBe('Sem funcionário');
    expect(row.cargos).toBe('Sem cargo');
    expect(row.sla).toBe('Dentro do prazo');
  });
});

describe('computeProdutividadeTotais', () => {
  it('totaliza SLA e equipes', () => {
    const totais = computeProdutividadeTotais([
      {
        codigo: 'A',
        titulo: null,
        descricao: 'd',
        status: 'CONCLUIDO',
        concluidoEm: new Date('2026-07-10'),
        prazoEm: new Date('2026-07-15'),
        secretaria: { sigla: 'S1' },
        unidade: null,
        tipoChamado: null,
        participantesExecucao: {
          equipeExecutoraNome: 'Equipe A',
          participantes: [{ nome: 'João', cargo: 'Eletricista', origem: 'equipe' }],
        },
      },
      {
        codigo: 'B',
        titulo: null,
        descricao: 'd',
        status: 'CONCLUIDO',
        concluidoEm: new Date('2026-07-20'),
        prazoEm: new Date('2026-07-15'),
        secretaria: { sigla: 'S1' },
        unidade: null,
        tipoChamado: null,
        participantesExecucao: null,
      },
    ]);

    expect(totais.total).toBe(2);
    expect(totais.dentroPrazo).toBe(1);
    expect(totais.foraPrazo).toBe(1);
    expect(totais.porEquipe.some((item) => item.nome === 'Equipe A' && item.total === 1)).toBe(true);
  });
});
