import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = join(dirname(fileURLToPath(import.meta.url)), 'healthcheck.mjs');

function executar(porta: string) {
  return new Promise<number>((resolve) => {
    const child = spawn(process.execPath, [script], {
      env: { ...process.env, PORT: porta },
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

function ouvir(status: number) {
  const server = createServer((_req, res) => {
    res.writeHead(status);
    res.end('ok');
  });
  return new Promise<{ port: number; close: () => Promise<void> }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') throw new Error('sem porta');
      resolve({
        port: addr.port,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

describe('healthcheck', () => {
  it('200 resulta em saída 0', async () => {
    const srv = await ouvir(200);
    try {
      expect(await executar(String(srv.port))).toBe(0);
    } finally {
      await srv.close();
    }
  });

  it('503 resulta em saída 1', async () => {
    const srv = await ouvir(503);
    try {
      expect(await executar(String(srv.port))).toBe(1);
    } finally {
      await srv.close();
    }
  });

  it('porta fechada resulta em saída 1', async () => {
    expect(await executar('9')).toBe(1);
  });
});
