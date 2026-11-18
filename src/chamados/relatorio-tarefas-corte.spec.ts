import { describe, expect, it } from 'vitest';
import { avisoCorteRelatorioTarefas, TETO_LINHAS_RELATORIO_TAREFAS } from './relatorio-tarefas-corte';

describe('UX-01 — teto e aviso do relatório de tarefas', () => {
  it('o teto é 500', () => {
    expect(TETO_LINHAS_RELATORIO_TAREFAS).toBe(500);
  });

  it('com 600 no filtro avisa "Mostrando 500 de 600 tarefas"', () => {
    expect(avisoCorteRelatorioTarefas(600, 500)).toBe('Mostrando 500 de 600 tarefas');
  });

  it('com 500 ou menos não avisa', () => {
    expect(avisoCorteRelatorioTarefas(500, 500)).toBeNull();
    expect(avisoCorteRelatorioTarefas(499, 499)).toBeNull();
    expect(avisoCorteRelatorioTarefas(0, 0)).toBeNull();
  });

  it('não anuncia mais linhas do que o teto, mesmo se a contagem exibida passar', () => {
    expect(avisoCorteRelatorioTarefas(800, 900)).toBe('Mostrando 500 de 800 tarefas');
  });
});
