import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hrefChamadoDaNc } from './nc-chamado-link';

describe('315 · número do chamado na aba Não conformidades', () => {
  it('vira link para /chamados selecionando pelo id', () => {
    expect(hrefChamadoDaNc({ id: 'c-1', codigo: 'CH-2026-001197' })).toBe('/chamados?id=c-1');
  });
  it('sem chamado, sem código ou chamado excluído não gera link', () => {
    expect(hrefChamadoDaNc(null)).toBeNull();
    expect(hrefChamadoDaNc({ id: 'c-1', codigo: null })).toBeNull();
    expect(hrefChamadoDaNc({ id: 'c-1', codigo: 'CH-1', excluidoEm: '2026-01-01' })).toBeNull();
  });
  it('drawer usa o link no número do chamado e fecha ao navegar', () => {
    const src = readFileSync(resolve('frontend/components/cco/unidade-drawer.tsx'), 'utf8');
    expect(src).toMatch(/hrefChamadoDaNc\(item\.chamado\)/);
    expect(src).toMatch(/data-testid="nc-chamado-link"[\s\S]*onClick=\{onClose\}/);
  });
});
