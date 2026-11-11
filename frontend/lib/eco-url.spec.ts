import { describe, expect, it } from 'vitest';
import { decidirEcoDaUrl, registrarEscrita } from './eco-url';

describe('322 C-1 · eco da URL que nós escrevemos', () => {
  it('um eco atrasado do clique intermediário não volta o estado, nem na segunda vez', () => {
    let nossas = registrarEscrita([], '');
    let chave = '';
    const escrever = (canon: string) => {
      nossas = registrarEscrita(nossas, canon);
      chave = canon;
    };

    escrever('prioridade=alta');
    escrever('prioridade=alta&sla=fora');
    escrever('aba=programacao&prioridade=alta&sla=fora');

    const eco1 = decidirEcoDaUrl({ canon: 'prioridade=alta', chave, nossas, popstate: false, escritaPendente: false });
    expect(eco1.tipo).toBe('eco');
    nossas = eco1.nossas;

    const eco2 = decidirEcoDaUrl({ canon: 'prioridade=alta', chave, nossas, popstate: false, escritaPendente: false });
    expect(eco2.tipo).toBe('eco');

    expect(decidirEcoDaUrl({ canon: chave, chave, nossas, popstate: false, escritaPendente: false }).tipo).toBe('igual');
    expect(decidirEcoDaUrl({ canon: 'prioridade=alta&sla=fora', chave, nossas, popstate: false, escritaPendente: false }).tipo).toBe('eco');
    expect(
      decidirEcoDaUrl({ canon: 'prioridade=alta', chave, nossas: [chave], popstate: false, escritaPendente: true }).tipo,
    ).toBe('eco');
  });

  it('popstate aplica a URL mesmo quando nós a escrevemos', () => {
    const nossas = ['prioridade=alta', 'aba=programacao&prioridade=alta&sla=fora'];
    const pop = decidirEcoDaUrl({
      canon: 'prioridade=alta',
      chave: 'aba=programacao&prioridade=alta&sla=fora',
      nossas,
      popstate: true,
      escritaPendente: false,
    });
    expect(pop.tipo).toBe('externa');

    const tarde = decidirEcoDaUrl({
      canon: 'aba=programacao&prioridade=alta&sla=fora',
      chave: 'prioridade=alta',
      nossas: pop.nossas,
      popstate: false,
      escritaPendente: false,
    });
    expect(tarde.tipo).toBe('eco');
  });

  it('query que não escrevemos entra como navegação externa', () => {
    const decisao = decidirEcoDaUrl({
      canon: 'search=outra',
      chave: 'prioridade=alta',
      nossas: ['', 'prioridade=alta'],
      popstate: false,
      escritaPendente: false,
    });
    expect(decisao.tipo).toBe('externa');
  });
});
