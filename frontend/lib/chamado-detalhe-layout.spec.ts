import { describe, expect, it } from 'vitest';
import * as L from './chamado-detalhe-layout';

const tokens = (s: string) => s.split(/\s+/).filter(Boolean);

describe('291 layout do detalhe do chamado', () => {
  it('md ou maior: classes-base iguais às da main', () => {
    expect(L.DETALHE_SCROLL_BASE).toBe('flex h-full flex-col p-0');
    expect(L.DETALHE_CABECALHO_BASE).toBe('border-b border-[var(--line-2)] p-5');
    expect(L.DETALHE_ACOES_DESKTOP_BASE).toBe('flex flex-wrap items-start justify-between gap-3');
    expect(L.DETALHE_BLOCOS_BASE).toBe('flex-1 space-y-5 overflow-y-auto p-5');
  });

  it('md ou maior: todo ajuste do celular usa max-md:, e a linha fixa só existe abaixo de md', () => {
    for (const cls of [
      L.DETALHE_SECTION_MOBILE,
      L.DETALHE_SCROLL_MOBILE,
      L.DETALHE_CABECALHO_MOBILE,
      L.DETALHE_ACOES_DESKTOP_MOBILE,
      L.DETALHE_BLOCOS_MOBILE,
    ]) {
      for (const t of tokens(cls)) expect(t.startsWith('max-md:'), t).toBe(true);
    }
    expect(tokens(L.DETALHE_LINHA_FIXA)).toContain('md:hidden');
    expect(tokens(L.DETALHE_ACOES_DESKTOP_MOBILE)).toContain('max-md:hidden');
  });

  it('linha fixa de 48px, sticky no topo da área de rolagem', () => {
    const t = tokens(L.DETALHE_LINHA_FIXA);
    expect(t).toEqual(expect.arrayContaining(['sticky', 'top-0', 'h-12']));
    expect(L.DETALHE_LINHA_FIXA_SOMBRA).toMatch(/^shadow-/);
  });

  it('uma área de rolagem só no celular: o card rola, os blocos não', () => {
    expect(tokens(L.DETALHE_SCROLL_MOBILE)).toEqual(
      expect.arrayContaining(['max-md:overflow-y-auto', 'max-md:overscroll-contain']),
    );
    expect(tokens(L.DETALHE_BLOCOS_MOBILE)).toEqual(
      expect.arrayContaining(['max-md:overflow-visible', 'max-md:flex-none']),
    );
  });

  it('altura útil e respiro acima do menu inferior', () => {
    expect(L.DETALHE_SECTION_MOBILE).toContain(
      'max-md:h-[calc(100dvh-var(--mobile-appbar-h)-var(--bottom-nav-h)-env(safe-area-inset-bottom))]',
    );
    expect(L.DETALHE_SECTION_MOBILE).toContain('max-md:max-h-none');
    expect(L.DETALHE_SCROLL_MOBILE).toContain(
      'max-md:pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+12px)]',
    );
  });

  it('espaçamento do celular: 12px de padding e de gap', () => {
    expect(tokens(L.DETALHE_CABECALHO_MOBILE)).toContain('max-md:p-3');
    expect(tokens(L.DETALHE_BLOCOS_MOBILE)).toEqual(expect.arrayContaining(['max-md:p-3', 'max-md:space-y-3']));
  });
});

describe('291 ligação na página de Chamados', () => {
  it('page.tsx usa as classes do layout e expõe os test-ids', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(resolve(__dirname, '../app/(authenticated)/chamados/page.tsx'), 'utf8');
    for (const usage of [
      'ALTURA_PAINEL_CHAMADOS, DETALHE_SECTION_MOBILE',
      'cn(DETALHE_SCROLL_BASE, DETALHE_SCROLL_MOBILE)',
      'cn(DETALHE_LINHA_FIXA, mobileRolado && DETALHE_LINHA_FIXA_SOMBRA)',
      'cn(DETALHE_CABECALHO_BASE, DETALHE_CABECALHO_MOBILE)',
      'cn(DETALHE_ACOES_DESKTOP_BASE, DETALHE_ACOES_DESKTOP_MOBILE)',
      'cn(DETALHE_BLOCOS_BASE, DETALHE_BLOCOS_MOBILE)',
      '<ChamadoAcoesMobile acoes={acoesCabecalho} onAcao={executarAcao} />',
      'data-testid="chamado-linha-fixa"',
      'data-testid="chamado-detalhe-scroll"',
    ]) {
      expect(src, usage).toContain(usage);
    }
  });
});
