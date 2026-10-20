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
