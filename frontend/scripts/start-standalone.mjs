/**
 * Sobe o Next standalone onde quer que o server.js esteja:
 * - Docker (WORKDIR /app após COPY standalone ./): ./server.js
 * - Docker aninhado (sem flatten): ./frontend/server.js
 * - Nixpacks / npm start: .next/standalone/server.js
 * - Nixpacks aninhado: .next/standalone/<pasta>/server.js
 */
import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

export function mensagemSaidaServer(code, signal) {
  return `start-standalone: server.js encerrou code=${code == null ? '-' : code} signal=${signal ?? '-'}`;
}

export function scriptEhPrincipal(argv1, href) {
  if (!argv1) return false;
  try {
    return realpathSync(argv1) === realpathSync(fileURLToPath(href));
  } catch {
    return false;
  }
}

export const ESPERA_ENCERRAMENTO_MS = 8000;

export function forcarSaidaDoFilho(child) {
  console.error('start-standalone: server.js não encerrou a tempo; saindo.');
  try {
    if (child?.pid) child.kill('SIGKILL');
  } catch {
    /* processo já saiu */
  }
}

export function agendarSaidaForcada(child, sair, esperaMs = ESPERA_ENCERRAMENTO_MS) {
  return setTimeout(() => {
    forcarSaidaDoFilho(child);
    sair();
  }, esperaMs);
}

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

function main() {
  const cwd = process.cwd();
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(cwd, 'server.js'),
    join(cwd, 'frontend', 'server.js'),
    join(cwd, '.next', 'standalone', 'server.js'),
    findNestedServer(join(cwd, '.next', 'standalone')),
    join(cwd, 'frontend', '.next', 'standalone', 'server.js'),
    findNestedServer(join(cwd, 'frontend', '.next', 'standalone')),
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

  let encerrando = false;
  function encaminharSinal(signal) {
    if (encerrando) return;
    encerrando = true;
    console.error(`start-standalone: recebido ${signal}; encaminhando ao server.js (pid ${child.pid ?? '-'})`);
    try {
      if (child.pid) child.kill(signal);
    } catch {
      /* processo já saiu */
    }
    agendarSaidaForcada(child, () => process.exit(1)).unref();
  }

  process.on('SIGTERM', () => encaminharSinal('SIGTERM'));
  process.on('SIGINT', () => encaminharSinal('SIGINT'));

  child.on('exit', (code, signal) => {
    console.error(mensagemSaidaServer(code, signal));
    if (signal && !encerrando) {
      // Saída por sinal do filho (ex.: SIGKILL/OOM): não reenviar o sinal a nós mesmos
      // (antes o processo morria sem log e o Coolify registrava só "crash").
      process.exit(1);
      return;
    }
    process.exit(code ?? 1);
  });
}

const isMain = scriptEhPrincipal(process.argv[1], import.meta.url);
if (isMain) main();
