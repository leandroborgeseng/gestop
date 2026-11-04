import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { hrefChamado, hrefChamadoDaNc, ncMostraLinkChamado } from './nc-chamado-link';

describe('315 · número do chamado na aba Não conformidades', () => {
  it('chamado comum abre /chamados selecionado pelo id', () => {
    expect(hrefChamadoDaNc({ id: 'c-1', codigo: 'CH-2026-001197', status: 'ABERTO' })).toBe('/chamados?id=c-1');
    expect(hrefChamadoDaNc({ id: 'c-1', codigo: 'CH-1', status: 'CONCLUIDO' })).toBe('/chamados?id=c-1');
  });
  it('chamado em execução abre /execucao/:id (mesma regra da aba Chamados)', () => {
    expect(hrefChamadoDaNc({ id: 'c-2', codigo: 'CH-2', status: 'EM_EXECUCAO' })).toBe('/execucao/c-2');
    expect(hrefChamado({ id: 'c-2', status: 'EM_EXECUCAO' })).toBe('/execucao/c-2');
  });
  it('sem chamado, sem código ou chamado excluído não gera link', () => {
    expect(hrefChamadoDaNc(null)).toBeNull();
    expect(hrefChamadoDaNc({ id: 'c-1', codigo: null })).toBeNull();
    expect(hrefChamadoDaNc({ id: 'c-1', codigo: 'CH-1', excluidoEm: '2026-01-01' })).toBeNull();
  });
  it('link aparece em NC vinculada em andamento e resolvida por chamado', () => {
    expect(ncMostraLinkChamado('VINCULADA_EM_ANDAMENTO')).toBe(true);
    expect(ncMostraLinkChamado('RESOLVIDA_CHAMADO')).toBe(true);
    expect(ncMostraLinkChamado('ABERTA')).toBe(false);
    expect(ncMostraLinkChamado('BAIXADA_MANUAL')).toBe(false);
  });
  it('drawer: aba NC e aba Chamados usam o mesmo helper; resolvida mantém o selo', () => {
    const src = readFileSync(resolve('frontend/components/cco/unidade-drawer.tsx'), 'utf8');
    expect(src).toMatch(/hrefChamadoDaNc\(item\.chamado\)/);
    expect(src).toMatch(/hrefChamado\(chamado\)/);
    expect(src).not.toMatch(/`\/execucao\/\$\{chamado\.id\}`/);
    expect(src).toMatch(/RESOLVIDA_CHAMADO' && hrefChamadoDaNc[\s\S]*Resolvida/);
    expect(src).toMatch(/data-testid="nc-chamado-link"[\s\S]*onClick=\{onClose\}/);
  });
});
