import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  avisoCorteRelatorioTarefas,
  formatarGrupoIndicadoresTarefas,
  montarFiltrosRelatorioTarefas,
  TETO_LINHAS_RELATORIO_TAREFAS,
} from './chamado-tarefa';

const panelSrc = readFileSync(join(__dirname, '../components/relatorios/relatorio-tarefas-panel.tsx'), 'utf8');
const formalSrc = readFileSync(join(__dirname, '../app/(authenticated)/relatorios/page.tsx'), 'utf8');

describe('UX-01 — teto de 500 e aviso de corte', () => {
  it('com 600 tarefas avisa na grade; com 500 ou menos não avisa', () => {
    expect(TETO_LINHAS_RELATORIO_TAREFAS).toBe(500);
    expect(avisoCorteRelatorioTarefas(600, 500)).toBe('Mostrando 500 de 600 tarefas');
    expect(avisoCorteRelatorioTarefas(500, 500)).toBeNull();
    expect(avisoCorteRelatorioTarefas(120, 120)).toBeNull();
  });

  it('a grade e o modal formal renderizam o mesmo aviso', () => {
    expect(panelSrc).toContain('avisoCorteRelatorioTarefas(data.total, data.items.length, data.limite)');
    expect(panelSrc).toContain('data-testid="aviso-corte-tarefas"');
    expect(formalSrc).toContain('avisoCorteRelatorioTarefas(data.total, data.items.length, data.limite)');
    expect(formalSrc).toContain('data-testid="aviso-corte-tarefas-modal"');
    expect(formalSrc).toContain('getRelatorioTarefas');
  });
});

describe('254 — agrupamentos do dashboard', () => {
  it('secretaria e equipe mostram pendentes e atrasadas, não só o total', () => {
    expect(
      formatarGrupoIndicadoresTarefas({ nome: 'EDU', pendentes: 3, atrasadas: 1 }),
    ).toBe('EDU: 3 pendentes · 1 atrasadas');
    expect(panelSrc).toContain('<Grupo titulo="Por secretaria" itens={indicadores.porSecretaria} detalharPendencias />');
    expect(panelSrc).toContain('<Grupo titulo="Por equipe" itens={indicadores.porEquipe} detalharPendencias />');
    expect(panelSrc).toContain('formatarGrupoIndicadoresTarefas(item)');
  });
});

describe('280 — período e export da grade', () => {
  it('o box do Dashboard usa from/to (data de abertura), o mesmo campo do relatório formal', () => {
    const filtros = montarFiltrosRelatorioTarefas({
      from: '2026-10-01',
      to: '2026-10-06',
      status: 'NOVA',
      secretariaId: 'sec-1',
      search: 'CH-001',
      capa: 'simples',
    });
    expect(filtros).toEqual({
      from: '2026-10-01',
      to: '2026-10-06',
      status: 'NOVA',
      prioridade: undefined,
      secretariaId: 'sec-1',
      equipeId: undefined,
      responsavelId: undefined,
      tipoChamadoId: undefined,
      search: 'CH-001',
      capa: 'simples',
    });
    expect(filtros).not.toHaveProperty('prazoFrom');
    expect(filtros).not.toHaveProperty('prazoTo');
    expect(panelSrc).toContain('Período (data de abertura)');
    expect(panelSrc).not.toContain('prazoFrom');
    expect(panelSrc).not.toContain('Prazo de');
    expect(formalSrc).toContain('if (tarefasModal.from) params.from = tarefasModal.from');
    expect(formalSrc).toContain('if (tarefasModal.to) params.to = tarefasModal.to');
    expect(formalSrc).toContain('Data inicial (abertura)');
  });

  it('o export XLSX/CSV/PDF da grade manda exatamente os mesmos filtros aplicados', () => {
    const grade = montarFiltrosRelatorioTarefas({
      from: '2026-09-01',
      to: '2026-09-30',
      prioridade: 'ALTA',
      equipeId: 'eq-1',
      capa: 'simples',
    });
    const exportacao = montarFiltrosRelatorioTarefas({
      from: '2026-09-01',
      to: '2026-09-30',
      prioridade: 'ALTA',
      equipeId: 'eq-1',
      capa: 'simples',
    });
    expect(exportacao).toEqual(grade);
    expect(panelSrc).toContain('const params = filtrosAtuais();');
    expect(panelSrc).toContain('setData(await getRelatorioTarefas(params));');
    expect(panelSrc).toContain('setAplicado(params);');
    expect(panelSrc).toContain("await downloadRelatorioTarefas(formato, aplicado);");
    expect(panelSrc).toContain("(['xlsx', 'csv', 'pdf'] as const)");
  });
});
