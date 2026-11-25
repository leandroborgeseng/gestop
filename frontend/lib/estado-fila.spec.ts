import { describe, expect, it } from 'vitest';
import { assinarEstadoFila, lerEstadoFila, publicarEstadoFila, rotuloConexao } from './estado-fila';

describe('M1 chip de conexão', () => {
  it('online: verde e "Online"', () => {
    expect(rotuloConexao(true, 0)).toEqual({ texto: 'Online', tom: 'ok', ariaLabel: 'Conexão: online, nenhum envio pendente. Ver detalhes' });
  });
  it('offline: nunca verde; aria-label com pendências (singular/plural)', () => {
    expect(rotuloConexao(false, 2)).toEqual({ texto: 'Offline', tom: 'alerta', ariaLabel: 'Conexão: offline, 2 envios pendentes. Ver detalhes' });
    expect(rotuloConexao(false, 1).ariaLabel).toBe('Conexão: offline, 1 envio pendente. Ver detalhes');
  });
  it('estado publicado pelo app chega ao cabeçalho', () => {
    let n = 0;
    const off = assinarEstadoFila(() => n++);
    publicarEstadoFila({ pendentes: 3 });
    expect(lerEstadoFila().pendentes).toBe(3);
    expect(n).toBe(1);
    off();
  });
});
