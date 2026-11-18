import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deactivateCronograma,
  getChamado,
  getChamadoLeituraViaTarefa,
  getChamadoTarefa,
  getDocumento,
  getFiscalizacao,
  reactivateCronograma,
} from '@/lib/api';
import { buscarRegistroPorIdDaUrl, caminhoRegistro, idTemFormatoPrisma } from './id-prisma';

const UUID = '11111111-1111-4111-8111-111111111111';
const INJECAO = 'x?a=1';

describe('322 C-2 · id fora do UUID não chama a API', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a busca da tela não dispara requisição e o path continua codificado', async () => {
    const buscar = vi.fn(async () => ({ ok: true }));
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(buscarRegistroPorIdDaUrl(INJECAO, buscar)).resolves.toEqual({ tipo: 'formato' });
    expect(buscar).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(idTemFormatoPrisma(INJECAO)).toBe(false);
    expect(caminhoRegistro('/chamados', INJECAO)).toBe('/chamados/x%3Fa%3D1');
    expect(caminhoRegistro('/chamados', UUID)).toBe(`/chamados/${UUID}`);

    await expect(buscarRegistroPorIdDaUrl(UUID, buscar)).resolves.toEqual({ tipo: 'ok', data: { ok: true } });
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(buscar).toHaveBeenCalledWith(UUID);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('os GETs do registro recusam o id fora do formato sem fetch', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const chamadas = [
      getChamado(INJECAO),
      getDocumento(INJECAO),
      getFiscalizacao(INJECAO),
      getChamadoTarefa(INJECAO),
      getChamadoLeituraViaTarefa(INJECAO, UUID),
      getChamadoLeituraViaTarefa(UUID, INJECAO),
      deactivateCronograma(INJECAO),
      reactivateCronograma(INJECAO),
    ];

    const resultados = await Promise.allSettled(chamadas);
    expect(resultados.every((item) => item.status === 'rejected' && (item.reason as { status?: number }).status === 404)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
