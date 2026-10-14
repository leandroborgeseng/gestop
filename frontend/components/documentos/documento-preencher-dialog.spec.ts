import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/snackbar', () => ({
  useSnackbar: () => ({ show: () => undefined }),
}));

import { DocumentoPreencherDialog, travarRolagemFundo } from './documento-consulta-dialogs';
import { comportamentoRolagem } from './documento-avulso-form';
import type { DocumentoDetalhe } from '@/lib/types';

const documento = {
  id: 'doc-284',
  codigo: 'DOC-2026-284',
  titulo: 'Vistoria teste',
  checklistItens: [
    { id: 'item-1', ordem: 1, codigo: 'I1', titulo: 'Item de teste', tipo: 'TEXTO', obrigatorio: true, geraNaoConformidade: false, exigeEvidencia: false },
  ],
  respostas: [],
} as unknown as DocumentoDetalhe;

function render() {
  const html = renderToStaticMarkup(
    createElement(DocumentoPreencherDialog, { documento, onClose: () => undefined, onSaved: () => undefined }),
  );
  const doc = new DOMParserLite(html);
  return { html, doc };
}

/** Parser mínimo: localiza a abertura das tags com data-testid e verifica aninhamento. */
class DOMParserLite {
  constructor(private readonly html: string) {}
  indexOf(testId: string) {
    return this.html.indexOf(`data-testid="${testId}"`);
  }
  /** Retorna o trecho do elemento (div) iniciado em data-testid, contando aberturas/fechamentos. */
  elementHtml(testId: string, tag: string) {
    const start = this.html.lastIndexOf(`<${tag}`, this.indexOf(testId));
    const re = new RegExp(`<${tag}[\\s>]|</${tag}>`, 'g');
    re.lastIndex = start;
    let depth = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(this.html))) {
      depth += m[0].startsWith('</') ? -1 : 1;
      if (depth === 0) return this.html.slice(start, m.index + m[0].length);
    }
    throw new Error(`unbalanced ${testId} depth=${depth} start=${start}`);
  }
}

describe('DocumentoPreencherDialog (284)', () => {
  it('renderiza o rodapé fora do contêiner que rola, com os dois botões', () => {
    const { doc } = render();
    const corpo = doc.elementHtml('documento-preencher-corpo', 'div');
    const rodape = doc.elementHtml('documento-preencher-rodape', 'footer');

    expect(corpo).toContain('overflow-y-auto');
    expect(corpo).toContain('overscroll-contain');
    expect(corpo).not.toContain('documento-preencher-rodape');
    expect(corpo).not.toContain('Concluir documento');
    expect(rodape).not.toContain('overflow-y-auto');
    expect(rodape).toContain('shrink-0');
    expect(rodape).toContain('env(safe-area-inset-bottom)');
    expect(doc.indexOf('documento-preencher-rodape')).toBeGreaterThan(doc.indexOf('documento-preencher-corpo'));

    expect(rodape).toContain('Salvar rascunho');
    expect(rodape).toContain('Concluir documento');
    expect(rodape.indexOf('Salvar rascunho')).toBeLessThan(rodape.indexOf('Concluir documento'));
  });

  it('usa folha de altura cheia em dvh no celular e botão Fechar de 44px', () => {
    const { html } = render();
    expect(html).toContain('h-[calc(100dvh-env(safe-area-inset-top))]');
    expect(html).toContain('sm:max-h-[min(94dvh,920px)]');
    expect(html).not.toContain('100vh');
    expect(html).toMatch(/aria-label="Fechar"[^>]*h-11 w-11|h-11 w-11[^>]*aria-label="Fechar"/);
  });
});

describe('284: rolagem respeita prefers-reduced-motion', () => {
  it('usa auto quando reduce está ativo e smooth caso contrário', () => {
    const mm = (matches: boolean) => vi.fn().mockReturnValue({ matches }) as unknown as Window['matchMedia'];
    const reduz = mm(true);
    expect(comportamentoRolagem({ matchMedia: reduz })).toBe('auto');
    expect(reduz).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(comportamentoRolagem({ matchMedia: mm(false) })).toBe('smooth');
    expect(comportamentoRolagem(undefined)).toBe('smooth');
  });
});

describe('284: trava do fundo iOS-safe', () => {
  it('fixa o body com top negativo e restaura estilos e posição ao fechar', () => {
    const style = { position: 'relative', top: '', left: '', right: '', width: '' };
    const body = { style } as unknown as HTMLElement;
    const scrollTo = vi.fn();
    const win = { scrollY: 420, scrollTo } as unknown as Window;

    const restaurar = travarRolagemFundo(win, { body });
    expect(style).toEqual({ position: 'fixed', top: '-420px', left: '0', right: '0', width: '100%' });
    expect(scrollTo).not.toHaveBeenCalled();

    restaurar();
    expect(style).toEqual({ position: 'relative', top: '', left: '', right: '', width: '' });
    expect(scrollTo).toHaveBeenCalledWith(0, 420);
  });
});
