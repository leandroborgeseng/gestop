import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getMenuItemsInDisplayOrder, getVisibleNavItems, hrefDaListaDoMenu, NAV_ITEMS } from './navigation';
import { buildMatrixKey } from './permissions-matrix';
import {
  deveIrParaTelaPadrao,
  hrefDepoisDoLogin,
  primeiraTelaPermitida,
  sanitizeReturnTo,
} from './tela-inicial';

const CCO = buildMatrixKey('cco', '_tela', 'visualizar');
const VISTORIA = buildMatrixKey('vistoria_campo', '_tela', 'visualizar');
const CHAMADOS = buildMatrixKey('chamados', '_tela', 'visualizar');
const DOCUMENTOS = buildMatrixKey('documentos', '_tela', 'visualizar');

describe('primeiraTelaPermitida', () => {
  it('com permissão de ver o CCO abre o CCO, mesmo também podendo vistoriar', () => {
    expect(primeiraTelaPermitida([CCO, VISTORIA, 'fiscalizacoes.executar', 'dashboard.visualizar'])).toBe('/cco');
    expect(primeiraTelaPermitida(['dashboard.visualizar', 'fiscalizacoes.executar'])).toBe('/cco');
    expect(
      primeiraTelaPermitida({
        perfil: [CCO, VISTORIA],
        individuais: [CHAMADOS],
      }),
    ).toBe('/cco');
  });

  it('concessão individual de CCO soma ao perfil que não tinha o CCO', () => {
    expect(
      primeiraTelaPermitida({
        perfil: [CHAMADOS, 'chamados.gerenciar'],
        individuais: [CCO, 'dashboard.visualizar'],
      }),
    ).toBe('/cco');
  });

  it('a ordem visível difere da ordem interna de NAV_ITEMS', () => {
    const perfis = [
      { nome: 'Sem CCO', permissoes: [CHAMADOS, 'chamados.gerenciar'] },
      { nome: 'gestor legado', permissoes: ['chamados.gerenciar'] },
    ];
    for (const perfil of perfis) {
      const interna = getVisibleNavItems(perfil.permissoes).map((item) => item.id);
      const visivel = getMenuItemsInDisplayOrder(perfil.permissoes).map((item) => item.id);
      expect(visivel, perfil.nome).not.toEqual(interna);
    }
  });

  it('perfil ativo sem CCO não herda o CCO do outro perfil', () => {
    const perfilA = [CHAMADOS, 'chamados.gerenciar'];
    const perfilB = [CCO, 'dashboard.visualizar'];
    // A sessão efetiva é a do perfil ativo. A união abriria o CCO e não pode ser a entrada.
    expect(primeiraTelaPermitida(perfilA)).toBe('/chamados');
    expect(primeiraTelaPermitida(perfilA)).not.toBe('/cco');
    expect(primeiraTelaPermitida(perfilB)).toBe('/cco');
    expect(primeiraTelaPermitida([...perfilA, ...perfilB])).toBe('/cco');
  });

  it('Sem CCO abre Chamados e pula o atalho Novo chamado', () => {
    const permissoes = [CHAMADOS, 'chamados.gerenciar'];
    const visivel = getMenuItemsInDisplayOrder(permissoes);
    expect(visivel.map((item) => item.label)).toEqual(['Novo chamado', 'Meus chamados', 'Chamados']);
    expect(visivel[0]?.href).toBe('/chamados/novo');
    expect(visivel[0]?.atalhoCriacao).toBe(true);
    expect(getVisibleNavItems(permissoes)[0]?.href).toBe('/chamados');
    expect(primeiraTelaPermitida(permissoes)).toBe('/chamados');
    expect(primeiraTelaPermitida(permissoes)).not.toBe('/chamados/novo');
  });

  it('pula o atalho de criação mesmo quando ele é o primeiro do menu', () => {
    const permissoes = ['chamados.abrir'];
    expect(getMenuItemsInDisplayOrder(permissoes)[0]?.href).toBe('/chamados/novo');
    expect(primeiraTelaPermitida(permissoes)).toBe('/meus-chamados');
    expect(hrefDaListaDoMenu([{ id: 'novo_chamado', href: '/chamados/novo', atalhoCriacao: true }])).toBe('/conta');
  });

  it('sem a lista de Chamados, a ordem interna não manda na entrada', () => {
    expect(primeiraTelaPermitida(['fiscalizacoes.executar'])).toBe('/mobile');
    expect(primeiraTelaPermitida([CHAMADOS])).toBe('/chamados');
    expect(primeiraTelaPermitida([CHAMADOS])).not.toBe('/cco');
    expect(primeiraTelaPermitida([CHAMADOS])).not.toBe('/mobile');
  });

  it('sem nenhuma permissão vai para /conta', () => {
    expect(primeiraTelaPermitida([])).toBe('/conta');
    expect(primeiraTelaPermitida({ perfil: [], individuais: [] })).toBe('/conta');
  });

  it('permissão individual de matriz sem visualizar o CCO tira o CCO que o legado do perfil abriria', () => {
    // O perfil só com dashboard.visualizar abriria o CCO.
    expect(primeiraTelaPermitida({ perfil: ['dashboard.visualizar', 'fiscalizacoes.executar'] })).toBe('/cco');
    // A concessão individual liga o modo matriz. Sem matriz.cco.*.visualizar, o legado deixa de valer para o menu.
    expect(
      primeiraTelaPermitida({
        perfil: ['dashboard.visualizar', 'fiscalizacoes.executar'],
        individuais: [DOCUMENTOS],
      }),
    ).toBe('/documentos');
  });
});

