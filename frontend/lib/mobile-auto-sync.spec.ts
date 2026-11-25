import { describe, expect, it, vi } from 'vitest';
import { criarAutoSync } from './mobile-auto-sync';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('309 ajuste 2 · sync automático da fila', () => {
  it('abre online com fila → exatamente 1 tentativa, mesmo com reavaliações e duplo mount', async () => {
    const executar = vi.fn().mockResolvedValue(undefined);
    const a = criarAutoSync(executar);
    const e = { online: true, filaCarregada: true, temItens: true };
    expect(a.avaliar({ ...e, filaCarregada: false })).toBeNull();
    expect(a.avaliar(e)).toBe('ABERTURA');
    a.avaliar(e); // strict mode: efeito roda 2x
    await tick();
    a.avaliar(e); // outra mudança de estado, ainda online
    await tick();
    expect(executar).toHaveBeenCalledTimes(1);
  });

  it('requisição em andamento bloqueia uma segunda chamada (volta da conexão no meio do envio)', async () => {
    let soltar!: () => void;
    const executar = vi.fn(() => new Promise<void>((r) => (soltar = r)));
    const a = criarAutoSync(executar);
    a.avaliar({ online: true, filaCarregada: true, temItens: true });
    await tick();
    a.avaliar({ online: false, filaCarregada: true, temItens: true });
    expect(a.avaliar({ online: true, filaCarregada: true, temItens: true })).toBeNull();
    expect(executar).toHaveBeenCalledTimes(1);
    soltar();
  });

  it('item recusado: no máximo 2 envios (abertura + 1 reconexão), sem laço', async () => {
    const executar = vi.fn().mockRejectedValue(new Error('409'));
    const a = criarAutoSync(executar);
    const on = { online: true, filaCarregada: true, temItens: true };
    a.avaliar(on);
    await tick();
    for (let i = 0; i < 20; i++) a.avaliar(on);
    a.avaliar({ ...on, online: false });
    a.avaliar(on);
    await tick();
    for (let i = 0; i < 20; i++) a.avaliar(on);
    await tick();
    expect(executar).toHaveBeenCalledTimes(2);
    expect(executar.mock.calls.map((c) => c[0])).toEqual(['ABERTURA', 'RECONEXAO']);
  });

  it('offline → online reenvia 1 vez; aberto offline, a 1ª volta online conta como a tentativa', async () => {
    const executar = vi.fn().mockResolvedValue(undefined);
    const a = criarAutoSync(executar);
    a.avaliar({ online: false, filaCarregada: true, temItens: true });
    expect(executar).not.toHaveBeenCalled();
    a.avaliar({ online: true, filaCarregada: true, temItens: true });
    await tick();
    expect(executar).toHaveBeenCalledTimes(1);
    a.avaliar({ online: false, filaCarregada: true, temItens: true });
    expect(a.avaliar({ online: true, filaCarregada: true, temItens: true })).toBe('RECONEXAO');
    await tick();
    expect(executar).toHaveBeenCalledTimes(2);
  });

  it('fila vazia não dispara', () => {
    const executar = vi.fn();
    const a = criarAutoSync(executar);
    a.avaliar({ online: true, filaCarregada: true, temItens: false });
    a.avaliar({ online: false, filaCarregada: true, temItens: false });
    a.avaliar({ online: true, filaCarregada: true, temItens: false });
    expect(executar).not.toHaveBeenCalled();
  });
});
