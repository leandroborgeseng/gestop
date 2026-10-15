import { describe, expect, it } from 'vitest';
import { buildChamadoAcoes } from './chamado-acoes';

const base = {
  podeExcluir: false,
  podeRestaurar: false,
  excluido: false,
  busy: false,
  exclusaoBusy: false,
  pdfBusy: false,
  tarefasPendentes: 0,
};

describe('291 ações do cabeçalho do chamado (menu "⋯" no celular)', () => {
  it('sem permissão de exclusão: PDF, Documentos relacionados e Tarefas', () => {
    expect(buildChamadoAcoes(base).map((a) => a.label)).toEqual(['PDF', 'Documentos relacionados', 'Tarefas']);
  });

  it('pode excluir e não excluído: Excluir chamado entra primeiro, como no desktop', () => {
    const acoes = buildChamadoAcoes({ ...base, podeExcluir: true });
    expect(acoes.map((a) => a.id)).toEqual(['excluir', 'pdf', 'documentos', 'tarefas']);
    expect(acoes[0]).toMatchObject({ label: 'Excluir chamado', danger: true });
  });

  it('excluído e pode restaurar: Restaurar chamado, nunca Excluir', () => {
    const ids = buildChamadoAcoes({ ...base, podeExcluir: true, podeRestaurar: true, excluido: true }).map((a) => a.id);
    expect(ids).toEqual(['restaurar', 'pdf', 'documentos', 'tarefas']);
  });

  it('estados de ocupado e contador de tarefas iguais ao desktop', () => {
    const acoes = buildChamadoAcoes({ ...base, podeExcluir: true, pdfBusy: true, exclusaoBusy: true, tarefasPendentes: 3 });
    const byId = Object.fromEntries(acoes.map((a) => [a.id, a]));
    expect(byId.excluir.disabled).toBe(true);
    expect(byId.pdf).toMatchObject({ label: 'Gerando…', disabled: true });
    expect(byId.documentos.disabled).toBe(false);
    expect(byId.tarefas).toMatchObject({ disabled: false, badge: 3 });
    expect(buildChamadoAcoes({ ...base, busy: true }).every((a) => a.disabled)).toBe(true);
  });
});
