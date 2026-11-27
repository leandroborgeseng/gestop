import { mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { agendarSaidaForcada, mensagemSaidaServer } from './start-standalone.mjs';

const script = fileURLToPath(new URL('./start-standalone.mjs', import.meta.url));

describe('start-standalone · log de encerramento', () => {
  it('registra código e sinal para diagnóstico de crash/OOM', () => {
    expect(mensagemSaidaServer(0, null)).toBe('start-standalone: server.js encerrou code=0 signal=-');
    expect(mensagemSaidaServer(1, null)).toBe('start-standalone: server.js encerrou code=1 signal=-');
    expect(mensagemSaidaServer(null, 'SIGTERM')).toBe('start-standalone: server.js encerrou code=- signal=SIGTERM');
    expect(mensagemSaidaServer(null, 'SIGKILL')).toBe('start-standalone: server.js encerrou code=- signal=SIGKILL');
  });

  it('se o filho não sai em 8 s, manda SIGKILL antes do wrapper sair', () => {
    vi.useFakeTimers();
    const ordem: string[] = [];
    const child = { pid: 42, kill: (sig: string) => ordem.push(sig) };
    agendarSaidaForcada(child, () => ordem.push('sair'));
    vi.advanceTimersByTime(7999);
    expect(ordem).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(ordem).toEqual(['SIGKILL', 'sair']);
    vi.useRealTimers();
  });

  it('symlink executa o script (server.js ausente encerra com 1)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'start-standalone-'));
    const link = join(dir, 'start-standalone.mjs');
    symlinkSync(script, link);
    const vazio = mkdtempSync(join(tmpdir(), 'start-standalone-cwd-'));
    try {
      const code = await new Promise<number>((resolve) => {
        const child = spawn(process.execPath, [link], { cwd: vazio });
        child.on('exit', (c) => resolve(c ?? 1));
      });
      expect(code).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      rmSync(vazio, { recursive: true, force: true });
    }
  });
});
