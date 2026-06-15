import { describe, expect, it } from 'vitest';
import { buildTriagemAlteracoes } from './chamados-sla';

describe('buildTriagemAlteracoes', () => {
  it('registra alteração de tipo, prioridade e prazo SLA', () => {
    const alteracoes = buildTriagemAlteracoes({
      tipoAnterior: { nome: 'Manutenção' },
      tipoNovo: { nome: 'Elétrica' },
      prioridadeAnterior: 'MEDIA',
      prioridadeNova: 'ALTA',
      prazoAnterior: new Date('2026-06-20T23:59:59.999Z'),
      prazoNovo: new Date('2026-06-15T23:59:59.999Z'),
    });

    expect(alteracoes).toEqual([
      { campo: 'tipoChamado', label: 'Tipo de chamado', de: 'Manutenção', para: 'Elétrica' },
      { campo: 'prioridade', label: 'Prioridade', de: 'Média', para: 'Alta' },
      { campo: 'prazoEm', label: 'Prazo SLA', de: '20/06/2026', para: '15/06/2026' },
    ]);
  });

  it('ignora campos inalterados', () => {
    const alteracoes = buildTriagemAlteracoes({
      tipoAnterior: { nome: 'Manutenção' },
      tipoNovo: { nome: 'Manutenção' },
      prioridadeAnterior: 'MEDIA',
      prioridadeNova: 'MEDIA',
      prazoAnterior: new Date('2026-06-20T23:59:59.999Z'),
      prazoNovo: new Date('2026-06-20T23:59:59.999Z'),
    });

    expect(alteracoes).toEqual([]);
  });
});
