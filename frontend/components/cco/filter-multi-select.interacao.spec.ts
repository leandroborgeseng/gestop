import '@/test-utils/jsdom-global';
import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FilterMultiSelect } from './filter-multi-select';

afterEach(() => cleanup());

describe('299-U3 · FilterMultiSelect sem opções', () => {
  it('com textoSemOpcoes e sem opções: desabilitado + texto auxiliar', () => {
    render(createElement(FilterMultiSelect, { label: 'Tipo de chamado', placeholder: 'x', options: [], selected: [], onChange: vi.fn(), textoSemOpcoes: 'Sem tipos para os filtros atuais' }));
    expect((screen.getByRole('combobox', { name: 'Tipo de chamado' }) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByText('Sem tipos para os filtros atuais')).toBeTruthy();
  });
  it('sem a prop, comportamento antigo (habilitado)', () => {
    render(createElement(FilterMultiSelect, { label: 'Bairro', placeholder: 'x', options: [], selected: [], onChange: vi.fn() }));
    expect((screen.getByRole('combobox', { name: 'Bairro' }) as HTMLSelectElement).disabled).toBe(false);
  });
});

describe('299-F3 · todos os filtros do painel da CCO são opt-in', () => {
  it('Região vazia: desabilitada, com texto auxiliar ligado por aria-describedby', () => {
    render(createElement(FilterMultiSelect, { label: 'Região', placeholder: 'Selecionar região…', options: [], selected: [], onChange: vi.fn(), textoSemOpcoes: 'Sem regiões para os filtros atuais' }));
    const s = screen.getByRole('combobox', { name: 'Região' }) as HTMLSelectElement;
    expect(s.disabled).toBe(true);
    const aux = screen.getByTestId('filtro-sem-opcoes');
    expect(aux.textContent).toBe('Sem regiões para os filtros atuais');
    expect(s.getAttribute('aria-describedby')).toBe(aux.id);
  });
  it('com opções continua habilitado e sem texto auxiliar', () => {
    render(createElement(FilterMultiSelect, { label: 'Região', placeholder: 'x', options: [{ value: 'N', label: 'Norte' }], selected: [], onChange: vi.fn(), textoSemOpcoes: 'Sem regiões' }));
    expect((screen.getByRole('combobox', { name: 'Região' }) as HTMLSelectElement).disabled).toBe(false);
    expect(screen.queryByTestId('filtro-sem-opcoes')).toBeNull();
  });
  it('cco-filtros-panel: todo <FilterMultiSelect> passa textoSemOpcoes', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const src = readFileSync(fileURLToPath(new URL('./cco-filtros-panel.tsx', import.meta.url)), 'utf8');
    const usos = src.match(/<FilterMultiSelect[\s\S]*?\/>/g) ?? [];
    expect(usos.length).toBeGreaterThanOrEqual(11);
    for (const u of usos) expect(u).toMatch(/textoSemOpcoes="Sem [^"]+"/);
    for (const r of ['Região', 'Bairro', 'Secretaria']) expect(usos.some((u) => u.includes(`label="${r}"`))).toBe(true);
  });
});
