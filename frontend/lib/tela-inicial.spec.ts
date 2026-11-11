import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
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

  it('sem CCO cai na primeira funcionalidade permitida, na ordem do menu', () => {
    expect(primeiraTelaPermitida([CHAMADOS, 'chamados.gerenciar'])).toBe('/chamados');
    expect(primeiraTelaPermitida(['fiscalizacoes.executar'])).toBe('/mobile');
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
