import '@/test-utils/jsdom-global';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getMapaCamadas = vi.fn(async () => [{ id: 'g', titulo: 'Drenagem', camadas: [] }]);
vi.mock('@/lib/api', () => ({ getMapaCamadas: () => getMapaCamadas() }));

import { useArvoreCamadasWebmap } from './use-arvore-camadas-webmap';
import { webmapCamadasMapaAtivo } from './feature-flags';
import { contarCamadasAlemDoPadrao, estadoCamadasPadrao } from './cco-camadas';

afterEach(() => { getMapaCamadas.mockClear(); vi.unstubAllEnvs(); });

describe('299 W-OCULTO · flag NEXT_PUBLIC_WEBMAP_CAMADAS_MAPA', () => {
  it('padrão desligada; só "true" liga', () => {
    vi.stubEnv('NEXT_PUBLIC_WEBMAP_CAMADAS_MAPA', '');
    expect(webmapCamadasMapaAtivo()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_WEBMAP_CAMADAS_MAPA', 'false');
    expect(webmapCamadasMapaAtivo()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_WEBMAP_CAMADAS_MAPA', '1');
    expect(webmapCamadasMapaAtivo()).toBe(false);
    vi.stubEnv('NEXT_PUBLIC_WEBMAP_CAMADAS_MAPA', 'true');
    expect(webmapCamadasMapaAtivo()).toBe(true);
  });

  it('flag off: o hook NÃO faz nenhuma requisição de camadas (carregar e garantir)', async () => {
    const { result } = renderHook(() => useArvoreCamadasWebmap(false));
    act(() => { result.current.garantir(); result.current.carregar(); result.current.garantir(); });
    await new Promise((r) => setTimeout(r, 20));
    expect(getMapaCamadas).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ arvore: null, carregando: false, erro: false });
  });

  it('flag on: carrega uma vez sob demanda', async () => {
    const { result } = renderHook(() => useArvoreCamadasWebmap(true));
    expect(getMapaCamadas).not.toHaveBeenCalled(); // nada na montagem
    act(() => result.current.garantir());
    await waitFor(() => expect(result.current.arvore).toHaveLength(1));
    act(() => result.current.garantir());
    expect(getMapaCamadas).toHaveBeenCalledTimes(1);
  });

  it('selo do botão Camadas: flag off não conta nada do Webmap', () => {
    const estado = { ...estadoCamadasPadrao(), ligadas: [...estadoCamadasPadrao().ligadas, 'webmap:a', 'webmap:b'] };
    expect(contarCamadasAlemDoPadrao(estado, false, true)).toBe(2);
    expect(contarCamadasAlemDoPadrao(estado, false, false)).toBe(0);
    expect(contarCamadasAlemDoPadrao(estado, true, false)).toBe(1);
  });
});
