import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildChamadoAcoes } from '@/lib/chamado-acoes';
import { ChamadoAcoesMobile } from './chamado-acoes-mobile';

const acoes = buildChamadoAcoes({
  podeExcluir: true,
  podeRestaurar: false,
  excluido: false,
  busy: false,
  exclusaoBusy: false,
  pdfBusy: false,
  tarefasPendentes: 2,
});

function render(defaultOpen: boolean) {
  return renderToStaticMarkup(createElement(ChamadoAcoesMobile, { acoes, onAcao: () => {}, defaultOpen }));
}

function openTag(html: string, attr: string) {
  const at = html.indexOf(attr);
  expect(at, attr).toBeGreaterThanOrEqual(0);
  const start = html.lastIndexOf('<', at);
  return html.slice(start, html.indexOf('>', at) + 1);
}

describe('291 menu "⋯" do chamado no celular', () => {
  it('botão 44×44 com aria-label "Mais ações" e data-testid', () => {
    const tag = openTag(render(false), 'data-testid="chamado-mais-acoes"');
    expect(tag).toContain('aria-label="Mais ações"');
    expect(tag).toContain('aria-haspopup="menu"');
    expect(tag).toContain('aria-expanded="false"');
    const cls = /class="([^"]*)"/.exec(tag)![1].split(/\s+/);
    expect(cls).toEqual(expect.arrayContaining(['h-11', 'w-11']));
  });

  it('fechado não mostra o menu; aberto lista todas as ações, nenhuma some', () => {
    expect(render(false)).not.toContain('role="menu"');
    const html = render(true);
    expect(openTag(html, 'data-testid="chamado-mais-acoes"')).toContain('aria-expanded="true"');
    const itens = [...html.matchAll(/role="menuitem"[^>]*data-acao="([a-z]+)"/g)].map((m) => m[1]);
    expect(itens).toEqual(acoes.map((a) => a.id));
    for (const acao of acoes) expect(html).toContain(`>${acao.label}<`);
    expect(html).toContain('>2<');
  });

  it('itens do menu com área de toque mínima de 44px', () => {
    const html = render(true);
    for (const m of html.matchAll(/<button[^>]*role="menuitem"[^>]*>/g)) expect(m[0]).toContain('min-h-11');
  });
});
