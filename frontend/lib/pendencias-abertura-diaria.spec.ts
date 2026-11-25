import { describe, expect, it, vi } from 'vitest';
import { criarAberturaDiaria } from './pendencias-abertura-diaria';
import { criarControleFoco, criarRastreioFormularios, haOutroModalAberto } from './bloqueios-modal';

type R = { total: number };
/** Servidor fake: guarda o dia por usuário, como o backend (só a 1ª verificação do dia devolve abrir). */
function servidor(total = 2) {
  const marcados = new Map<string, string>();
  let dia = '2026-10-14';
  return {
    virarDia(novo: string) { dia = novo; },
    verificarComo(usuario: string) {
      return vi.fn(async () => {
        const abrir = marcados.get(usuario) !== dia && total > 0;
        marcados.set(usuario, dia);
        return { abrir, pendencias: { total } as R };
      });
    },
  };
}

function montar(verificar: () => Promise<{ abrir: boolean; pendencias: R }>, bloqueio = { ativo: false }) {
  const abrir = vi.fn();
  const c = criarAberturaDiaria<R>({ verificar, bloqueado: () => bloqueio.ativo, abrir });
  return { c, abrir, bloqueio };
}

describe('289 · front: uma chamada por carregamento, o servidor decide', () => {
  it('carregar chama o endpoint uma vez, mesmo se o shell remontar', async () => {
    const verificar = servidor().verificarComo('u1');
    const { c, abrir } = montar(verificar);
    await c.aoCarregar();
    await c.aoCarregar();
    expect(verificar).toHaveBeenCalledTimes(1);
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it('navegação interna não chama o endpoint e não abre sozinha', async () => {
    const verificar = servidor().verificarComo('u1');
    const { c, abrir } = montar(verificar);
    await c.aoCarregar();
    abrir.mockClear();
    c.aoNavegar();
    c.aoNavegar();
    expect(verificar).toHaveBeenCalledTimes(1);
    expect(abrir).not.toHaveBeenCalled();
  });

  it('mesmo dia: voltar à tela (visible) chama o endpoint e não abre; dia novo: a mesma volta abre', async () => {
    const srv = servidor();
    const verificar = srv.verificarComo('u1');
    const { c, abrir } = montar(verificar);
    await c.aoCarregar();
    expect(abrir).toHaveBeenCalledTimes(1);
    await c.aoMudarVisibilidade('visible');
    expect(verificar).toHaveBeenCalledTimes(2);
    expect(abrir).toHaveBeenCalledTimes(1);
    srv.virarDia('2026-10-15');
    await c.aoMudarVisibilidade('visible');
    expect(abrir).toHaveBeenCalledTimes(2);
  });

  it('visibilitychange para hidden não chama nem abre', async () => {
    const verificar = vi.fn(async () => ({ abrir: true, pendencias: { total: 1 } }));
    const { c, abrir } = montar(verificar);
    await c.aoMudarVisibilidade('hidden');
    expect(verificar).not.toHaveBeenCalled();
    expect(abrir).not.toHaveBeenCalled();
  });

  it('servidor diz abrir:false → o front nunca abre (carregar, visible, navegar)', async () => {
    const verificar = vi.fn(async () => ({ abrir: false, pendencias: { total: 5 } }));
    const { c, abrir } = montar(verificar);
    await c.aoCarregar();
    await c.aoMudarVisibilidade('visible');
    c.aoNavegar();
    c.aoLiberarBloqueio();
    expect(abrir).not.toHaveBeenCalled();
  });

  it('erro do endpoint: não abre e não quebra', async () => {
    const { c, abrir } = montar(vi.fn(async () => { throw new Error('500'); }));
    await expect(c.aoCarregar()).resolves.toBeUndefined();
    expect(abrir).not.toHaveBeenCalled();
  });

  it('dois usuários no mesmo navegador: cada um abre no seu 1º acesso do dia', async () => {
    const srv = servidor();
    const a = montar(srv.verificarComo('u1'));
    await a.c.aoCarregar();
    const b = montar(srv.verificarComo('u2')); // logout/login = novo carregamento
    await b.c.aoCarregar();
    const a2 = montar(srv.verificarComo('u1'));
    await a2.c.aoCarregar();
    expect([a.abrir.mock.calls.length, b.abrir.mock.calls.length, a2.abrir.mock.calls.length]).toEqual([1, 1, 0]);
  });

  it('um usuário em dois aparelhos: só o primeiro abre', async () => {
    const srv = servidor();
    const celular = montar(srv.verificarComo('u1'));
    const desktop = montar(srv.verificarComo('u1'));
    await celular.c.aoCarregar();
    await desktop.c.aoCarregar();
    expect(celular.abrir).toHaveBeenCalledTimes(1);
    expect(desktop.abrir).not.toHaveBeenCalled();
  });
});

describe('289 · adiado (Designer): não cobre outro modal nem form sujo, e nunca se perde', () => {
  it('form sujo: não abre por cima; abre quando o form é salvo/descartado', async () => {
    const { c, abrir, bloqueio } = montar(servidor().verificarComo('u1'), { ativo: true });
    await c.aoCarregar();
    expect(abrir).not.toHaveBeenCalled();
    expect(c.temAdiado()).toBe(true);
    bloqueio.ativo = false;
    expect(c.aoLiberarBloqueio()).toBe(true);
    expect(abrir).toHaveBeenCalledTimes(1);
    expect(c.temAdiado()).toBe(false);
  });

  it('outro modal aberto: abre na próxima navegação, se ela vier primeiro', async () => {
    const { c, abrir, bloqueio } = montar(servidor().verificarComo('u1'), { ativo: true });
    await c.aoCarregar();
    c.aoNavegar(); // ainda bloqueado: continua adiado
    expect(abrir).not.toHaveBeenCalled();
    bloqueio.ativo = false;
    c.aoNavegar();
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it('o adiado não se perde no resto do dia: o servidor já marcou, mas a aba guarda e entrega uma única vez', async () => {
    const srv = servidor();
    const verificar = srv.verificarComo('u1');
    const { c, abrir, bloqueio } = montar(verificar, { ativo: true });
    await c.aoCarregar();
    // várias voltas à tela no mesmo dia: o servidor diz abrir:false, mas o adiado continua
    await c.aoMudarVisibilidade('visible');
    await c.aoMudarVisibilidade('visible');
    expect(c.temAdiado()).toBe(true);
    bloqueio.ativo = false;
    c.aoLiberarBloqueio();
    c.aoNavegar();
    expect(abrir).toHaveBeenCalledTimes(1);
  });
});

describe('289 · detecção de bloqueio no DOM', () => {
  const el = (dentroPendencias = false, isConnected = true) => {
    const self: { closest: (s: string) => unknown; isConnected: boolean } = {
      isConnected,
      closest: (s: string) => (s === '[data-pendencias-overlay]' ? (dentroPendencias ? {} : null) : s === 'form' ? self : null),
    };
    return self as never;
  };

  it('outro dialog aria-modal bloqueia; o próprio modal de pendências não', () => {
    expect(haOutroModalAberto({ querySelectorAll: () => [el(false)] })).toBe(true);
    expect(haOutroModalAberto({ querySelectorAll: () => [el(true)] })).toBe(false);
    expect(haOutroModalAberto({ querySelectorAll: () => [] })).toBe(false);
  });

  it('form fica sujo ao editar e libera ao salvar, descartar (reset) ou sair do DOM', () => {
    const r = criarRastreioFormularios();
    const f1 = el(); const f2 = el();
    r.aoEditar(f1);
    expect(r.haFormularioSujo()).toBe(true);
    expect(r.aoSalvarOuDescartar(f1)).toBe(true);
    expect(r.haFormularioSujo()).toBe(false);
    r.aoEditar(f2);
    (f2 as unknown as { isConnected: boolean }).isConnected = false; // Cancelar fechou o painel
    expect(r.podarDesconectados()).toBe(true);
    expect(r.haFormularioSujo()).toBe(false);
  });

  it('campo fora de form (busca do topo) não bloqueia', () => {
    const r = criarRastreioFormularios();
    r.aoEditar({ closest: () => null });
    expect(r.haFormularioSujo()).toBe(false);
  });
});

describe('289 · foco', () => {
  it('ao abrir foca o título; ao fechar devolve o foco para onde estava', () => {
    const botao = { focus: vi.fn(), isConnected: true };
    const titulo = { focus: vi.fn() };
    const doc = { activeElement: botao as unknown, getElementById: (id: string) => (id === 'pendencias-titulo' ? titulo : null) };
    const foco = criarControleFoco(doc);
    foco.aoAbrir('pendencias-titulo');
    expect(titulo.focus).toHaveBeenCalledTimes(1);
    doc.activeElement = titulo;
    foco.aoFechar();
    expect(botao.focus).toHaveBeenCalledTimes(1);
  });

  it('se o elemento anterior saiu do DOM, não tenta focar', () => {
    const botao = { focus: vi.fn(), isConnected: false };
    const foco = criarControleFoco({ activeElement: botao, getElementById: () => ({ focus: vi.fn() }) });
    foco.aoAbrir('pendencias-titulo');
    foco.aoFechar();
    expect(botao.focus).not.toHaveBeenCalled();
  });
});
