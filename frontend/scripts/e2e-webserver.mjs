// Servidor do Playwright no CI: gera o build standalone se ainda não existir e sobe o app.
// O workflow E2E Smoke só roda `npm ci`; sem isto o start-standalone não acha o server.js.
import { existsSync } from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
import path from 'node:path';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const pronto = ['server.js', '.next/standalone/server.js'].some((p) => existsSync(path.join(raiz, p)));

if (!pronto) {
  console.log('[e2e-webserver] build standalone ausente; rodando npm run build');
  const b = spawnSync(npm, ['run', 'build'], { cwd: raiz, stdio: 'inherit' });
  if (b.status !== 0) process.exit(b.status ?? 1);
}
const s = spawn(npm, ['run', 'start'], { cwd: raiz, stdio: 'inherit' });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => s.kill(sig));
s.on('exit', (code) => process.exit(code ?? 0));
