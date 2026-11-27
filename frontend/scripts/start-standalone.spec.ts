import { describe, expect, it } from 'vitest';
import { mensagemSaidaServer } from './start-standalone.mjs';

describe('start-standalone · log de encerramento', () => {
  it('registra código e sinal para diagnóstico de crash/OOM', () => {
    expect(mensagemSaidaServer(0, null)).toBe('start-standalone: server.js encerrou code=0 signal=-');
    expect(mensagemSaidaServer(1, null)).toBe('start-standalone: server.js encerrou code=1 signal=-');
    expect(mensagemSaidaServer(null, 'SIGTERM')).toBe('start-standalone: server.js encerrou code=- signal=SIGTERM');
    expect(mensagemSaidaServer(null, 'SIGKILL')).toBe('start-standalone: server.js encerrou code=- signal=SIGKILL');
  });
});
