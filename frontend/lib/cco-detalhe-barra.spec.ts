import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fecharDetalheAoAbrirPainel, fecharPainelAoAbrirDetalhe, LARGURA_UM_PAINEL_PX } from './cco-detalhe-barra';

describe('321 · convivência da barra de detalhes', () => {
  it('abaixo de 1024 px abrir Filtros/Camadas fecha a barra', () => {
    expect(LARGURA_UM_PAINEL_PX).toBe(1024);
    expect(fecharDetalheAoAbrirPainel(1023)).toBe(true);
    expect(fecharDetalheAoAbrirPainel(360)).toBe(true);
    expect(fecharDetalheAoAbrirPainel(768)).toBe(true);
    expect(fecharDetalheAoAbrirPainel(1024)).toBe(false);
    expect(fecharDetalheAoAbrirPainel(1440)).toBe(false);
  });

  it('abrir a barra fecha o painel do mesmo lado em qualquer largura', () => {
    expect(fecharPainelAoAbrirDetalhe()).toBe(true);
  });

  it('a barra é filha do mapa, com camadas nomeadas, safe-area e 100dvh', () => {
    const css = readFileSync(resolve('frontend/app/globals.css'), 'utf8');
    expect(css).toContain('--sigma-z-detalhe');
    expect(css).toContain('--sigma-z-dialogo');
    expect(css).toContain('.cco-detalhe-barra');
    expect(css).toContain('env(safe-area-inset-top');
    expect(css).toContain('env(safe-area-inset-right');
    expect(css).toContain('env(safe-area-inset-bottom');
    expect(css).toContain('env(safe-area-inset-left');
    expect(css).toContain('100dvh');
    expect(css).toContain('max-height: 48px');
    expect(css).toContain('body.cco-detalhe-trava');
    expect(css).toContain('position: sticky');
    expect(css).toContain('@media (max-width: 1279px)');
    expect(css).toContain('linear-gradient(to left, var(--surface), transparent)');
    expect(css).toContain('right: 12px');
    expect(css).toContain('width: 24px');
    expect(css).not.toMatch(/\.cco-detalhe-barra[\s\S]{0,400}animation\s*:/);
    const layout = readFileSync(resolve('frontend/app/layout.tsx'), 'utf8');
    expect(layout).toContain("viewportFit: 'cover'");
  });

  it('as barras do CCO não fazem portal para document.body', () => {
    const unidade = readFileSync(resolve('frontend/components/cco/unidade-drawer.tsx'), 'utf8');
    const chamado = readFileSync(resolve('frontend/components/cco/chamado-mapa-drawer.tsx'), 'utf8');
    const pagina = readFileSync(resolve('frontend/app/(authenticated)/cco/page.tsx'), 'utf8');
    const mapa = readFileSync(resolve('frontend/components/operational-map-client.tsx'), 'utf8');
    for (const src of [unidade, chamado]) {
      expect(src).toContain('CcoDetalheBarra');
      expect(src).not.toContain('createPortal');
      expect(src).not.toContain('document.body');
    }
    expect(pagina).toContain('detalhe={');
    expect(pagina).toContain('fecharDetalheAoAbrirPainel');
    expect(mapa).toContain('{detalhe}');
    expect(mapa).toContain('data-fullscreen-mode');
    const barra = readFileSync(resolve('frontend/components/cco/cco-detalhe-barra.tsx'), 'utf8');
    expect(barra).not.toContain("matchMedia('(min-width: 1024px)')");
    expect(barra).toContain("matchMedia('(max-width: 1279px)')");
    const popup = readFileSync(resolve('frontend/lib/map-popup-action.ts'), 'utf8');
    expect(popup).toContain('[data-testid="cco-detalhe-barra"]');
  });
});
