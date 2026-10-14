import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const portais: Array<{ children: ReactNode; alvo: unknown }> = [];
const limpezas: Array<void | (() => void)> = [];

// Sem DOM no ambiente de teste: executa os efeitos de forma síncrona e guarda a limpeza (unmount).
vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>();
  return {
    ...real,
    useEffect: (efeito: () => void | (() => void)) => {
      limpezas.push(efeito());
    },
  };
});

vi.mock('react-dom', async (importOriginal) => {
  const real = await importOriginal<typeof import('react-dom')>();
  return {
    ...real,
    createPortal: (children: ReactNode, alvo: unknown) => {
      portais.push({ children, alvo });
      return children;
    },
  };
});
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/components/ui/snackbar', () => ({ useSnackbar: () => ({ show: () => undefined }) }));

import { PendenciasAcessoDialog, PendenciasVazio } from './pendencias-acesso-dialog';
import type { PendenciasResumo } from '@/lib/api';

const resumo: PendenciasResumo = {
  total: 1,
  grupos: [
    {
      id: 'documentos',
      titulo: 'Documentos',
      total: 1,
      verMaisHref: '/documentos',
      itens: [{ id: 'd1', codigo: 'DOC-1', titulo: 'Assinar', href: '/documentos/d1' }],
    },
  ],
} as unknown as PendenciasResumo;

const estiloInicial = () => ({ position: 'static', top: '', left: '', right: '', width: '' });
const body = { tag: 'document.body', style: estiloInicial() };

describe('288: modal de pendências via portal', () => {
  beforeEach(() => {
    portais.length = 0;
    limpezas.length = 0;
    body.style = estiloInicial();
    vi.stubGlobal('document', { body });
    vi.stubGlobal('window', { scrollY: 0, scrollTo: vi.fn() });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renderiza em document.body (fora do header), acima do header e do menu inferior', () => {
    const html = renderToStaticMarkup(createElement(PendenciasAcessoDialog, { open: true, resumo, onClose: () => undefined }));
    expect(portais).toHaveLength(1);
    expect(portais[0].alvo).toBe(body);
    expect(html).toContain('z-[140]'); // header z-30, menu inferior z-40
    expect(html).not.toContain('<header');
    expect(html).toContain('sm:p-6'); // Q12: overlay mantém o respiro do desktop
  });

  it('Q9: ao abrir trava o fundo (iOS-safe) e ao desmontar restaura estilos e posição', () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('window', { scrollY: 320, scrollTo });
    renderToStaticMarkup(createElement(PendenciasAcessoDialog, { open: true, resumo, onClose: () => undefined }));
    expect(body.style).toEqual({ position: 'fixed', top: '-320px', left: '0', right: '0', width: '100%' });
    const limpeza = limpezas.find((l): l is () => void => typeof l === 'function');
    expect(limpeza).toBeTypeOf('function');
    expect(scrollTo).not.toHaveBeenCalled();
    limpeza!();
    expect(body.style).toEqual(estiloInicial());
    expect(scrollTo).toHaveBeenCalledWith(0, 320);
  });

  it('no celular é folha 100dvh com rolagem interna e rodapé fora da rolagem; desktop mantém o card', () => {
    const html = renderToStaticMarkup(createElement(PendenciasAcessoDialog, { open: true, resumo, onClose: () => undefined }));
    expect(html).toContain('h-[100dvh]');
    expect(html).toContain('sm:max-h-[min(80dvh,640px)]');
    expect(html).toContain('sm:rounded-[16px]');
    const rolagem = html.indexOf('overflow-y-auto');
    const fechar = html.lastIndexOf('Fechar');
    expect(rolagem).toBeGreaterThan(-1);
    expect(html).toMatch(/overflow-y-auto overscroll-contain/); // Q11
    // rodapé com Fechar é irmão da área rolável (shrink-0) e respeita safe-area
    expect(html).toMatch(/flex shrink-0 justify-end[^"]*env\(safe-area-inset-bottom\)/);
    expect(fechar).toBeGreaterThan(rolagem);
    expect(html).toContain('h-11');
  });

  it('não renderiza nada sem pendências e no SSR (sem document)', () => {
    expect(renderToStaticMarkup(createElement(PendenciasAcessoDialog, { open: true, resumo: { total: 0, grupos: [] } as unknown as PendenciasResumo, onClose: () => undefined }))).toBe('');
    vi.unstubAllGlobals();
    vi.stubGlobal('document', undefined);
    expect(renderToStaticMarkup(createElement(PendenciasAcessoDialog, { open: true, resumo, onClose: () => undefined }))).toBe('');
  });

  it('estado vazio também vai por portal', () => {
    renderToStaticMarkup(createElement(PendenciasVazio, { onClose: () => undefined }));
    expect(portais[0]?.alvo).toBe(body);
  });

  it('login automático e botão usam o mesmo componente', () => {
    const raiz = path.resolve(__dirname, '../..');
    const login = readFileSync(path.join(raiz, 'app/login/page.tsx'), 'utf8');
    const botao = readFileSync(path.join(raiz, 'components/pendencias/pendencias-button.tsx'), 'utf8');
    const imp = /import \{[^}]*PendenciasAcessoDialog[^}]*\} from '@\/components\/pendencias\/pendencias-acesso-dialog'/;
    expect(login).toMatch(imp);
    expect(botao).toMatch(imp);
    expect(login).toContain('<PendenciasAcessoDialog');
    expect(botao).toContain('<PendenciasAcessoDialog');
    expect(botao).not.toMatch(/function PendenciasVazio/);
  });
});