describe('BK-322-B1 — precedência por flag, sem id fixo', () => {
  const casos = [
    { destino: '/cco', permissoes: [CCO, 'dashboard.visualizar'] },
    { destino: '/chamados', permissoes: [CHAMADOS, 'chamados.gerenciar'] },
    { destino: '/meus-chamados', permissoes: ['chamados.abrir'] },
    { destino: '/vistorias', permissoes: [buildMatrixKey('vistorias', '_tela', 'visualizar')] },
    { destino: '/conta', permissoes: [] as string[] },
  ];

  it('os perfis do QA 322 ciclo 2 caem em /cco, /chamados, /meus-chamados, /vistorias e /conta', () => {
    for (const caso of casos) {
      expect(primeiraTelaPermitida(caso.permissoes), caso.destino).toBe(caso.destino);
    }
  });

  it('a lista de Chamados e Meus chamados se distinguem por flag, não por id', () => {
    const chamados = NAV_ITEMS.find((item) => item.href === '/chamados');
    const meus = NAV_ITEMS.find((item) => item.href === '/meus-chamados');
    expect(chamados?.listaDeChamados).toBe(true);
    expect(meus?.cedeParaListaDeChamados).toBe(true);
    const src = readFileSync(resolve('frontend/lib/navigation.ts'), 'utf8');
    const corpo = src.slice(src.indexOf('export function hrefDaListaDoMenu'));
    expect(corpo).not.toContain("item.id === 'chamados'");
    expect(corpo).not.toContain("item.id === 'meus_chamados'");
    expect(corpo).toContain('item.listaDeChamados');
    expect(corpo).toContain('item.cedeParaListaDeChamados');
    expect(
      hrefDaListaDoMenu([
        { href: '/meus-chamados', cedeParaListaDeChamados: true },
        { href: '/chamados', listaDeChamados: true },
      ]),
    ).toBe('/chamados');
    expect(hrefDaListaDoMenu([{ href: '/meus-chamados', cedeParaListaDeChamados: true }])).toBe('/meus-chamados');
  });
});

describe('BK-322-B2 — atalho de criação vem do próprio item', () => {
  it('hrefDaListaDoMenu usa item.atalhoCriacao e mantém os destinos do QA 322 ciclo 2', () => {
    const src = readFileSync(resolve('frontend/lib/navigation.ts'), 'utf8');
    const corpo = src.slice(src.indexOf('export function hrefDaListaDoMenu'), src.indexOf('export function rotasDeCriacao'));
    expect(corpo).toContain('item.atalhoCriacao');
    expect(corpo).not.toContain('rotasDeCriacao');
    expect(hrefDaListaDoMenu([{ href: '/chamados/novo', atalhoCriacao: true }, { href: '/vistorias' }])).toBe('/vistorias');
    expect(hrefDaListaDoMenu([{ href: '/chamados/novo' }, { href: '/conta-custom' }])).toBe('/chamados/novo');
    expect(primeiraTelaPermitida([CCO, 'dashboard.visualizar'])).toBe('/cco');
    expect(primeiraTelaPermitida([CHAMADOS, 'chamados.gerenciar'])).toBe('/chamados');
    expect(primeiraTelaPermitida(['chamados.abrir'])).toBe('/meus-chamados');
    expect(primeiraTelaPermitida([buildMatrixKey('vistorias', '_tela', 'visualizar')])).toBe('/vistorias');
    expect(primeiraTelaPermitida([])).toBe('/conta');
  });
});

describe('entrada e login', () => {
  it('login sem returnTo usa a tela padrão; com returnTo respeita o destino permitido', () => {
    expect(hrefDepoisDoLogin([CCO, CHAMADOS, 'dashboard.visualizar'], undefined, null)).toBe('/cco');
    expect(hrefDepoisDoLogin([CCO, CHAMADOS, 'dashboard.visualizar'], undefined, '/chamados?aba=programacao&search=322')).toBe(
      '/chamados?aba=programacao&search=322',
    );
    expect(hrefDepoisDoLogin([CHAMADOS, 'chamados.gerenciar'], undefined, '/cco')).toBe('/chamados');
    expect(hrefDepoisDoLogin([CCO, 'dashboard.visualizar'], undefined, '/')).toBe('/cco');
  });

  it('recusa returnTo externo ou de login', () => {
    expect(sanitizeReturnTo('//evil.example/cco')).toBeNull();
    expect(sanitizeReturnTo('https://evil.example/cco')).toBeNull();
    expect(sanitizeReturnTo('/login?reason=expired')).toBeNull();
    expect(sanitizeReturnTo('/chamados?id=1')).toBe('/chamados?id=1');
  });

  it('só a raiz e o login sem returnTo escolhem a tela padrão', () => {
    expect(deveIrParaTelaPadrao('raiz', '/')).toBe(true);
    expect(deveIrParaTelaPadrao('raiz', '/cco')).toBe(false);
    expect(deveIrParaTelaPadrao('raiz', '/mobile')).toBe(false);
    expect(deveIrParaTelaPadrao('raiz', '/chamados?aba=programacao')).toBe(false);
    expect(deveIrParaTelaPadrao('login', '/login')).toBe(true);
    expect(deveIrParaTelaPadrao('rota', '/chamados')).toBe(false);
    expect(deveIrParaTelaPadrao('foco', '/chamados')).toBe(false);
    expect(deveIrParaTelaPadrao('visibilidade', '/execucao')).toBe(false);
    expect(deveIrParaTelaPadrao('refresh-token', '/documentos')).toBe(false);
  });

  it('o start_url do PWA é a raiz, não a Vistoria', () => {
    const manifest = readFileSync(resolve('frontend/app/manifest.ts'), 'utf8');
    expect(manifest).toMatch(/start_url:\s*'\/'/);
    expect(manifest).not.toMatch(/start_url:\s*'\/mobile'/);
  });
});
