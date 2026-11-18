import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resumoFiltrosTarefasExecucao, textoPrazoFiltro } from './chamado-tarefa';

const panelSrc = readFileSync(join(__dirname, '../components/chamados/execucao-tarefas-panel.tsx'), 'utf8');

describe('UX-02 — rótulos e resumo do prazo', () => {
  it('os campos dizem Prazo de e Prazo até', () => {
    expect(panelSrc).toContain('label="Prazo de"');
    expect(panelSrc).toContain('label="Prazo até"');
    expect(panelSrc).not.toContain('label="Data inicial"');
    expect(panelSrc).not.toContain('label="Data final"');
  });

  it('a sanfona fechada mostra o intervalo, a partir de, ou até', () => {
    expect(textoPrazoFiltro('2026-10-01', '2026-10-05')).toBe('Prazo: 01/10 a 05/10');
    expect(textoPrazoFiltro('2026-10-01', '')).toBe('Prazo: a partir de 01/10');
    expect(textoPrazoFiltro(undefined, '2026-10-05')).toBe('Prazo: até 05/10');
    expect(textoPrazoFiltro('', '')).toBeNull();
    expect(
      resumoFiltrosTarefasExecucao({ status: '', prazoFrom: '2026-10-01', prazoTo: '2026-10-05' }),
    ).toBe('Status: não finalizados · Prazo: 01/10 a 05/10');
  });
});
