import { describe, expect, it } from 'vitest';
import {
  getDefaultAuthenticatedHref,
  getMobileNav,
  getVisibleNavItems,
  resolvePreferredHref,
} from './navigation';

describe('navigation helpers', () => {
  it('escolhe a primeira rota operacional na ordem do menu', () => {
    expect(getDefaultAuthenticatedHref(['chamados.executar'])).toBe('/execucao');
    expect(getDefaultAuthenticatedHref(['fiscalizacoes.executar'])).toBe('/mobile');
    expect(getDefaultAuthenticatedHref(['dashboard.visualizar'])).toBe('/cco');
  });

  it('usa /conta quando o perfil não tem nenhuma tela operacional', () => {
    expect(getDefaultAuthenticatedHref([])).toBe('/conta');
    expect(getVisibleNavItems([])).toEqual([]);
  });

  it('mantém o menu Mais sempre disponível no mobile', () => {
    const onlyExecucao = getMobileNav(['chamados.executar']);
    expect(onlyExecucao.primary.map((item) => item.id)).toEqual(['execucao']);
    expect(onlyExecucao.hasMore).toBe(true);

    const empty = getMobileNav([]);
    expect(empty.primary).toEqual([]);
    expect(empty.hasMore).toBe(true);
  });

  it('respeita rotas preferidas só quando permitidas', () => {
    expect(resolvePreferredHref(['chamados.executar'], '/cco')).toBe('/execucao');
    expect(resolvePreferredHref(['dashboard.visualizar'], '/cco')).toBe('/cco');
  });
});
