/**
 * Sobe o Next standalone onde quer que o server.js esteja:
 * - Docker (WORKDIR /app após COPY standalone ./): ./server.js
 * - Docker aninhado (sem flatten): ./frontend/server.js
 * - Nixpacks / npm start: .next/standalone/server.js
 * - Nixpacks aninhado: .next/standalone/<pasta>/server.js
 */
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const cwd = process.cwd();
const scriptDir = dirname(fileURLToPath(import.meta.url));

function findNestedServer(standaloneDir) {
  if (!existsSync(standaloneDir)) return null;
  const direct = join(standaloneDir, 'server.js');
  if (existsSync(direct)) return direct;

  for (const entry of readdirSync(standaloneDir)) {
    if (entry === 'node_modules') continue;
    const sub = join(standaloneDir, entry, 'server.js');
    try {
      if (existsSync(sub) && statSync(join(standaloneDir, entry)).isDirectory()) {
        return sub;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

const candidates = [
  join(cwd, 'server.js'),
  join(cwd, 'frontend', 'server.js'),
  join(cwd, '.next', 'standalone', 'server.js'),
  findNestedServer(join(cwd, '.next', 'standalone')),
  // fallback se cwd for a raiz do monorepo
  join(cwd, 'frontend', '.next', 'standalone', 'server.js'),
  findNestedServer(join(cwd, 'frontend', '.next', 'standalone')),
  // script em frontend/scripts → sobe um nível
  join(scriptDir, '..', 'server.js'),
  join(scriptDir, '..', '.next', 'standalone', 'server.js'),
].filter(Boolean);

const serverJs = candidates.find((p) => existsSync(p));

if (!serverJs) {
  console.error(
    'start-standalone: server.js não encontrado. Candidatos tentados:\n' +
      candidates.map((p) => `  - ${p}`).join('\n'),
  );
  process.exit(1);
}

const resolved = resolve(serverJs);
console.log(`start-standalone: iniciando ${resolved}`);

const child = spawn(process.execPath, [resolved], {
  stdio: 'inherit',
  env: process.env,
  cwd: dirname(resolved),
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
