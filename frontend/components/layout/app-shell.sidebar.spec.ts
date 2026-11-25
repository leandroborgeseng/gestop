import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@/lib/types';

vi.mock('next/navigation', () => ({
  usePathname: () => '/cco',
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
}));
vi.mock('next/image', () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) =>
    createElement('img', { src, alt, className }),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children?: unknown; className?: string }) =>
    createElement('a', { href, className }, children as never),
}));
vi.mock('@/components/auth/session-scope-switchers', () => ({ SessionScopeSwitchers: () => null }));
vi.mock('@/components/help/guide-provider', () => ({ useGuide: () => ({}) }));
vi.mock('@/components/pendencias/pendencias-button', () => ({ PendenciasButton: () => null }));
vi.mock('@/lib/api', () => ({
  getAlertasOperacionais: async () => null,
  getResumoOperacional: async () => null,
  logout: () => {},
}));

import { DesktopSidebar } from './app-shell';

const user: AuthUser = {
  id: 'u1',
  nome: 'Teste Aion',
  email: 'teste@aion.local',
  perfis: ['ADMIN'],
  permissoes: ['dashboard.visualizar', 'chamados.gerenciar', 'fiscalizacoes.executar'],
};

function render(collapsed: boolean) {
  return renderToStaticMarkup(
    createElement(DesktopSidebar, { user, collapsed, badges: {}, onToggleCollapsed: () => {} }),
  );
}

/** outerHTML do elemento (tag balanceada) que contém o atributo dado. */
function element(html: string, attr: string): string | null {
  const at = html.indexOf(attr);
  if (at < 0) return null;
  const start = html.lastIndexOf('<', at);
  const tag = /^<([a-z0-9]+)/.exec(html.slice(start))![1];
  const re = new RegExp(`<${tag}[\\s>]|</${tag}>`, 'g');
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return html.slice(start, m.index + m[0].length);
  }
  return null;
}

function toggleButton(html: string): string {
  const label = /aria-label="(Expandir|Recolher) menu"/.exec(html);
  expect(label, 'botão de expandir/recolher').not.toBeNull();
  return element(html, label![0])!;
}

function openTag(el: string) {
  return el.slice(0, el.indexOf('>') + 1);
}

describe('290 DesktopSidebar (render)', () => {
  it('R7: recolhida, o topo não contém o botão; o botão fica na linha própria', () => {
    const html = render(true);
    const top = element(html, 'data-testid="sidebar-top"')!;
    const row = element(html, 'data-testid="sidebar-toggle-row"');
    expect(top).toBeTruthy();
    expect(top).not.toContain('<button');
    expect(top).toContain('<img');
    expect(row).toBeTruthy();
    expect(row).toContain('aria-label="Expandir menu"');
  });

  it('R7: expandida, botão continua no topo e não há linha extra', () => {
    const html = render(false);
    expect(element(html, 'data-testid="sidebar-top"')).toContain('aria-label="Recolher menu"');
    expect(html).not.toContain('data-testid="sidebar-toggle-row"');
  });

  it.each([true, false])('R6: área de toque 44×44 (collapsed=%s)', (collapsed) => {
    const cls = /class="([^"]*)"/.exec(openTag(toggleButton(render(collapsed))))![1].split(/\s+/);
    expect(cls).toContain('h-11');
    expect(cls).toContain('w-11');
  });

  it('R5: aria-expanded reflete o estado', () => {
    expect(openTag(toggleButton(render(true)))).toContain('aria-expanded="false"');
    expect(openTag(toggleButton(render(false)))).toContain('aria-expanded="true"');
  });

  it.each([true, false])('R8: anel de foco no elemento visível, não no botão de 44px (collapsed=%s)', (collapsed) => {
    const btn = toggleButton(render(collapsed));
    const outer = openTag(btn);
    const inner = btn.slice(outer.length);
    expect(outer).not.toMatch(/focus-visible:ring/);
    expect(outer).toContain('group');
    expect(inner).toMatch(/<span[^>]*group-focus-visible:ring-2/);
  });
});
