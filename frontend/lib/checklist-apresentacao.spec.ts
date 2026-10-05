import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { formatRespostaValor, deveExibirCabecalhoSecao } from './checklist-item-opcoes';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const frontendRequire = createRequire(resolve('frontend/package.json'));
const React = frontendRequire('react') as typeof import('react');
const { renderToStaticMarkup } = frontendRequire('react-dom/server') as typeof import('react-dom/server');

function markupTituloNc(src: string, item: { codigo: string; titulo: string }, padraoCodigo: RegExp) {
  const prefixaCodigo = padraoCodigo.test(src);
  return renderToStaticMarkup(
    React.createElement('p', null, prefixaCodigo ? `${item.codigo} — ${item.titulo}` : item.titulo),
  );
}

describe('tela de detalhe da vistoria e leitura de documento', () => {
  it('formatRespostaValor cobre múltipla nova, única antiga e vazia', () => {
    expect(formatRespostaValor({ valorTexto: '["Bom","Ótimo"]' })).toBe('Bom, Ótimo');
    expect(formatRespostaValor({ valorTexto: 'Regular' })).toBe('Regular');
    expect(formatRespostaValor({})).toBe('—');
  });

  it('agrupa seção só no primeiro item consecutivo', () => {
    expect(deveExibirCabecalhoSecao('Infraestrutura básica', undefined)).toBe(true);
    expect(deveExibirCabecalhoSecao('Infraestrutura básica', 'Infraestrutura básica')).toBe(false);
  });

  it('vistorias/page.tsx usa formatRespostaValor e não concatena código no título da pergunta', () => {
    const src = readFileSync(resolve('frontend/app/(authenticated)/vistorias/page.tsx'), 'utf8');
    expect(src).toContain('formatRespostaValor');
    expect(src).not.toMatch(/item\.codigo} — \{resposta\.item\.titulo/);
  });

  it('DocumentoAvulsoRespostasLeitura usa formatRespostaValor', () => {
    const src = readFileSync(resolve('frontend/components/documentos/documento-avulso-form.tsx'), 'utf8');
    expect(src).toContain('formatRespostaValor');
  });

  it('histórico da execução (chamado-status) usa formatRespostaValor', () => {
    const src = readFileSync(resolve('frontend/lib/chamado-status.ts'), 'utf8');
    expect(src).toContain('formatRespostaValor');
  });

  it('CCO da unidade formata valor da resposta da NC', () => {
    const src = readFileSync(resolve('frontend/app/(authenticated)/cco/unidades/[id]/page.tsx'), 'utf8');
    expect(src).toContain('formatRespostaValor');
  });

  it('P16 chamados/page.tsx mostra só o título da NC, sem código técnico', () => {
    const src = readFileSync(resolve('frontend/app/(authenticated)/chamados/page.tsx'), 'utf8');
    expect(src).toContain('{resumo.naoConformidade.item.titulo}');
    expect(src).not.toContain('{resumo.naoConformidade.item.codigo} — {resumo.naoConformidade.item.titulo}');
    const markup = markupTituloNc(
      src,
      { codigo: 'ZZ-COD-NC', titulo: 'Estado das paredes internas' },
      /\{resumo\.naoConformidade\.item\.codigo\} — \{resumo\.naoConformidade\.item\.titulo\}/,
    );
    expect(markup).toBe('<p>Estado das paredes internas</p>');
    expect(markup).not.toContain('ZZ-COD-NC');
  });

  it('P17 unidade-drawer.tsx mostra só o título da NC, sem código técnico', () => {
    const src = readFileSync(resolve('frontend/components/cco/unidade-drawer.tsx'), 'utf8');
    expect(src).toContain('{item.item.titulo}');
    expect(src).not.toContain('{item.item.codigo} — {item.item.titulo}');
    const markup = markupTituloNc(
      src,
      { codigo: 'ZZ-COD-NC', titulo: 'Estado das paredes internas' },
      /\{item\.item\.codigo\} — \{item\.item\.titulo\}/,
    );
    expect(markup).toBe('<p>Estado das paredes internas</p>');
    expect(markup).not.toContain('ZZ-COD-NC');
  });
});
