import { describe, expect, it, vi } from 'vitest';
import { buildChamadoAcoes, executarAcaoChamado } from './chamado-acoes';

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

describe('291 executarAcaoChamado (id → ação)', () => {
  function handlers() {
    return {
      abrirExclusao: vi.fn(),
      gerarPdf: vi.fn(),
      alternarDocumentos: vi.fn(),
      alternarTarefas: vi.fn(),
    };
  }
  const chamadas = (h: ReturnType<typeof handlers>) =>
    Object.fromEntries(Object.entries(h).map(([k, fn]) => [k, fn.mock.calls]));

  it.each([
    ['excluir', { abrirExclusao: [['excluir']], gerarPdf: [], alternarDocumentos: [], alternarTarefas: [] }],
    ['restaurar', { abrirExclusao: [['restaurar']], gerarPdf: [], alternarDocumentos: [], alternarTarefas: [] }],
    ['pdf', { abrirExclusao: [], gerarPdf: [[]], alternarDocumentos: [], alternarTarefas: [] }],
    ['documentos', { abrirExclusao: [], gerarPdf: [], alternarDocumentos: [[]], alternarTarefas: [] }],
    ['tarefas', { abrirExclusao: [], gerarPdf: [], alternarDocumentos: [], alternarTarefas: [[]] }],
  ] as const)('%s chama só o handler certo', (id, esperado) => {
    const h = handlers();
    executarAcaoChamado(id, h);
    expect(chamadas(h)).toEqual(esperado);
  });
});
