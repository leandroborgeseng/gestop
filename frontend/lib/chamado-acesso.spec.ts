import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ehSemAcessoChamado, SEM_ACESSO_CHAMADO } from './chamado-acesso';
import { podeAbrirLinkChamado } from './nc-chamado-link';

describe('315 · permissões do link do chamado', () => {
  it('sem permissão de Chamados não há link para /chamados nem /execucao', () => {
    const soCco = ['dashboard.visualizar'];
    expect(podeAbrirLinkChamado('/chamados?id=c-1', soCco)).toBe(false);
    expect(podeAbrirLinkChamado('/execucao/c-1', soCco)).toBe(false);
  });
  it('com permissão abre o destino certo', () => {
    expect(podeAbrirLinkChamado('/chamados?id=c-1', ['chamados.gerenciar'])).toBe(true);
    expect(podeAbrirLinkChamado('/execucao/c-1', ['chamados.executar'])).toBe(true);
  });
  it('drawer só renderiza link quando podeAbrirLinkChamado permite', () => {
    const src = readFileSync(resolve('frontend/components/cco/unidade-drawer.tsx'), 'utf8');
    expect(src).toMatch(/podeAbrirLinkChamado\(href, sessionUser\?\.permissoes/);
    expect(src).toMatch(/href=\{linkDaNc\(item\.chamado\)!\}/);
    expect(src).toMatch(/data-testid="nc-chamado-selo"/);
  });
  it('aba Chamados do drawer: sem permissão o card não é link', () => {
    const src = readFileSync(resolve('frontend/components/cco/unidade-drawer.tsx'), 'utf8');
    const aba = src.slice(src.indexOf('function ChamadosTab'));
    expect(aba).toMatch(/podeAbrirLinkChamado\(href, sessionUser\?\.permissoes/);
    expect(aba).toMatch(/podeAbir|podeAbrir \? \(\s*<Link/);
    expect(aba).toMatch(/data-testid="drawer-chamado-sem-link"/);
  });
});

describe('315 · chamado de outra Secretaria aberto pelo id', () => {
  it('403/404 viram "Você não tem acesso a este chamado"', () => {
    expect(SEM_ACESSO_CHAMADO).toBe('Você não tem acesso a este chamado');
    expect(ehSemAcessoChamado({ status: 403 })).toBe(true);
    expect(ehSemAcessoChamado({ status: 404 })).toBe(true);
    expect(ehSemAcessoChamado({ status: 500 })).toBe(false);
    expect(ehSemAcessoChamado(new Error('rede'))).toBe(false);
  });
  it('tela de Chamados mostra a mensagem e não cai no primeiro da lista', () => {
    const src = readFileSync(resolve('frontend/app/(authenticated)/chamados/page.tsx'), 'utf8');
    expect(src).toMatch(/ehSemAcessoChamado\(err\)[\s\S]*setSemAcessoId\(selectedId\)/);
    expect(src).toMatch(/selectedId === semAcessoId\) return null/);
    expect(src).toMatch(/data-testid="chamado-sem-acesso"[\s\S]*AVISO_REGISTRO_URL/);
  });
  it('link direto para chamado fora da página atual usa o detalhe buscado pelo id', () => {
    const src = readFileSync(resolve('frontend/app/(authenticated)/chamados/page.tsx'), 'utf8');
    expect(src).toMatch(/if \(detail\?\.id === selectedId\) return detail;/);
    expect(src).toMatch(/current === pedidoUrlRef\.current/);
    expect(src).toMatch(/function abrirChamado\(id: string\)[\s\S]*pedidoUrlRef\.current = null;[\s\S]*setSelectedId\(id\)/);
  });
  it('Execução mostra a mensagem', () => {
    const src = readFileSync(resolve('frontend/components/chamados/chamado-execucao-flow.tsx'), 'utf8');
    expect(src).toMatch(/ehSemAcessoChamado\(err\) \? SEM_ACESSO_CHAMADO/);
  });
});
