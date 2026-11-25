import '@/test-utils/jsdom-global';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getMapaCamadas = vi.fn(async () => [{ id: 'g', titulo: 'Drenagem', camadas: [] }]);
vi.mock('@/lib/api', () => ({ getMapaCamadas: () => getMapaCamadas() }));

import { useArvoreCamadasWebmap } from './use-arvore-camadas-webmap';
import { contarCamadasAlemDoPadrao, estadoCamadasPadrao, filtrarArvore, resumoGrupo } from './cco-camadas';
import type { MapaCamada } from './types';

afterEach(() => { getMapaCamadas.mockClear(); });

const cam = (id: string, nome: string): MapaCamada => ({ id: `webmap:${id}`, camadaId: id, nomeOriginal: nome, geometriaTipo: 'Point', estilo: null, totalElementos: 1, versaoAtual: 'v', ligadaPorPadrao: false, pesada: false });

describe('300 · árvore do Webmap sem flag', () => {
  it('sem env: nada na montagem, carrega uma vez sob demanda (W12)', async () => {
    const { result } = renderHook(() => useArvoreCamadasWebmap());
    expect(getMapaCamadas).not.toHaveBeenCalled();
    act(() => result.current.garantir());
    await waitFor(() => expect(result.current.arvore).toHaveLength(1));
    act(() => result.current.garantir());
    expect(getMapaCamadas).toHaveBeenCalledTimes(1);
  });

  it('selo conta camadas Webmap ligadas', () => {
    const estado = { ...estadoCamadasPadrao(), ligadas: [...estadoCamadasPadrao().ligadas, 'webmap:a', 'webmap:b'] };
    expect(contarCamadasAlemDoPadrao(estado, false)).toBe(2);
    expect(contarCamadasAlemDoPadrao(estado, true)).toBe(3);
  });

  it('W11: padrão sem nenhuma camada Webmap', () => {
    expect(estadoCamadasPadrao().ligadas.some((id) => id.startsWith('webmap:'))).toBe(false);
  });

  it('U1/W7: tri-estado do grupo', () => {
    const g = { id: 'g', titulo: 'G', camadas: [cam('a', 'A'), cam('b', 'B')] };
    const base = estadoCamadasPadrao();
    expect(resumoGrupo(base, g).marcado).toBe(false);
    expect(resumoGrupo({ ...base, ligadas: ['webmap:a'] }, g).marcado).toBe('mixed');
    expect(resumoGrupo({ ...base, ligadas: ['webmap:a', 'webmap:b'] }, g).marcado).toBe(true);
  });

  it('W16: busca sem acento/caixa, por camada ou grupo', () => {
    const arv = [{ id: 'g1', titulo: 'Água', camadas: [cam('a', 'Rede de água'), cam('b', 'Hidrantes')] }, { id: 'g2', titulo: 'Drenagem', camadas: [cam('c', 'Bocas de lobo')] }];
    expect(filtrarArvore(arv, 'AGUA').map((g) => g.id)).toEqual(['g1']);
    expect(filtrarArvore(arv, 'agua')[0].camadas).toHaveLength(2); // nome do grupo bate => grupo inteiro
    expect(filtrarArvore(arv, 'boca')[0].camadas.map((c) => c.nomeOriginal)).toEqual(['Bocas de lobo']);
    expect(filtrarArvore(arv, 'xyz')).toEqual([]);
    expect(filtrarArvore(arv, '  ')).toBe(arv);
  });
});

describe('300 QA2 · 403 na lista', () => {
  it('403 => semAcesso (não erro) e garantir não repete a requisição', async () => {
    getMapaCamadas.mockImplementationOnce(async () => { throw Object.assign(new Error('Acesso negado'), { status: 403 }); });
    const { result } = renderHook(() => useArvoreCamadasWebmap());
    act(() => result.current.garantir());
    await waitFor(() => expect(result.current.semAcesso).toBe(true));
    expect(result.current.erro).toBe(false);
    act(() => result.current.garantir());
    expect(getMapaCamadas).toHaveBeenCalledTimes(1);
  });
  it('falha de rede => erro (com Tentar novamente), não semAcesso', async () => {
    getMapaCamadas.mockImplementationOnce(async () => { throw new Error('Falha de conexao'); });
    const { result } = renderHook(() => useArvoreCamadasWebmap());
    act(() => result.current.garantir());
    await waitFor(() => expect(result.current.erro).toBe(true));
    expect(result.current.semAcesso).toBe(false);
  });
});

describe('300 · seção Webmap QGIS recolhida por padrão', () => {
  it('padrão abre só SIGMA; Webmap e grupos recolhidos', () => {
    const e = estadoCamadasPadrao();
    expect(e.gruposAbertos).toContain('sigma');
    expect(e.gruposAbertos).not.toContain('webmap');
    expect(e.gruposAbertos.some((g) => g.startsWith('webmap-grupo:'))).toBe(false);
  });
});
