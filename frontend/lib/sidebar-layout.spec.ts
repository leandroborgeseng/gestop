import { describe, expect, it } from 'vitest';
import { sidebarLogoClass, sidebarToggleLabel, sidebarToggleRowClass, sidebarTopClass } from './sidebar-layout';

describe('290 sidebar recolhida', () => {
  it('topo recolhido não empilha nada (sem flex-col/gap/py)', () => {
    const c = sidebarTopClass(true);
    expect(c).not.toMatch(/flex-col|gap-|py-/);
    expect(c).toContain('justify-center');
  });
  it('logo recolhido h-9 (36px cabe em 60px); expandido inalterado h-11', () => {
    expect(sidebarLogoClass(true)).toBe('h-9 w-auto max-h-9');
    expect(sidebarLogoClass(false)).toBe('h-11 w-auto max-h-11');
  });
  it('expandido mantém classes de hoje', () => {
    expect(sidebarTopClass(false)).toBe('gap-2.5 px-3.5 pl-4');
  });
  it('linha do botão tem 44px', () => {
    expect(sidebarToggleRowClass).toContain('h-11');
  });
  it('rótulos acessíveis', () => {
    expect(sidebarToggleLabel(true)).toBe('Expandir menu');
    expect(sidebarToggleLabel(false)).toBe('Recolher menu');
  });
});
