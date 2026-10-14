import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = path.resolve(__dirname, '../..');
const ler = (p: string) => readFileSync(path.join(raiz, p), 'utf8');

describe('289 · ligação no shell', () => {
  const comp = ler('components/pendencias/pendencias-abertura-automatica.tsx');

  it('o shell monta a abertura automática uma única vez', () => {
    const shell = ler('components/layout/app-shell.tsx');
    expect(shell.match(/<PendenciasAberturaAutomatica \/>/g)).toHaveLength(1);
  });

  it('instância por carregamento de página (escopo do módulo), não por montagem', () => {
    expect(comp).toMatch(/^let instancia: AberturaDiaria<PendenciasResumo> \| null = null;$/m);
    expect(comp).toContain('instancia ??= criarAberturaDiaria');
  });

  it('mudança de rota só chama aoNavegar (sem endpoint); visibilitychange passa o estado ao controle', () => {
    expect(comp).toMatch(/\}, \[pathname\]\);/);
    const efeitoRota = comp.slice(comp.indexOf('primeiraRota.current = false'), comp.indexOf('}, [pathname]);'));
    expect(efeitoRota).toContain('aberturaDiaria().aoNavegar()');
    expect(efeitoRota).not.toMatch(/verificar|aoCarregar|aoMudarVisibilidade/);
    expect(comp).toContain('controle.aoMudarVisibilidade(document.visibilityState)');
    expect(comp.match(/verificarAberturaDiariaPendencias/g)).toHaveLength(2); // import + deps
  });

  it('o login não abre mais o modal por conta própria (só o servidor decide)', () => {
    const login = ler('app/login/page.tsx');
    expect(login).not.toContain('getPendenciasResumo');
    expect(login).not.toContain('<PendenciasAcessoDialog');
  });

  it('o título do modal recebe foco (tabIndex -1)', () => {
    expect(ler('components/pendencias/pendencias-acesso-dialog.tsx')).toMatch(/id="pendencias-titulo" tabIndex=\{-1\}/);
  });
});
